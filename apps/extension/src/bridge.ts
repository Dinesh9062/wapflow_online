import {initialState,defaultSettings,nextOccurrence,inWindow,deliveryWait,dayBounds,type State,type Followup,type Schedule,type Rule} from '../../../packages/shared/src/index.ts';
export interface Bridge {request(type:string,extra?:any):Promise<any>;demo:boolean;}
export class ExtensionBridge implements Bridge {demo=false;async request(type:string,extra:any={}){const r=await chrome.runtime.sendMessage({type,...extra});if(r?.error)throw Object.assign(Error(r.error),{status:r.status,retryAfter:r.retryAfter});return r;}}
export class DemoBridge implements Bridge {
 demo=true;private state:State;
 constructor(){const cached=localStorage.getItem('zfleet-demo-v1');this.state=cached?JSON.parse(cached):seedDemo();this.state.settings={...defaultSettings,...this.state.settings};for(const f of this.state.followups){if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(f.id)){const old=f.id;f.id=crypto.randomUUID();for(const j of this.state.schedules)if(j.followupId===old)j.followupId=f.id;}}}
 private save(){localStorage.setItem('zfleet-demo-v1',JSON.stringify(this.state));}
 async request(type:string,e:any={}){
  if(type==='READ_ALERTS'){this.state.alerts=(this.state.alerts||[]).map(a=>({...a,read:true}));this.save();return {ok:true};}if(type==='TEST_NOTIFICATION'){this.state.alerts=[{id:crypto.randomUUID(),title:'ZFLEET notification test',message:'Demo notification saved',kind:'test',at:Date.now(),read:false},...(this.state.alerts||[])];this.save();return {ok:true};}
  if(type==='STATE'){if(this.state.delivery){const s=this.state.settings,now=Date.now(),quiet=deliveryWait(s,[],'',now);this.state.delivery={...this.state.delivery,checkedAt:new Date(now).toISOString(),timezone:s.timezone,dailyLimit:s.sendDailyCap||50,resetAt:new Date(dayBounds(now,s.timezone).end).toISOString(),quietActive:!!s.quietHoursEnabled&&inWindow(now,s.timezone,[0,1,2,3,4,5,6],s.quietStart||'22:00',s.quietEnd||'08:00'),quietUntil:quiet?new Date(quiet.until).toISOString():undefined};}return structuredClone(this.state);}
  if(type==='LOGIN'||type==='REGISTER'){this.state.user={name:'Demo User',email:e.body.email};this.save();return this.state;}
  if(type==='LOGOUT'){delete this.state.user;this.save();return this.state;}
  if(type!=='API')return {ok:true};const b=e.body||{},p=e.path,id=p.split('/')[2],method=e.method;
  if(p==='/settings')this.state.settings={...this.state.settings,...b};
  else if(p==='/notes')this.state.notes[b.contact.key]=b.text;
  else if(p==='/followups'&&method==='POST')this.state.followups.push({...b,id:crypto.randomUUID(),status:'pending'});
  else if(p.startsWith('/followups/')){const f=this.state.followups.find(x=>x.id===id);if(f){const old=f.status;Object.assign(f,b);if(['done','cancelled'].includes(b.status))for(const j of this.state.schedules)if(j.followupId===f.id&&['queued','ready','needs-whatsapp-open'].includes(j.status))j.status='cancelled';if(b.status==='done'&&old!=='done'){const n=nextOccurrence(f.dueAt,f.repeat,f.repeatDays,f.timezone,Date.now(),f.repeatWeekdays);if(n)this.state.followups.push({...f,id:crypto.randomUUID(),dueAt:n,status:'pending'});}}}
  else if(p==='/scheduled-messages'&&method==='POST'){if(!b.followupId||!this.state.schedules.some(x=>x.followupId===b.followupId))this.state.schedules.push({...b,id:crypto.randomUUID(),status:'queued'});}
  else if(p.startsWith('/scheduled-messages/')){const f=this.state.schedules.find(x=>x.id===id);if(f)Object.assign(f,b.action==='cancel'?{status:'cancelled'}:{...b,status:'queued'});}
  else if(p==='/auto-reply-rules'&&method==='POST')this.state.rules.push({...b,id:crypto.randomUUID()});
  else if(p.startsWith('/auto-reply-rules/')){if(method==='DELETE')this.state.rules=this.state.rules.filter(x=>x.id!==id);else{const r=this.state.rules.find(x=>x.id===id);if(r)Object.assign(r,b);}}
  this.save();return {ok:true};
 }
}
export const demoContacts=[
 {key:'default|919876543210@c.us',name:'Amit Sharma',type:'individual' as const},
 {key:'default|120363000111@g.us',name:'ZFLEET Engineering',type:'group' as const},
 {key:'default|919876543211@c.us',name:'Priya Singh',type:'individual' as const},
 {key:'default|120363000222@g.us',name:'Office Updates',type:'group' as const},
 {key:'default|919876543212@c.us',name:'Rahul Verma',type:'individual' as const},
 {key:'default|919876543213@c.us',name:'Dinesh (You)',type:'individual' as const},
];
function seedDemo():State {const due=new Date(Date.now()+86400000).toISOString();return {...structuredClone(initialState),user:{name:'Dinesh',email:'demo@zfleet.local'},settings:{...defaultSettings},license:{premium:true,status:'demo',daysLeft:14,trialEnd:new Date(Date.now()+14*86400000).toISOString(),price:1000},followups:[{id:'demo-followup-1',contact:demoContacts[0],note:'Implementation timing confirm karni hai',dueAt:new Date(Date.now()-600000).toISOString(),priority:'high',status:'pending',reminderMinutes:10,repeat:'none',repeatDays:1,timezone:'Asia/Kolkata'},{id:'demo-followup-2',contact:demoContacts[2],note:'Documents par follow-up',dueAt:due,priority:'normal',status:'pending',reminderMinutes:0,repeat:'none',repeatDays:1,timezone:'Asia/Kolkata'}],schedules:[{id:'demo-schedule-1',contact:demoContacts[4],body:'Hello Rahul, kal 11 AM par meeting confirm kar dein.',dueAt:due,repeat:'none',repeatDays:1,timezone:'Asia/Kolkata',consent:true,status:'queued'}],rules:[{id:'demo-rule-1',name:'Office hours response',trigger:'outside-hours',keywords:[],response:'Thanks for your message. Hum Monday–Friday, 9 AM–6 PM available hain.',days:[0,1,2,3,4,5,6],start:'00:00',end:'00:00',timezone:'Asia/Kolkata',cooldownMinutes:30,dailyCap:3,delayMinutes:5,contactKeys:[],excludedKeys:[],allowGroups:false,enabled:false}],notes:{}};}
