import {autoReplyWait,dayBounds,deliveryWait,inWindow,localClock,nextOccurrence,AUTO_REPLY_FRESH_MS,type Rule,type Settings,type Schedule} from '../../../packages/shared/src/index.ts';
import type {SendAttempt,DeliveryWait} from '../../../packages/shared/src/send-timing.ts';

export async function deliveryHistory(client:any,userId:string,now=Date.now()){
 const since=new Date(now-8*86400000);
 const [audits,rows,busy]=await Promise.all([
  client.audit.findMany({where:{userId,action:'send-start',at:{gte:since}},orderBy:{at:'desc'}}),
  client.schedule.findMany({where:{userId,OR:[{leaseAt:{gte:since}},{sentAt:{gte:since}}]},select:{id:true,kind:true,contactKey:true,leaseAt:true,sentAt:true}}),
  client.schedule.findFirst({where:{userId,status:'sending'},select:{id:true}})
 ]);
 const audited=new Set(audits.map((a:any)=>a.target)),autoIds=new Set(rows.filter((x:any)=>x.kind==='auto').map((x:any)=>x.id));
 const attempts:SendAttempt[]=audits.map((a:any)=>({at:a.at.getTime(),contactKey:a.result}));
 const autoAttempts:SendAttempt[]=audits.filter((a:any)=>autoIds.has(a.target)).map((a:any)=>({at:a.at.getTime(),contactKey:a.result}));
 // Unclassified historical audits count as scheduled attempts, keeping older data conservative.
 const scheduledAttempts:SendAttempt[]=audits.filter((a:any)=>!autoIds.has(a.target)).map((a:any)=>({at:a.at.getTime(),contactKey:a.result}));
 for(const row of rows.filter((x:any)=>!audited.has(x.id))){const attempt={at:(row.leaseAt||row.sentAt).getTime(),contactKey:row.contactKey};attempts.push(attempt);if(row.kind==='auto')autoAttempts.push(attempt);else scheduledAttempts.push(attempt);}
 return {attempts,autoAttempts,scheduledAttempts,busy:!!busy};
}
export type DeliveryHistory={attempts:SendAttempt[];autoAttempts:SendAttempt[];scheduledAttempts?:SendAttempt[];busy:boolean};
export function jobWait(job:{kind:string;contactKey:string;ruleId?:string|null;repeat?:string;repeatWeekdays?:number[];timezone?:string;dueAt?:string|Date},settings:Settings,rules:Rule[],history:DeliveryHistory,now=Date.now()):DeliveryWait|null {
 const separate=settings.contactLimitMode!=='shared',contactPolicy=separate?(job.kind==='auto'?{skip:true}:{attempts:history.scheduledAttempts||history.attempts}):{};
 const global=deliveryWait(settings,history.attempts,job.contactKey,now,history.busy,contactPolicy),rule=job.kind==='auto'?rules.find(r=>r.id===job.ruleId):null;
 const local=rule?autoReplyWait(rule,history.autoAttempts,job.contactKey,now):null;
 const weekdayMode=job.kind==='scheduled'&&job.repeat==='weekdays';
 const calendar=(at:number):DeliveryWait|null=>{
  if(!weekdayMode)return null;
  const days=job.repeatWeekdays||[],tz=job.timezone||settings.timezone;
  if(days.includes(localClock(at,tz).day))return null;
  const due=job.dueAt instanceof Date?job.dueAt.toISOString():job.dueAt||new Date(now).toISOString();
  return {reason:'Outside selected weekdays',until:Date.parse(nextOccurrence(due,'weekdays',1,tz,at,days)!)};
 };
 const dateWait=calendar(now),wait=[global,local,dateWait].filter((w):w is DeliveryWait=>!!w).sort((a,b)=>b.until-a.until)[0];
 if(wait){const reasons=[...(global?.reasons||[global?.reason]),local?.reason,dateWait?.reason].filter((r):r is string=>!!r);
  // A quota or quiet-hours delay must not move a custom-weekday message onto an unselected day.
  for(let i=0;i<(weekdayMode?16:1);i++){
   const later=[deliveryWait(settings,history.attempts,job.contactKey,wait.until,false,contactPolicy),calendar(wait.until)].filter((w):w is DeliveryWait=>!!w);
   reasons.push(...later.flatMap(w=>w.reasons||[w.reason]));const until=Math.max(wait.until,...later.map(w=>w.until));if(until===wait.until)break;wait.until=until;
  }
  wait.reasons=[...new Set(reasons)];}
 return wait||null;
}
export function decorateJob(job:Schedule,row:any,settings:Settings,rules:Rule[],history:DeliveryHistory,now=Date.now()):Schedule {
 if(!['queued','ready','needs-whatsapp-open'].includes(job.status))return job;
 const at=Math.max(now,row.dueAt.getTime()),wait=jobWait({...row,repeat:job.repeat,repeatWeekdays:job.repeatWeekdays,timezone:job.timezone,dueAt:job.dueAt},settings,rules,{...history,busy:history.busy&&at<now+30000},at);
 return {...job,error:job.error?.startsWith('Waiting:')?undefined:job.error,waitReason:wait?.reason,waitReasons:wait?.reasons,waitUntil:wait?new Date(wait.until).toISOString():undefined,expiresAt:row.kind==='auto'?new Date(row.dueAt.getTime()+AUTO_REPLY_FRESH_MS).toISOString():undefined};
}
export function deliveryInfo(settings:Settings,history:DeliveryHistory,now=Date.now()){
 const date=localClock(now,settings.timezone).date,quietActive=!!settings.quietHoursEnabled&&inWindow(now,settings.timezone,[0,1,2,3,4,5,6],settings.quietStart||'22:00',settings.quietEnd||'08:00');
 const quiet=quietActive?deliveryWait(settings,[],'',now):null;
 return {checkedAt:new Date(now).toISOString(),timezone:settings.timezone,todayAttempts:history.attempts.filter(a=>localClock(a.at,settings.timezone).date===date).length,dailyLimit:settings.sendDailyCap||50,resetAt:new Date(dayBounds(now,settings.timezone).end).toISOString(),quietActive,quietUntil:quiet?new Date(quiet.until).toISOString():undefined};
}
