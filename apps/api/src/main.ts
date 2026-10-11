import 'reflect-metadata';
import { All, Controller, Module, Req, Res } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import {Server} from 'socket.io';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Request,Response} from 'express';
import {contactSchema,followupSchema,scheduleSchema,ruleSchema,defaultSettings,licenseStatus,ruleMatches,nextOccurrence,initialState,inWindow,deliverySettingsSchema,deliveryWait,autoReplyWait,AUTO_REPLY_FRESH_MS,localClock,sameReminderRecipient,canClaim,type Chat,type Message,type Rule} from '../../../packages/shared/src/index.ts';
import {seal,unseal,encryptionKey,verifyWebhook} from './crypto.ts';
import {createLifetimePayment,reconcileLifetimePayment} from './billing.ts';
import {errorResponse,readRecord} from './errors.ts';
import {deliveryHistory,decorateJob,deliveryInfo,jobWait} from './delivery.ts';
const db=new PrismaClient();const secret=process.env.JWT_SECRET||'';
if(secret.length<32||secret.includes('REPLACE'))throw Error('Set a random JWT_SECRET with at least 32 characters');encryptionKey();
let io:Server;
const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});
const obj=(x:any)=>x&&typeof x==='object'?x:{};
function validateRuleSelection(r:Rule|z.infer<typeof ruleSchema>,u:any){if(r.contactKeys.some(k=>r.excludedKeys.includes(k)||(obj(u.settings).excludedKeys||[]).includes(k)))throw fail('Selected contact also excluded. Remove it from the rule or Settings exclusion list.');}
const deviceSchema=z.string().uuid();
const settingsSchema=z.object({timezone:z.string().refine(t=>{try{new Intl.DateTimeFormat('en',{timeZone:t});return true;}catch{return false;}}),graceMinutes:z.number().int().min(0).max(10080),awaitingReplyMode:z.enum(['outgoing','incoming']),notifications:z.boolean(),autoPaused:z.boolean(),excludedKeys:z.array(z.string()).max(500),workingStart:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),workingEnd:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),workingDays:z.array(z.number().int().min(0).max(6)),accountNamespace:z.string().min(1).max(80),mentionAliases:z.array(z.string().min(1).max(100)).max(20),dateOrder:z.enum(['DMY','MDY']),ownPhone:z.string().max(20).refine(v=>!v||/^\+?\d{8,15}$/.test(v),'Use country code and digits'),autoReadUnread:z.boolean()}).extend(deliverySettingsSchema.shape).partial();
const limits=new Map<string,{count:number;reset:number}>();
function limit(key:string,max:number){const now=Date.now();for(const [k,v]of limits)if(v.reset<now)limits.delete(k);const v=limits.get(key)||{count:0,reset:now+60000};v.count++;limits.set(key,v);if(v.count>max)throw Object.assign(fail('Too many requests. Retrying after '+Math.ceil((v.reset-now)/1000)+' seconds.',429),{retryAfter:Math.ceil((v.reset-now)/1000)});}
async function auth(token:string){let p:any;try{p=jwt.verify(token,secret);}catch{throw fail('Sign in again',401);}let u;try{u=await db.user.findUnique({where:{id:p.sub}});}catch(e:any){if(e.code!=='P1017')throw e;u=await db.user.findUnique({where:{id:p.sub}});}if(!u||u.disabled||p.v!==u.tokenVersion)throw fail('Sign in again',401);return u;}
async function premium(u:any,feature?:'scheduling'|'autoReply'){const fresh=await db.user.findUniqueOrThrow({where:{id:u.id}});if(!licenseStatus(fresh).premium)throw fail('Trial ended. INR 1000 one-time lifetime access required.',402);const flag=await db.featureFlag.findUnique({where:{id:'global'}});if(feature&&flag&&!flag[feature])throw fail('Feature temporarily paused by support',503);}
function changed(id:string){io?.to(id).emit('changed');}
async function audit(userId:string,action:string,target:string,result:string){await db.audit.create({data:{userId,action,target,result}});}
async function contact(userId:string,c:any){const t=contactSchema.parse(c);await db.contact.upsert({where:{userId_key:{userId,key:t.key}},update:{name:t.name,type:t.type},create:{userId,...t}});}
function scheduleOut(x:any){return {...unseal(x.data),id:x.id,dueAt:x.dueAt.toISOString(),status:x.status,sentAt:x.sentAt?.toISOString(),error:x.status==='sent'?undefined:x.error||undefined,kind:x.kind,incomingKey:x.incomingKey||undefined,attempt:x.attempt};}
function followupOut(x:any){return {...unseal(x.data),id:x.id,status:x.status,notified:x.notified};}
async function state(u:any){const [f,s,r,c,flags,conversations,payments,history]=await Promise.all([db.followup.findMany({where:{userId:u.id},orderBy:{dueAt:'asc'}}),db.schedule.findMany({where:{userId:u.id},orderBy:{dueAt:'asc'}}),db.autoRule.findMany({where:{userId:u.id}}),db.contact.findMany({where:{userId:u.id}}),db.featureFlag.findUnique({where:{id:'global'}}),db.conversation.findMany({where:{userId:u.id}}),db.lifetimePayment.findMany({where:{userId:u.id},orderBy:{createdAt:'desc'},take:5}),deliveryHistory(db,u.id)]);const warnings:string[]=[];const decode=(rows:any[],fn:(x:any)=>any,label:string)=>rows.map(x=>readRecord(()=>fn(x),warnings,label)).filter(Boolean);const notes:Record<string,string>={};for(const x of c.filter(x=>x.note)){const note=readRecord(()=>unseal(JSON.parse(x.note!)),warnings,"Private note");if(note)notes[x.key]=note.text;}const settings={...defaultSettings,...obj(u.settings)},rules=decode(r,x=>({...unseal(x.data),id:x.id}),"Auto rule");const jobs=decode(s,x=>decorateJob(scheduleOut(x),x,settings,rules,history),"Schedule");return {...initialState,serverVersion:'1.4.13',delivery:deliveryInfo(settings,history),autoJobs:jobs.filter(x=>x.kind==='auto'&&['queued','ready','sending','needs-whatsapp-open'].includes(x.status)).concat(jobs.filter(x=>x.kind==='auto'&&!['queued','ready','sending','needs-whatsapp-open'].includes(x.status)).slice(-30)),billing:{legacyRenewal:!!u.providerId&&!payments.some(p=>p.status==='paid'&&p.legacyCancelled),lastPayment:payments[0]?.status},conversations:conversations.map(cv=>{const contact=c.find(x=>x.key===cv.key);const outgoing=cv.lastOutgoingAt?.getTime()||0,incoming=cv.lastIncomingAt?.getTime()||0;return {key:cv.key,name:contact?.name||'Unknown',type:contact?.type||'unknown',lastDirection:outgoing>incoming?'out':incoming?'in':'unknown',lastAt:Math.max(outgoing,incoming),unread:0,mention:false,preview:'',verified:true};}),followups:decode(f,followupOut,"Follow-up"),schedules:jobs.filter(x=>x.kind==='scheduled'),rules,notes,dataWarnings:[...new Set(warnings)],settings,license:licenseStatus(u),user:{name:u.name,email:u.email},flags:flags?{scheduling:flags.scheduling,autoReply:flags.autoReply}:{scheduling:true,autoReply:true}};}
async function dispatch(req:Request){
 const path=req.path.replace(/\/$/,'')||'/',method=req.method,b=obj(req.body);
 if(path==='/health'||path==='/'&&method==='GET')return {ok:true,version:'1.4.13'};
 if(path==='/auth/register'&&method==='POST'){
  limit(`auth:${req.ip}`,10);const v=z.object({name:z.string().min(2).max(100),email:z.email().max(254),password:z.string().min(12).max(128)}).parse(b);const email=v.email.trim().toLowerCase();if(await db.user.findUnique({where:{email}}))throw fail('Email already registered',409);
  const u=await db.user.create({data:{name:v.name,email,passwordHash:await bcrypt.hash(v.password,12),trialEnd:new Date(Date.now()+14*86400000)}}).catch((e:any)=>{if(e.code==='P2002')throw fail('Email already registered',409);throw e;});return {token:jwt.sign({sub:u.id,v:u.tokenVersion},secret,{expiresIn:'7d'}),state:await state(u)};
 }
 if(path==='/auth/login'&&method==='POST'){
  limit(`auth:${req.ip}`,10);const v=z.object({email:z.email(),password:z.string().max(128)}).parse(b);const u=await db.user.findUnique({where:{email:v.email.trim().toLowerCase()}});if(!u||u.disabled||!await bcrypt.compare(v.password,u.passwordHash))throw fail('Email or password incorrect',401);return {token:jwt.sign({sub:u.id,v:u.tokenVersion},secret,{expiresIn:'7d'}),state:await state(u)};
 }
 if(path==='/webhooks/razorpay'&&method==='POST'){
  const raw=(req as any).rawBody as Buffer, sig=req.header('x-razorpay-signature')||'',hookSecret=process.env.RAZORPAY_WEBHOOK_SECRET||'';
  if(!hookSecret||!raw||!verifyWebhook(raw,sig,hookSecret))throw fail('Invalid webhook signature',401);
  const event=z.string().parse(b.event),entity=b.payload?.subscription?.entity;const id=req.header('x-razorpay-event-id');if(!id)throw fail('Missing webhook identity');
  const link=b.payload?.payment_link?.entity,payment=b.payload?.payment?.entity,refund=b.payload?.refund?.entity;
  if(!entity){
   if(!['payment_link.paid','payment.captured','refund.processed'].includes(event))return {ok:true,ignored:true};
   const row=link?.id?await db.lifetimePayment.findUnique({where:{providerId:link.id}}):refund?.payment_id?await db.lifetimePayment.findUnique({where:{paymentId:refund.payment_id}}):payment?.order_id?await db.lifetimePayment.findFirst({where:{providerOrderId:payment.order_id}}):null;
   if(!row){if(event==='payment_link.paid')throw fail('Checkout is not linked yet. Retry shortly.',409);return {ok:true,ignored:true};}
   const result=await reconcileLifetimePayment(db,razorpay,row,{id,name:event});changed(row.userId);return {ok:true,...result};
  }
  if(!entity.id)throw fail('Missing webhook identity');
  const mapped=await db.user.findUnique({where:{providerId:entity.id}});if(!mapped)throw fail('Subscription not linked. Retry later.',409);
  // Reconcile current provider state instead of accepting out-of-order payloads.
  const current=await razorpay(`/subscriptions/${encodeURIComponent(entity.id)}`);
  const end=current.current_end?new Date(current.current_end*1000):null;
  try{await db.$transaction(async tx=>{await tx.webhook.create({data:{id,event,providerId:entity.id}});if(!mapped.subscriptionStatus.startsWith('lifetime'))await tx.user.update({where:{id:mapped.id},data:{subscriptionStatus:current.status,periodEnd:end}});await tx.audit.create({data:{userId:mapped.id,action:'payment-webhook',target:entity.id,result:event}});});}catch(e:any){if(e.code!=='P2002')throw e;}
  changed(mapped.id);return {ok:true};
 }
 const u=await auth((req.header('authorization')||'').replace(/^Bearer /,''));limit(`user:${u.id}:${method==='GET'?'read':'write'}`,method==='GET'?240:120);
 if(path==='/auth/logout'&&method==='POST'){await db.user.update({where:{id:u.id},data:{tokenVersion:{increment:1}}});return {ok:true};}
 if(path==='/state'&&method==='GET')return state(u);
 if(path==='/license/status'&&method==='GET')return licenseStatus(u);
 if(path==='/settings'&&method==='PATCH'){const v=settingsSchema.parse(b);const merged={...defaultSettings,...obj(u.settings),...v};if(merged.quietHoursEnabled&&merged.quietStart===merged.quietEnd)throw fail('Quiet hours start and end must be different');if(!(Object.keys(v).length===1&&v.autoPaused===true))await premium(u);await db.user.update({where:{id:u.id},data:{settings:{...obj(u.settings),...v}}});changed(u.id);return {ok:true};}
 if(path==='/notes'&&method==='POST'){await premium(u);await contact(u.id,b.contact);const text=z.string().max(4000).parse(b.text);await db.contact.update({where:{userId_key:{userId:u.id,key:b.contact.key}},data:{note:JSON.stringify(seal({text}))}});changed(u.id);return {ok:true};}
 if(path==='/followups'&&method==='GET')return (await state(u)).followups;
 if(path==='/followups'&&method==='POST'){await premium(u);const v=followupSchema.parse(b);validTimezone(v.timezone);await contact(u.id,v.contact);const x=await db.followup.create({data:{userId:u.id,data:seal(v),dueAt:new Date(v.dueAt),reminderAt:new Date(Date.parse(v.dueAt)-v.reminderMinutes*60000)}});changed(u.id);return followupOut(x);}
 if(path.startsWith('/followups/')&&method==='PATCH'){
  const id=path.split('/')[2],x=await db.followup.findFirst({where:{id,userId:u.id}});if(!x)throw fail('Follow-up not found',404);
  const status=z.enum(['pending','snoozed','done','cancelled']).parse(b.status||x.status);let v=unseal(x.data);if(b.contact!==undefined||b.timezone!==undefined||b.subject!==undefined||b.messageKey!==undefined||b.dueAt||b.note!==undefined||b.priority||b.reminderMinutes!==undefined||b.repeat||b.repeatDays||b.repeatWeekdays){await premium(u);v=followupSchema.parse({...v,...b});validTimezone(v.timezone);}
  await db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id+'|followup:'+id}))`;const update=await tx.followup.updateMany({where:{id,userId:u.id,status:x.status,dueAt:x.dueAt},data:{data:seal(v),status,dueAt:new Date(v.dueAt),reminderAt:new Date(Date.parse(v.dueAt)-v.reminderMinutes*60000),notified:(status==='snoozed'||b.dueAt)?false:x.notified}});if(!update.count)throw fail('Follow-up changed on another device; refresh',409);
  if(['done','cancelled'].includes(status)){const queued=await tx.schedule.findMany({where:{userId:u.id,kind:'scheduled',status:{in:['queued','ready','needs-whatsapp-open']}}});const ids=queued.filter(j=>readRecord(()=>unseal(j.data).followupId===id,[],"Reminder")).map(j=>j.id);if(ids.length)await tx.schedule.updateMany({where:{id:{in:ids},userId:u.id,status:{in:['queued','ready','needs-whatsapp-open']}},data:{status:'cancelled',error:'Follow-up completed or cancelled'}});}
  if(status==='done'&&x.status!=='done'){const n=nextOccurrence(v.dueAt,v.repeat,v.repeatDays,v.timezone,Date.now(),v.repeatWeekdays);if(n){const nv={...v,dueAt:n};await tx.followup.create({data:{userId:u.id,data:seal(nv),dueAt:new Date(n),reminderAt:new Date(Date.parse(n)-v.reminderMinutes*60000)}});}}});
  changed(u.id);return {ok:true,followups:(await db.followup.findMany({where:{userId:u.id},orderBy:{dueAt:'asc'}})).map(x=>readRecord(()=>followupOut(x),[],"Follow-up")).filter(Boolean)};
 }
 if(path==='/scheduled-messages'&&method==='GET')return (await state(u)).schedules;
 if(path==='/scheduled-messages'&&method==='POST'){
  await premium(u,'scheduling');const v=scheduleSchema.parse(b);validTimezone(v.timezone);if(Date.parse(v.dueAt)<=Date.now())throw fail('Choose a future time');await contact(u.id,v.contact);
  const x=await db.$transaction(async tx=>{
   if(v.followupId){
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id+'|followup:'+v.followupId}))`;
    const f=await tx.followup.findFirst({where:{id:v.followupId,userId:u.id}});if(!f)throw fail('Follow-up not found',404);if(!['pending','snoozed'].includes(f.status))throw fail('This follow-up is already completed or cancelled',409);
    if(!sameReminderRecipient(unseal(f.data).contact,v.contact))throw fail('Follow-up reminder target mismatch',409);
    if(v.repeat!=='none')throw fail('A follow-up reminder sends once. Each new follow-up occurrence needs its own authorization.');
    const idempotencyKey=`followup:${u.id}:${f.id}`;
    const existing=await tx.schedule.findUnique({where:{idempotencyKey}});if(existing)return existing;
    return tx.schedule.create({data:{userId:u.id,data:seal(v),contactKey:v.contact.key,dueAt:new Date(v.dueAt),idempotencyKey}});
   }
   return tx.schedule.create({data:{userId:u.id,data:seal(v),contactKey:v.contact.key,dueAt:new Date(v.dueAt),idempotencyKey:randomUUID()}});
  });changed(u.id);return scheduleOut(x);
 }
 if(path.startsWith('/scheduled-messages/')&&method==='PATCH'){
  const id=path.split('/')[2],x=await db.schedule.findFirst({where:{id,userId:u.id}});if(!x)throw fail('Schedule not found',404);if(['sending','sent'].includes(x.status))throw fail('This schedule cannot be changed',409);
  if(b.action==='cancel'){const update=await db.schedule.updateMany({where:{id,userId:u.id,status:x.status,attempt:x.attempt},data:{status:'cancelled'}});if(!update.count)throw fail('Schedule is already claimed or changed; refresh',409);changed(u.id);return {ok:true};}
  await premium(u,'scheduling');if(['unknown','failed'].includes(x.status)&&b.confirmNotSent!==true)throw fail('Check WhatsApp first and confirm the message was not sent',409);
  const original=unseal(x.data),v=scheduleSchema.parse({...original,...b});if(v.followupId!==original.followupId)throw fail('Reminder association cannot be changed');if(v.followupId&&!sameReminderRecipient(original.contact,v.contact))throw fail('Follow-up reminder target mismatch',409);if(v.followupId&&v.repeat!=='none')throw fail('A follow-up reminder sends once');validTimezone(v.timezone);if(Date.parse(v.dueAt)<=Date.now())throw fail('Choose a future time');const update=await db.schedule.updateMany({where:{id,userId:u.id,status:x.status,attempt:x.attempt},data:{data:seal(v),contactKey:v.contact.key,status:'queued',error:null,dueAt:new Date(v.dueAt),leaseToken:null}});if(!update.count)throw fail('Schedule is already claimed or changed; refresh',409);changed(u.id);return {ok:true};
 }
 if(path==='/auto-reply-rules'&&method==='GET')return (await state(u)).rules;
 if(path==='/auto-reply-rules'&&method==='POST'){await premium(u,'autoReply');const v=ruleSchema.parse(b);validateRuleSelection(v,u);validTimezone(v.timezone);const x=await db.autoRule.create({data:{userId:u.id,data:seal(v)}});changed(u.id);return {...v,id:x.id};}
 if(path.startsWith('/auto-reply-rules/')){await premium(u,'autoReply');const id=path.split('/')[2],x=await db.autoRule.findFirst({where:{id,userId:u.id}});if(!x)throw fail('Rule not found',404);if(method==='DELETE')await db.autoRule.delete({where:{id}});else if(method==='PATCH'){const v=ruleSchema.parse({...unseal(x.data),...b});validateRuleSelection(v,u);validTimezone(v.timezone);await db.autoRule.update({where:{id},data:{data:seal(v)}});}else throw fail('Method not allowed',405);changed(u.id);return {ok:true};}
 if(path==='/events/conversation-state'&&method==='POST'){
  await premium(u);
  const v=z.object({contact:contactSchema,message:z.object({key:z.string().min(1).max(200),direction:z.enum(['in','out']),at:z.number().int().positive()}),live:z.boolean().default(false)}).parse(b);await contact(u.id,v.contact);const where={userId_key:{userId:u.id,key:v.contact.key}};
  return db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id+'|'+v.contact.key}))`;
   const old=await tx.conversation.findUnique({where});const incoming=old?.lastIncomingAt?.getTime()||0,outgoing=old?.lastOutgoingAt?.getTime()||0;
   if(v.message.at>Date.now()+60000)throw fail('Message time invalid');
   if(v.message.direction==='in'&&old?.lastIncomingKey===v.message.key)return {ok:true,first:false,at:incoming};
   const previous=v.message.direction==='in'?incoming:outgoing;
   if(!v.live&&v.message.at<=previous)return {ok:true,first:false,at:previous};
   if(v.live&&v.message.at<Date.now()-120000)throw fail('Live event is too old; open the latest messages');
   const at=v.live?Math.max(v.message.at,incoming+1,outgoing+1):v.message.at;
   const data=v.message.direction==='in'?{lastIncomingKey:v.message.key,lastIncomingAt:new Date(at)}:{lastOutgoingAt:new Date(at)};
   await tx.conversation.upsert({where,create:{userId:u.id,key:v.contact.key,...data},update:data});
   if(v.message.direction==='out'&&at>=incoming)await tx.schedule.updateMany({where:{userId:u.id,contactKey:v.contact.key,kind:'auto',status:{in:['queued','ready','needs-whatsapp-open']}},data:{status:'cancelled',error:'Manual reply observed'}});
   if(v.message.direction==='in')await tx.schedule.updateMany({where:{userId:u.id,contactKey:v.contact.key,kind:'auto',incomingKey:{not:v.message.key},status:{in:['queued','ready','needs-whatsapp-open']}},data:{status:'cancelled',error:'Replaced by newer incoming message'}});
   return {ok:true,first:!old?.lastIncomingAt&&v.message.direction==='in',at};
  });
 }
 if(path==='/auto/prepare'&&method==='POST'){
  await premium(u,'autoReply');const v=z.object({contact:contactSchema,message:z.object({key:z.string().min(1).max(200),body:z.string().min(1).max(4000),at:z.number().int().positive()}),first:z.boolean().default(false)}).parse(b);
  const settings={...defaultSettings,...obj(u.settings)};if(settings.autoPaused)return {queued:false,reason:'paused'};const c:Chat={...v.contact,unread:0,mention:false,lastDirection:'in',lastAt:v.message.at,preview:'',verified:true};const m:Message={...v.message,contactKey:c.key,direction:'in'};
  const rules=(await db.autoRule.findMany({where:{userId:u.id}})).map(x=>readRecord(()=>({...unseal(x.data),id:x.id}) as Rule,[],"Auto rule")).filter((x):x is Rule=>!!x);
  const rule=rules.find(r=>ruleMatches(r,c,m,settings,v.first));if(!rule)return {queued:false,reason:settings.excludedKeys.includes(c.key)||rules.some(r=>r.contactKeys.includes(c.key)&&r.excludedKeys.includes(c.key))?'excluded':'no-matching-rule'};
  return db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id+'|'+c.key}))`;
   const cv=await tx.conversation.findUnique({where:{userId_key:{userId:u.id,key:c.key}}});if(!cv||cv.lastIncomingKey!==m.key||(cv.lastOutgoingAt&&cv.lastOutgoingAt.getTime()>=m.at))return {queued:false,reason:'incoming-answered-or-changed'};
   const now=Date.now(),idempotencyKey=`auto:${u.id}:${m.key}`;
   const existing=await tx.schedule.findUnique({where:{idempotencyKey}});
   if(existing)return {queued:['queued','ready','sending','needs-whatsapp-open'].includes(existing.status),reason:['queued','ready','sending','needs-whatsapp-open'].includes(existing.status)?'queued':'already-handled',dueAt:existing.dueAt.toISOString(),id:existing.id};
   if(now-m.at>120000||m.at>now+60000)return {queued:false,reason:'old-message-time'};
   const history=await deliveryHistory(tx,u.id,now),dueAt=new Date(now+(rule.trigger==='unanswered'?Math.max(rule.delayMinutes*60000,(settings.autoReplyDelaySeconds||10)*1000):(settings.autoReplyDelaySeconds||10)*1000));
   const wait=jobWait({kind:'auto',contactKey:c.key,ruleId:rule.id},settings,[rule],{...history,busy:false},dueAt.getTime());
   if(wait&&wait.until>=dueAt.getTime()+AUTO_REPLY_FRESH_MS){
    const today=localClock(now,rule.timezone).date,used=history.autoAttempts.filter(a=>a.contactKey===c.key&&localClock(a.at,rule.timezone).date===today).length;
    return {queued:false,reason:wait.reasons?.includes('Auto reply contact daily limit')?'rule-daily-cap':wait.reasons?.includes('Auto reply contact cooldown')?'rule-cooldown':'delivery-limit',ruleId:rule.id,retryAt:new Date(wait.until).toISOString(),blockers:wait.reasons,detail:`${(wait.reasons||[wait.reason]).join('; ')}. Auto attempts to this contact: ${used}/${rule.dailyCap} today. Next eligible: ${new Date(wait.until).toLocaleString('en-IN',{timeZone:settings.timezone})} (${settings.timezone}). A NEW incoming message is required then; this old reply will not be replayed.`};
   }
   const data={contact:v.contact,body:rule.response,dueAt:dueAt.toISOString(),repeat:'none',repeatDays:1,timezone:rule.timezone,consent:true};
   const created=await tx.schedule.create({data:{userId:u.id,data:seal(data),contactKey:v.contact.key,dueAt,kind:'auto',incomingKey:m.key,ruleId:rule.id,idempotencyKey}});
   return {queued:true,reason:'queued',id:created.id,dueAt:dueAt.toISOString(),waitReason:wait?.reason,waitReasons:wait?.reasons,waitUntil:wait?new Date(wait.until).toISOString():undefined};
  });
 }
 if(path==='/jobs/ready'&&method==='GET'){
  await premium(u);const now=Date.now();
  await db.schedule.updateMany({where:{userId:u.id,kind:'auto',status:{in:['queued','ready','needs-whatsapp-open']},dueAt:{lt:new Date(now-AUTO_REPLY_FRESH_MS)}},data:{status:'cancelled',error:'Automatic reply expired. A new incoming message is required.'}});
  const [jobs,history,ruleRows]=await Promise.all([db.schedule.findMany({where:{userId:u.id,status:{in:['queued','ready','needs-whatsapp-open']},dueAt:{lte:new Date(now)}},orderBy:{dueAt:'asc'}}),deliveryHistory(db,u.id,now),db.autoRule.findMany({where:{userId:u.id}})]);
  const settings={...defaultSettings,...obj(u.settings)},rules=ruleRows.map(x=>readRecord(()=>({...unseal(x.data),id:x.id}) as Rule,[],"Auto rule")).filter((x):x is Rule=>!!x);
  // Deferred jobs must not occupy all 20 slots and starve eligible contacts.
  return jobs.map(x=>readRecord(()=>decorateJob(scheduleOut(x),x,settings,rules,history,now),[],"Schedule")).filter((x):x is NonNullable<typeof x>=>!!x).sort((a,b)=>Number(!!a.waitUntil)-Number(!!b.waitUntil)).slice(0,20);
 }
 if(path==='/jobs/claim'&&method==='POST'){
  const id=z.string().uuid().parse(b.id),deviceId=deviceSchema.parse(b.deviceId);const x=await db.schedule.findFirst({where:{id,userId:u.id}});if(!x)throw fail('Job missing',404);await premium(u,x.kind==='auto'?'autoReply':'scheduling');
  const v=unseal(x.data);if(b.contactKey!==v.contact.key)throw fail('Target identity mismatch',409);
  const result=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'send:'+u.id}))`;
   const job=await tx.schedule.findFirst({where:{id,userId:u.id}}),now=Date.now();if(!job||!canClaim(job.status,job.dueAt,now))throw fail('Already claimed or not due',409);
   const fresh=await tx.user.findUniqueOrThrow({where:{id:u.id}}),settings={...defaultSettings,...obj(fresh.settings)};
   if(!licenseStatus(fresh).premium)throw fail('Active trial or lifetime access required',402);
   const data=unseal(job.data);
   if(settings.excludedKeys.includes(job.contactKey))throw fail('Contact excluded in Settings. Message not sent.',409);
   if(data.followupId){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id+'|followup:'+data.followupId}))`;const f=await tx.followup.findFirst({where:{id:data.followupId,userId:u.id}});if(!f||!['pending','snoozed'].includes(f.status)||!sameReminderRecipient(unseal(f.data).contact,data.contact)){await tx.schedule.update({where:{id},data:{status:'cancelled',error:'Follow-up completed or cancelled'}});return {cancelled:true};}}
   let ruleData:Rule|undefined;
   if(job.kind==='auto'){
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id+'|'+job.contactKey}))`;
    const rule=await tx.autoRule.findFirst({where:{id:job.ruleId||'',userId:u.id}}),cv=await tx.conversation.findUnique({where:{userId_key:{userId:u.id,key:job.contactKey}}});
    ruleData=rule?{...unseal(rule.data),id:rule.id}:undefined;
    const invalid=settings.autoPaused||!ruleData?.enabled||ruleData.excludedKeys.includes(job.contactKey)||!inWindow(now,ruleData.timezone,ruleData.days,ruleData.start,ruleData.end)||(ruleData.trigger==='outside-hours'&&inWindow(now,settings.timezone,settings.workingDays,settings.workingStart,settings.workingEnd))||!cv||cv.lastIncomingKey!==job.incomingKey||!!(cv.lastOutgoingAt&&cv.lastIncomingAt&&cv.lastOutgoingAt>=cv.lastIncomingAt);
    if(invalid||now>=job.dueAt.getTime()+AUTO_REPLY_FRESH_MS){const error=invalid?'Auto reply paused, answered or superseded':'Automatic reply expired. A new incoming message is required.';await tx.schedule.updateMany({where:{id,userId:u.id,status:job.status,attempt:job.attempt},data:{status:'cancelled',error}});return {cancelled:true,error};}
   }
   const history=await deliveryHistory(tx,u.id,now),wait=jobWait({...job,repeat:data.repeat,repeatWeekdays:data.repeatWeekdays,timezone:data.timezone,dueAt:data.dueAt},settings,ruleData?[ruleData]:[],history,now);
   if(wait&&job.kind==='auto'&&wait.until>=job.dueAt.getTime()+AUTO_REPLY_FRESH_MS){const error=`Auto reply not sent: ${(wait.reasons||[wait.reason]).join('; ')}. A new incoming message is required after ${new Date(wait.until).toLocaleString('en-IN',{timeZone:settings.timezone})} (${settings.timezone}).`;await tx.schedule.updateMany({where:{id,userId:u.id,status:job.status,attempt:job.attempt},data:{status:'cancelled',error}});return {cancelled:true,error};}
   if(wait){const error=`Waiting: ${(wait.reasons||[wait.reason]).join('; ')}. Next attempt after ${new Date(wait.until).toLocaleString('en-IN',{timeZone:settings.timezone,hour12:true})} (${settings.timezone}).`;const paused=await tx.schedule.updateMany({where:{id,userId:u.id,status:job.status,attempt:job.attempt,dueAt:job.dueAt},data:{status:'needs-whatsapp-open',error}});if(!paused.count)throw fail('Job changed before timing check; refresh',409);return {wait,error};}
   const leaseToken=randomUUID();const updated=await tx.schedule.updateMany({where:{id,userId:u.id,status:job.status,attempt:job.attempt,dueAt:job.dueAt},data:{status:'sending',error:null,leaseToken,leaseAt:new Date(now),deviceId,attempt:{increment:1}}});if(!updated.count)throw fail('Job changed before claim; refresh',409);const claimed=await tx.schedule.findUniqueOrThrow({where:{id}});
   await tx.audit.create({data:{userId:u.id,action:'send-start',target:id,result:job.contactKey,at:new Date(now)}});return {job:scheduleOut(claimed),leaseToken};
  });
  if('wait' in result&&result.wait)throw Object.assign(fail(result.error!,409),{retryAfter:Math.max(1,Math.ceil((result.wait.until-Date.now())/1000))});
  if('cancelled' in result)throw fail(result.error||'Follow-up completed or cancelled',409);
  changed(u.id);return result;
 }
 if(path==='/jobs/complete'&&method==='POST'){
  const v=z.object({id:z.string().uuid(),leaseToken:z.string().uuid(),status:z.enum(['sent','failed','unknown']),error:z.string().max(500).optional()}).parse(b);
  await db.$transaction(async tx=>{const x=await tx.schedule.findFirst({where:{id:v.id,userId:u.id,status:'sending',leaseToken:v.leaseToken}});if(!x)throw fail('Lease expired',409);await tx.schedule.update({where:{id:x.id},data:{status:v.status,sentAt:v.status==='sent'?new Date():null,error:v.status==='sent'?null:v.error||null}});if(v.status==='sent'){const d=unseal(x.data),n=nextOccurrence(d.dueAt,d.repeat,d.repeatDays,d.timezone,Date.now(),d.repeatWeekdays);if(n)await tx.schedule.create({data:{userId:u.id,data:seal({...d,dueAt:n}),contactKey:d.contact.key,dueAt:new Date(n),idempotencyKey:`repeat:${x.id}:${n}`}});}await tx.audit.create({data:{userId:u.id,action:'send-result',target:x.id,result:v.status}});});changed(u.id);return {ok:true};
 }
 if(path==='/jobs/unavailable'&&method==='POST'){const id=z.string().uuid().parse(b.id);await db.schedule.updateMany({where:{id,userId:u.id,status:{in:['queued','ready','needs-whatsapp-open']}},data:{status:'needs-whatsapp-open',error:b.reason===undefined?'Keep WhatsApp active; the extension will find your verified target automatically.':z.string().min(1).max(400).parse(b.reason)}});return {ok:true};}
 if(path==='/extension/heartbeat'&&method==='POST'){const id=deviceSchema.parse(b.deviceId);const owned=await db.device.findUnique({where:{id}});if(owned&&owned.userId!==u.id)throw fail('Device already belongs to another user',409);await db.device.upsert({where:{id},create:{id,userId:u.id,version:typeof b.version==='string'?b.version.slice(0,20):'1.4.13',health:obj(b.health)},update:{lastSeen:new Date(),version:typeof b.version==='string'?b.version.slice(0,20):'1.4.13',health:obj(b.health)}});return {ok:true};}
 if(path==='/reminders/due'&&method==='GET'){if(!licenseStatus(u).premium)return [];return (await db.followup.findMany({where:{userId:u.id,status:{in:['pending','snoozed']},reminderAt:{lte:new Date()}}})).map(x=>readRecord(()=>followupOut(x),[],"Follow-up")).filter(Boolean);}
 if(path==='/billing/create-payment'&&method==='POST'){limit('checkout:'+u.id,6);return createLifetimePayment(db,razorpay,u);}
 if(path==='/billing/create-subscription')throw fail('Update the extension: billing is INR 1000 once for lifetime access.',410);
 if(path==='/billing/check'&&method==='POST'){limit('payment-check:'+u.id,6);const row=await db.lifetimePayment.findFirst({where:{userId:u.id},orderBy:{createdAt:'desc'}});if(!row)return {status:u.subscriptionStatus==='lifetime'?'paid':'no-payment',plan:'lifetime'};const result=await reconcileLifetimePayment(db,razorpay,row);changed(u.id);return result;}
 if(path==='/billing/cancel'&&method==='POST'){if(!u.providerId)throw fail('No subscription');await razorpay(`/subscriptions/${u.providerId}/cancel`,{cancel_at_cycle_end:1});await db.lifetimePayment.updateMany({where:{userId:u.id,status:'paid'},data:{legacyCancelled:true}});return {ok:true};}
 if(path.startsWith('/admin')){
  if(!u.admin)throw fail('Admin access required',403);
  if(path==='/admin/overview'&&method==='GET'){const users=await db.user.findMany({select:{id:true,email:true,name:true,trialEnd:true,periodEnd:true,subscriptionStatus:true,disabled:true,supportNote:true,createdAt:true}});return {users:users.map(x=>({...x,license:licenseStatus(x)})),devices:await db.device.findMany({orderBy:{lastSeen:'desc'},take:100}),audit:await db.audit.findMany({orderBy:{at:'desc'},take:100}),payments:await db.lifetimePayment.findMany({orderBy:{createdAt:'desc'},take:100}),webhooks:await db.webhook.findMany({orderBy:{createdAt:'desc'},take:100}),flags:await db.featureFlag.findUnique({where:{id:'global'}})};}
  if(path==='/admin/flags'&&method==='PATCH'){const v=z.object({scheduling:z.boolean(),autoReply:z.boolean()}).parse(b);await db.featureFlag.upsert({where:{id:'global'},create:{id:'global',...v},update:v});await audit(u.id,'feature-flags','global',JSON.stringify(v));return {ok:true};}
  if(path.startsWith('/admin/users/')&&method==='PATCH'){const id=path.split('/')[3],v=z.object({disabled:z.boolean().optional(),supportNote:z.string().max(2000).optional()}).refine(x=>x.disabled!==undefined||x.supportNote!==undefined).parse(b);if(id===u.id&&v.disabled)throw fail('Cannot disable your own admin');await db.user.update({where:{id},data:{...v,...(v.disabled!==undefined?{tokenVersion:{increment:1}}:{})}});await audit(u.id,'user-support',id,v.disabled!==undefined?(v.disabled?'disabled':'restored'):'support-note-updated');return {ok:true};}
 }
 throw fail('Endpoint not found',404);
}
function validTimezone(tz:string){try{new Intl.DateTimeFormat('en',{timeZone:tz});}catch{throw fail('Invalid timezone');}}
async function razorpay(path:string,body?:unknown){const key=process.env.RAZORPAY_KEY_ID,s=process.env.RAZORPAY_KEY_SECRET;if(!key||!s)throw fail('Set Razorpay test/live keys on server',503);const r=await fetch((process.env.NODE_ENV==='test'&&process.env.QA_RAZORPAY_URL||'https://api.razorpay.com/v1')+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(key+':'+s).toString('base64'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const j=await r.json() as any;if(!r.ok)throw fail(j.error?.description||'Payment provider unavailable',502);return j;}
@Controller()
class ApiController {
 @All('{*path}') async handle(@Req() req:Request,@Res() res:Response){try{res.json(await dispatch(req));}catch(e:any){if(e instanceof z.ZodError)return res.status(400).json({error:e.issues.map((x:any)=>x.path.join('.')+': '+x.message).join('; ')});const result=errorResponse(e),requestId=randomUUID();if(result.status===429)res.setHeader('Retry-After',String(e.retryAfter||60));if(result.status>=500)console.error('API failure',{requestId,path:req.path,code:e.code||'UNCLASSIFIED',name:e.name||'Error'});return res.status(result.status).json({...result,requestId,...(e.retryAfter?{retryAfter:e.retryAfter}:{})});}}
}
@Module({controllers:[ApiController]})class ApiModule{}
const app=await NestFactory.create(ApiModule,{rawBody:true});app.use(helmet());
if(process.env.TRUST_PROXY==='loopback')app.getHttpAdapter().getInstance().set('trust proxy','loopback');
const origins=(process.env.CORS_ORIGINS||'http://localhost:5173,http://localhost:5174').split(',');
app.enableCors({origin:(origin:string|undefined,cb:any)=>cb(null,!origin||origins.includes(origin)||/^chrome-extension:\/\/[a-p]{32}$/.test(origin)),credentials:false});
await app.listen(Number(process.env.PORT||4000),'0.0.0.0');
io=new Server(app.getHttpServer(),{cors:{origin:origins}});io.use(async(socket,next)=>{try{const u=await auth(socket.handshake.auth.token||'');socket.data.userId=u.id;next();}catch{next(Error('Unauthorized'));}});io.on('connection',socket=>socket.join(socket.data.userId));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();await db.$disconnect();process.exit(0);});
