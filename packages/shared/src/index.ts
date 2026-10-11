import { z } from 'zod';
import {defaultDeliverySettings,type DeliverySettings} from './send-timing.ts';
export {defaultDeliverySettings,deliverySettingsSchema,deliveryWait,dayBounds,autoReplyWait,AUTO_REPLY_FRESH_MS} from './send-timing.ts';
export const filters = ['All','Unread','Chats','Groups','Mentions','Awaiting Reply','Follow-ups','Scheduled'] as const;
export type Filter = typeof filters[number];
export type Chat = {key:string;name:string;type:'individual'|'group'|'unknown';unread:number;mention:boolean;lastDirection:'in'|'out'|'unknown';lastAt:number;lastMessageKey?:string;lastMessageObservedAt?:number;preview:string;verified:boolean;identityMode?:'jid'|'visible-bound'; self?:boolean; snoozedUntil?:number;mentionAt?:number;mentionKey?:string;mentionReplyAt?:number;mentionReplyKey?:string;mentionUpdatedAt?:number;nativeMentionActive?:boolean};
export type Message = {key:string;contactKey:string;body:string;direction:'in'|'out';at:number;senderName?:string;senderKey?:string;mentionedMe?:boolean};
export const contactSchema = z.object({key:z.string().min(3).max(160),name:z.string().min(1).max(150),type:z.enum(['individual','group','unknown'])});
const repeatWeekdays=z.array(z.number().int().min(0).max(6)).max(7).transform(days=>[...new Set(days)].sort()).optional();
function validateRecurrence(v:{repeat:string;repeatWeekdays?:number[];dueAt:string;timezone:string},ctx:z.RefinementCtx){
 if(v.repeat!=='weekdays')return;
 if(!v.repeatWeekdays?.length){ctx.addIssue({code:'custom',path:['repeatWeekdays'],message:'Choose at least one custom weekday'});return;}
 try{if(!v.repeatWeekdays.includes(localClock(Date.parse(v.dueAt),v.timezone).day))ctx.addIssue({code:'custom',path:['dueAt'],message:'Choose the first date on a selected weekday'});}catch{/* API validates the timezone separately. */}
}
const repeatSchema = z.enum(['none','daily','weekly','custom','weekdays']);
export const followupSchema = z.object({contact:contactSchema,messageKey:z.string().max(200).optional(),subject:z.object({name:z.string().min(1).max(150),key:z.string().max(160).optional()}).optional(),note:z.string().min(1).max(2000),dueAt:z.iso.datetime(),priority:z.enum(['low','normal','high']).default('normal'),reminderMinutes:z.number().int().min(0).max(10080).default(0),repeat:repeatSchema.default('none'),repeatWeekdays,repeatDays:z.number().int().min(1).max(365).default(1),timezone:z.string().default('Asia/Kolkata')}).superRefine(validateRecurrence);
export const scheduleSchema = z.object({followupId:z.uuid().optional(),contact:contactSchema,messageKey:z.string().max(200).optional(),body:z.string().min(1).max(4000),dueAt:z.iso.datetime(),repeat:repeatSchema.default('none'),repeatWeekdays,repeatDays:z.number().int().min(1).max(365).default(1),timezone:z.string().default('Asia/Kolkata'),consent:z.literal(true)}).superRefine(validateRecurrence);
export const ruleSchema = z.object({name:z.string().min(1).max(100),trigger:z.enum(['keyword','first','outside-hours','unanswered','contact']),keywords:z.array(z.string().min(1).max(100)).max(20).default([]),response:z.string().min(1).max(4000),days:z.array(z.number().int().min(0).max(6)).min(1),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),timezone:z.string().default('Asia/Kolkata'),cooldownMinutes:z.number().int().min(1).max(10080).default(30),dailyCap:z.number().int().min(1).max(50).default(3),delayMinutes:z.number().int().min(1).max(1440).default(5),contactKeys:z.array(z.string()).default([]),excludedKeys:z.array(z.string()).default([]),allowGroups:z.boolean().default(false),enabled:z.boolean().default(false)}).superRefine((r,ctx)=>{if(r.enabled&&r.trigger==='keyword'&&!r.keywords.length)ctx.addIssue({code:'custom',path:['keywords'],message:'Keyword rule ke liye kam se kam ek keyword chahiye'});if(r.enabled&&r.trigger==='contact'&&!r.contactKeys.length)ctx.addIssue({code:'custom',path:['contactKeys'],message:'Contact-specific rule mein contact ko checkbox se select karein'});});
export type Followup = z.infer<typeof followupSchema>&{id:string;status:'pending'|'snoozed'|'done'|'cancelled';notified?:boolean};
export type ScheduleStatus = 'queued'|'ready'|'sending'|'sent'|'failed'|'needs-whatsapp-open'|'cancelled'|'unknown';
export type Schedule = z.infer<typeof scheduleSchema>&{id:string;status:ScheduleStatus;sentAt?:string;error?:string;kind?:'scheduled'|'auto';incomingKey?:string;attempt?:number;waitReason?:string;waitReasons?:string[];waitUntil?:string;expiresAt?:string};
export type Rule = z.infer<typeof ruleSchema>&{id:string};
export type Settings = Partial<DeliverySettings>&{timezone:string;graceMinutes:number;awaitingReplyMode?:'outgoing'|'incoming';notifications:boolean;autoPaused:boolean;excludedKeys:string[];workingStart:string;workingEnd:string;workingDays:number[];apiUrl:string;accountNamespace:string;ownPhone?:string;dateOrder?:'DMY'|'MDY';autoReadUnread?:boolean;mentionAliases?:string[]};
export const defaultSettings:Settings={...defaultDeliverySettings,timezone:'Asia/Kolkata',graceMinutes:30,awaitingReplyMode:'outgoing',notifications:true,autoPaused:true,excludedKeys:[],workingStart:'09:00',workingEnd:'18:00',workingDays:[1,2,3,4,5],apiUrl:'http://localhost:4000',accountNamespace:'default',dateOrder:'DMY',ownPhone:'',autoReadUnread:true,mentionAliases:[]};
export type License = {premium:boolean;status:string;trialEnd:string;daysLeft:number;price:number};
export type ConversationBinding={key:string;name:string;type:Chat['type'];messageIds:string[]};
export const freeFilters:readonly Filter[]=['All','Unread','Chats','Groups'];
export function featureAccess(state:State){return !!state.user&&!!state.license?.premium;}
export type DeliveryInfo={checkedAt:string;timezone:string;todayAttempts:number;dailyLimit:number;resetAt:string;quietActive:boolean;quietUntil?:string};
export type State = {serverVersion?:string;autoJobs?:Schedule[];delivery?:DeliveryInfo;directory?:{completedAt:number;count:number};billing?:{legacyRenewal:boolean;lastPayment?:string};dataWarnings?:string[];bindings?:ConversationBinding[];conversations?:Chat[];followups:Followup[];schedules:Schedule[];rules:Rule[];notes:Record<string,string>;settings:Settings;license:License|null;alerts?:Alert[];notificationPermission?:string;user?:{email:string;name:string};flags?:{scheduling:boolean;autoReply:boolean}};
export type Alert={id:string;title:string;message:string;at:number;read:boolean;contact?:z.infer<typeof contactSchema>;messageKey?:string;kind:'followup'|'schedule'|'auto'|'test'|'connection'};
export const initialState:State={followups:[],schedules:[],rules:[],notes:{},settings:defaultSettings,license:null};
export const cleanContactName=(s:string)=>s.replace(/[\u200e\u200f]/g,'').replace(/^\s*\d[\d,]*\s+unread messages?\s*/i,'').replace(/\s+/g,' ').trim();
export const canonicalName=(s:string)=>cleanContactName(s).replace(/\s*\((?:you|आप)\)\s*$/i,'').trim();
export function sameReminderRecipient(a:Pick<Chat,'key'|'name'|'type'>,b:Pick<Chat,'key'|'name'|'type'>){return a.key.split('|')[0]===b.key.split('|')[0]&&(a.type==='unknown'||b.type==='unknown'||a.type===b.type)&&(a.key===b.key||((a.key.includes('|local:')||b.key.includes('|local:'))&&canonicalName(a.name)===canonicalName(b.name)));}
export function recordMatches(c:Chat,target:{key:string;name:string}){return c.key===target.key||((c.key.includes('|local:')||target.key.includes('|local:')||c.key.startsWith('unverified:'))&&canonicalName(c.name)===canonicalName(target.name)&&c.key.split('|')[0]===target.key.split('|')[0]);}
export function matchesFilter(c:Chat,f:Filter,s:State,now=Date.now()):boolean {
 if((c.snoozedUntil||0)>now && f!=='All')return false;
 if(f==='All')return true;
 if(f==='Unread')return c.unread>0;
 if(f==='Chats')return c.type==='individual';
 if(f==='Groups')return c.type==='group';
 if(f==='Mentions')return c.mention;
 if(f==='Awaiting Reply')return !c.self&&c.lastDirection===(s.settings.awaitingReplyMode==='incoming'?'in':'out')&&c.lastAt>0&&now-c.lastAt>=s.settings.graceMinutes*60000;
 if(f==='Follow-ups')return s.followups.some(x=>recordMatches(c,x.contact)&&['pending','snoozed'].includes(x.status));
 return s.schedules.some(x=>recordMatches(c,x.contact)&&['queued','ready','sending','needs-whatsapp-open','failed','unknown'].includes(x.status));
}
export function localClock(at:number,timezone:string){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return {day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),minute:Number(p.hour)*60+Number(p.minute),date:`${p.year}-${p.month}-${p.day}`};
}
const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3));
export function inWindow(at:number,tz:string,days:number[],start:string,end:string){
 const c=localClock(at,tz),a=minutes(start),b=minutes(end);
 if(a===b)return days.includes(c.day);
 if(a<b)return days.includes(c.day)&&c.minute>=a&&c.minute<b;
 return (days.includes(c.day)&&c.minute>=a)||(days.includes((c.day+6)%7)&&c.minute<b);
}
export function ruleMatches(r:Rule,c:Chat,m:Message,settings:Settings,first:boolean,now=Date.now()){
 if(c.self||!r.enabled||settings.autoPaused||m.direction!=='in'||!c.verified||settings.excludedKeys.includes(c.key)||r.excludedKeys.includes(c.key))return false;
 if(c.type==='group'&&(!r.allowGroups||!r.contactKeys.includes(c.key)))return false;
 if(r.contactKeys.length&&!r.contactKeys.includes(c.key))return false;
 if(!inWindow(now,r.timezone,r.days,r.start,r.end))return false;
 if(r.trigger==='keyword')return r.keywords.some(x=>m.body.toLocaleLowerCase().includes(x.toLocaleLowerCase()));
 if(r.trigger==='first')return first;
 if(r.trigger==='outside-hours')return !inWindow(now,settings.timezone,settings.workingDays,settings.workingStart,settings.workingEnd);
 return r.trigger==='contact'||r.trigger==='unanswered';
}
// Calendar-day recurrence in the record's timezone, including DST changes.
export function nextOccurrence(iso:string,repeat:string,custom:number,tz:string,now=Date.now(),weekdays:number[]=[]):string|null {
 if(repeat==='none')return null;
 if(repeat==='weekdays'&&!weekdays.some(d=>Number.isInteger(d)&&d>=0&&d<=6))throw Error('Custom weekdays are missing');
 const step=repeat==='weekly'?7:repeat==='daily'||repeat==='weekdays'?1:custom;
 let n=Date.parse(iso);
 for(let count=0;count<100000;count++){
  const before=localClock(n,tz);let target=n+step*86400000;
  const after=localClock(target,tz);
  let diff=before.minute-after.minute;if(diff>720)diff-=1440;if(diff < -720)diff+=1440;
  target+=diff*60000;n=target;
  if(n>now&&(repeat!=='weekdays'||weekdays.includes(localClock(n,tz).day)))return new Date(n).toISOString();
 }
 throw Error('Repeat date is too old');
}
export function licenseStatus(user:{trialEnd:Date;periodEnd:Date|null;disabled:boolean;subscriptionStatus:string},now=Date.now()):License{
 const lifetime=user.subscriptionStatus==='lifetime';const trial=user.trialEnd.getTime()>now;const paid=Boolean(user.periodEnd&&user.periodEnd.getTime()>now&&['active','cancelled','pending'].includes(user.subscriptionStatus));
 return {premium:!user.disabled&&(lifetime||trial||paid),status:user.disabled?'disabled':lifetime?'lifetime':paid?'paid':trial?'trial':'expired',trialEnd:user.trialEnd.toISOString(),daysLeft:Math.max(0,Math.ceil((user.trialEnd.getTime()-now)/86400000)),price:1000};
}
export function canClaim(status:string,dueAt:Date,now=Date.now()){return ['queued','ready','needs-whatsapp-open'].includes(status)&&dueAt.getTime()<=now;}
