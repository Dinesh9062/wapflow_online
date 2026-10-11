import type {Alert} from '../../../packages/shared/src/index.ts';
let writes=Promise.resolve();
export class NotificationCenter {
 constructor(private chromeApi:typeof chrome){}
 async list(owner:string){const data:any=await this.chromeApi.storage.local.get('alertsByAccount');return (data.alertsByAccount?.[owner]||[]) as Alert[];}
 async permission(){try{return await this.chromeApi.notifications.getPermissionLevel();}catch{return 'unavailable';}}
 async add(owner:string,entry:Omit<Alert,'at'|'read'>,systemEnabled:boolean){let fresh=false;const write=writes.then(async()=>{const data:any=await this.chromeApi.storage.local.get('alertsByAccount'),byAccount=data.alertsByAccount||{},feed:Alert[]=byAccount[owner]||[];if(feed.some(a=>a.id===entry.id))return;fresh=true;byAccount[owner]=[{...entry,at:Date.now(),read:false},...feed].slice(0,200);await this.chromeApi.storage.local.set({alertsByAccount:byAccount});});writes=write.catch(()=>{});await write;if(!fresh||!systemEnabled)return {fresh,system:'disabled'};const permission=await this.permission();if(permission!=='granted')return {fresh,system:permission};try{await this.chromeApi.notifications.create(entry.id,{type:'basic',iconUrl:'icon128.png',title:entry.title,message:entry.message.slice(0,200),priority:entry.kind==='followup'?1:0});return {fresh,system:'shown'};}catch{return {fresh,system:'failed'};}}
 async read(owner:string){const write=writes.then(async()=>{const data:any=await this.chromeApi.storage.local.get('alertsByAccount'),byAccount=data.alertsByAccount||{};byAccount[owner]=(byAccount[owner]||[]).map((a:Alert)=>({...a,read:true}));await this.chromeApi.storage.local.set({alertsByAccount:byAccount});});writes=write.catch(()=>{});return write;}
}
