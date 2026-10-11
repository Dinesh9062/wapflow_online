import {inWindow,localClock,type Settings,type Rule} from './index.ts';
import {z} from 'zod';
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const deliverySettingsSchema=z.object({
 sendGapSeconds:z.number().int().min(10).max(3600),
 sendDailyCap:z.number().int().min(1).max(200),
 sendContactCooldownMinutes:z.number().int().min(1).max(10080),
 sendContactDailyCap:z.number().int().min(1).max(50),
 autoReplyDelaySeconds:z.number().int().min(5).max(300),
 contactLimitMode:z.enum(['auto-rule','shared']),
 backgroundSending:z.boolean(),
 quietHoursEnabled:z.boolean(),quietStart:time,quietEnd:time
});
export const defaultDeliverySettings={sendGapSeconds:30,sendDailyCap:50,sendContactCooldownMinutes:10,sendContactDailyCap:3,autoReplyDelaySeconds:10,contactLimitMode:'auto-rule' as const,backgroundSending:true,quietHoursEnabled:false,quietStart:'22:00',quietEnd:'08:00'};
export type DeliverySettings=z.infer<typeof deliverySettingsSchema>;
export type SendAttempt={at:number;contactKey:string};
export type DeliveryWait={reason:string;until:number;reasons?:string[]};
export const AUTO_REPLY_FRESH_MS=300000;
export function autoReplyWait(rule:Rule,attempts:SendAttempt[],contactKey:string,now=Date.now()):DeliveryWait|null {
 const same=attempts.filter(a=>a.contactKey===contactKey&&a.at<=now),latest=Math.max(0,...same.map(a=>a.at));
 const today=localClock(now,rule.timezone).date;
 if(same.filter(a=>localClock(a.at,rule.timezone).date===today).length>=rule.dailyCap)return {reason:'Auto reply contact daily limit',until:dayBounds(now,rule.timezone).end};
 if(latest&&now<latest+rule.cooldownMinutes*60000)return {reason:'Auto reply contact cooldown',until:latest+rule.cooldownMinutes*60000};
 return null;
}
export function dayBounds(at:number,timezone:string){
 const date=localClock(at,timezone).date;
 const boundary=(lo:number,hi:number,after:boolean)=>{while(hi-lo>1){const mid=Math.floor((lo+hi)/2),same=localClock(mid,timezone).date===date;if(after?same:!same)lo=mid;else hi=mid;}return hi;};
 return {start:boundary(at-36*3600000,at,false),end:boundary(at,at+36*3600000,true)};
}
export function deliveryWait(settings:Settings,attempts:SendAttempt[],contactKey:string,now=Date.now(),busy=false,contactPolicy:{attempts?:SendAttempt[];skip?:boolean}={}):DeliveryWait|null {
 const s={...defaultDeliverySettings,...settings},waits:DeliveryWait[]=[];
 if(busy)waits.push({reason:'Another message is being sent',until:now+30000});
 if(s.quietHoursEnabled&&inWindow(now,s.timezone,[0,1,2,3,4,5,6],s.quietStart,s.quietEnd)){
  let until=now-now%60000+60000;
  for(let i=0;i<1620&&inWindow(until,s.timezone,[0,1,2,3,4,5,6],s.quietStart,s.quietEnd);i++)until+=60000;
  waits.push({reason:'Quiet hours',until});
 }
 const latest=Math.max(0,...attempts.map(a=>a.at)),same=(contactPolicy.attempts||attempts).filter(a=>a.contactKey===contactKey),contactLatest=Math.max(0,...same.map(a=>a.at));
 if(latest&&now<latest+s.sendGapSeconds*1000)waits.push({reason:'Message gap',until:latest+s.sendGapSeconds*1000});
 if(!contactPolicy.skip&&contactLatest&&now<contactLatest+s.sendContactCooldownMinutes*60000)waits.push({reason:'Contact cooldown',until:contactLatest+s.sendContactCooldownMinutes*60000});
 const date=localClock(now,s.timezone).date,today=attempts.filter(a=>localClock(a.at,s.timezone).date===date);
 if(today.length>=s.sendDailyCap)waits.push({reason:'Daily message limit',until:dayBounds(now,s.timezone).end});
 if(!contactPolicy.skip&&same.filter(a=>localClock(a.at,s.timezone).date===date).length>=s.sendContactDailyCap)waits.push({reason:'Contact daily limit',until:dayBounds(now,s.timezone).end});
 const wait=waits.sort((a,b)=>b.until-a.until)[0];
 if(wait)wait.reasons=[...new Set(waits.map(w=>w.reason))];
 // A daily reset or cooldown may end inside quiet hours, even if it is daytime now.
 if(wait&&s.quietHoursEnabled){if(inWindow(wait.until,s.timezone,[0,1,2,3,4,5,6],s.quietStart,s.quietEnd)&&!wait.reasons!.includes('Quiet hours'))wait.reasons!.push('Quiet hours');for(let i=0;i<1620&&inWindow(wait.until,s.timezone,[0,1,2,3,4,5,6],s.quietStart,s.quietEnd);i++)wait.until=wait.until-wait.until%60000+60000;}
 return wait||null;
}
