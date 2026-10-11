import {randomUUID} from 'node:crypto';
import type {PrismaClient,LifetimePayment} from '@prisma/client';
const fail=(message:string,status=400)=>Object.assign(Error(message),{status});
type Provider=(path:string,body?:unknown)=>Promise<any>;
export function checkoutUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['rzp.io','razorpay.com'].includes(u.hostname);}catch{return false;}}
const creating=new Map<string,Promise<any>>();
/** Amount and recipient belong to the server. There is no client-paid switch. */
export async function createLifetimePayment(db:PrismaClient,provider:Provider,u:any){
 if(u.subscriptionStatus==='lifetime')return {alreadyPaid:true};
 const flight=creating.get(u.id);if(flight)return flight;
 const promise=db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id+'|lifetime-checkout'}))`;
  if((await tx.user.findUniqueOrThrow({where:{id:u.id}})).subscriptionStatus==='lifetime')return {alreadyPaid:true};
  let row=await tx.lifetimePayment.findFirst({where:{userId:u.id,status:'created',expiresAt:{gt:new Date(Date.now()+60000)}},orderBy:{createdAt:'desc'}});
  if(row?.checkoutUrl&&checkoutUrl(row.checkoutUrl))return {paymentId:row.id,checkoutUrl:row.checkoutUrl,amount:1000,currency:'INR',plan:'lifetime'};
  if(!row)row=await tx.lifetimePayment.create({data:{userId:u.id,referenceId:randomUUID(),expiresAt:new Date(Date.now()+86400000)}});
  const link=await provider('/payment_links',{amount:100000,currency:'INR',accept_partial:false,reference_id:row.referenceId,expire_by:Math.floor(row.expiresAt.getTime()/1000),description:'ZFLEET Connect lifetime access — one-time ₹1,000',notify:{sms:false,email:false},reminder_enable:false,notes:{user_id:u.id,reference_id:row.referenceId,plan:'lifetime'}});
  if(!/^plink_[A-Za-z0-9]+$/.test(link.id||'')||link.amount!==100000||link.currency!=='INR'||link.reference_id!==row.referenceId||!checkoutUrl(link.short_url))throw fail('Payment provider returned an invalid checkout',502);
  await tx.lifetimePayment.update({where:{id:row.id},data:{providerId:link.id,providerOrderId:link.order_id||null,checkoutUrl:link.short_url}});
  await tx.audit.create({data:{userId:u.id,action:'lifetime-checkout-created',target:link.id,result:'INR 1000 once'}});
  return {paymentId:row.id,checkoutUrl:link.short_url,amount:1000,currency:'INR',plan:'lifetime'};
 },{timeout:25000,maxWait:25000});creating.set(u.id,promise);
 try{return await promise;}finally{if(creating.get(u.id)===promise)creating.delete(u.id);}
}
/** Re-fetch provider data even for signed, replayed or out-of-order webhooks. */
export async function reconcileLifetimePayment(db:PrismaClient,provider:Provider,row:LifetimePayment,event?:{id:string;name:string}){
 if(!row.providerId)throw fail('Checkout is still being created. Retry shortly.',409);
 const link=await provider('/payment_links/'+encodeURIComponent(row.providerId));
 if(link.id!==row.providerId||link.reference_id!==row.referenceId||link.amount!==row.amount||link.currency!==row.currency||row.amount!==100000||row.currency!=='INR'||link.accept_partial===true)throw fail('Payment checkout verification failed',409);
 const candidate=(link.payments||[]).find((p:any)=>p.payment_id===row.paymentId)||[...(link.payments||[])].reverse().find((p:any)=>p.status==='captured'&&p.amount===100000);
 let paid=false,refunded=false,payment:any;
 if(candidate){payment=await provider('/payments/'+encodeURIComponent(candidate.payment_id));if(payment.id!==candidate.payment_id||!link.order_id||payment.order_id!==link.order_id||payment.amount!==100000||payment.currency!=='INR')throw fail('Payment amount or order verification failed',409);refunded=payment.status==='refunded'||Number(payment.amount_refunded)>0;paid=!refunded&&link.status==='paid'&&link.amount_paid===100000&&payment.status==='captured'&&payment.captured===true;}
 let status=refunded?'refunded':paid?'paid':['expired','cancelled'].includes(link.status)?link.status:'created';
 await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.userId+'|lifetime-entitlement'}))`;
  const current=await tx.lifetimePayment.findUniqueOrThrow({where:{id:row.id}});if(current.status==='refunded'){status='refunded';paid=false;refunded=true;}
  await tx.lifetimePayment.update({where:{id:row.id},data:{status,providerOrderId:link.order_id||null,...(payment?{paymentId:payment.id}:{}),...(paid?{paidAt:row.paidAt||new Date()}:{} )}});
  if(paid)await tx.user.update({where:{id:row.userId},data:{subscriptionStatus:'lifetime',periodEnd:null}});
  if(refunded&&!(await tx.lifetimePayment.count({where:{userId:row.userId,status:'paid'}})))await tx.user.updateMany({where:{id:row.userId,subscriptionStatus:'lifetime'},data:{subscriptionStatus:'lifetime-refunded',periodEnd:null}});
  if(event)await tx.webhook.upsert({where:{id:event.id},create:{id:event.id,event:event.name,providerId:row.providerId},update:{}});
  if(status!==current.status)await tx.audit.create({data:{userId:row.userId,action:'lifetime-payment-verified',target:row.providerId,result:status}});
 });
 let legacyRenewalPending=false;
 if(paid){const current=await db.lifetimePayment.findUniqueOrThrow({where:{id:row.id}}),owner=await db.user.findUniqueOrThrow({where:{id:row.userId}});if(owner.providerId&&!current.legacyCancelled){try{const legacy=await provider('/subscriptions/'+encodeURIComponent(owner.providerId));if(!['cancelled','completed','expired'].includes(legacy.status))await provider('/subscriptions/'+encodeURIComponent(owner.providerId)+'/cancel',{cancel_at_cycle_end:1});await db.lifetimePayment.update({where:{id:row.id},data:{legacyCancelled:true}});}catch{legacyRenewalPending=true;await db.audit.create({data:{userId:row.userId,action:'legacy-renewal-cancel-pending',target:owner.providerId,result:'Retry legacy cancellation from Billing'}});}}}
 return {status,plan:'lifetime',amount:1000,legacyRenewalPending};
}
