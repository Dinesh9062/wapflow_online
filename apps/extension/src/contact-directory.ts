import type {Chat} from '../../../packages/shared/src/index.ts';
import {canonicalName,cleanContactName} from '../../../packages/shared/src/index.ts';
import {SelectorRegistry} from './adapter.ts';
import {nativeFilterButton,type NativeFilters} from './native-filters.ts';
import {chatSearch,searchText} from './native-search.ts';
export type DirectoryStatus={running:boolean;count:number;status:string;complete:boolean;phase?:'chats'|'groups'|'finishing';progress?:number;restored?:boolean;updatedAt?:number};
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
/** Read only WhatsApp's rendered chat rows, including its virtualized off-screen rows. */
export class ContactDirectory {
 private cancelled=false;private running=false;private cancelReason='';
 constructor(private filters:NativeFilters,private scan:()=>void,private contacts:()=>Chat[],private update:(s:DirectoryStatus)=>void,private maxMs=90000){}
 cancel(reason=''){this.cancelled=true;this.cancelReason=reason;}
 isRunning(){return this.running;}
 private host(){const pane=document.querySelector<HTMLElement>('#pane-side');if(!pane)return null;const first=pane.querySelector<HTMLElement>('[role="row"],[role="listitem"]');for(let n=first?.parentElement||pane;n&&pane.contains(n);n=n.parentElement!){const style=n.ownerDocument.defaultView?.getComputedStyle(n);if(n.clientHeight>0&&n.scrollHeight>n.clientHeight&&(style?.overflowY==='auto'||style?.overflowY==='scroll'||n.scrollTop>0))return n;}return pane;}
 async load(){if(this.running)return;this.running=true;this.cancelled=false;this.cancelReason='';const filter=this.filters.getSelection();const original=this.host(),scroll=original?.scrollTop||0;let interrupted=false,complete=true,begun=false,failure='';let phase:DirectoryStatus['phase']='chats',progress=0;const start=Date.now();
  const stop=(e:Event)=>{if(e.isTrusted&&!(e.target as Element)?.closest?.('#zfleet-root')){interrupted=true;this.cancel();}};
  for(const type of ['pointerdown','wheel','keydown'])document.addEventListener(type,stop,true);
  const report=(status:string)=>this.update({running:this.running,count:this.contacts().length,status,complete:false,phase,progress});
  try{if(!document.querySelector('#pane-side'))throw Error('WhatsApp chat list is still loading. Try again when it is visible.');if(!nativeFilterButton('All'))throw Error('WhatsApp All filter was not found. Use All in WhatsApp and retry.');const search=chatSearch();if(search&&searchText(search))throw Error('Clear WhatsApp search before loading the full chat list. Your search was kept unchanged.');report('Preparing your WhatsApp workspace…');await delay(50);if(this.cancelled)return;begun=true;await this.filters.beginDirectory();
   for(const mode of ['All','Groups'] as const){if(this.cancelled)break;if(mode==='Groups'&&!nativeFilterButton('Groups'))continue;phase=mode==='All'?'chats':'groups';await this.filters.directoryMode(mode);const host=this.host();if(!host)throw Error('WhatsApp list disappeared during refresh. Try again after loading.');host.scrollTop=0;host.dispatchEvent(new Event('scroll',{bubbles:true}));await delay(350);let bottom=0;
    while(!this.cancelled&&Date.now()-start<this.maxMs&&this.contacts().length<10000){this.scan();const before=host.scrollTop;const end=Math.max(0,host.scrollHeight-host.clientHeight);progress=Math.max(progress,Math.floor((mode==='All'?0:80)+(end?Math.min(1,before/end):1)*(mode==='All'?80:15)));report(`Loading ${mode==='Groups'?'groups':'chats'} · ${this.contacts().length} names`);if(before>=end-2){bottom++;if(bottom>=3)break;}else bottom=0;host.scrollTop=Math.min(end,before+Math.max(160,Math.floor((host.clientHeight||600)*0.9)));host.dispatchEvent(new Event('scroll',{bubbles:true}));await delay(200);if(!host.isConnected)throw Error('WhatsApp list changed while loading. Retry after refresh.');}
    if(Date.now()-start>=this.maxMs||this.contacts().length>=10000){complete=false;break;}
   }
   if(this.cancelled)complete=false;
  }catch(e:any){complete=false;failure=e.message;report(e.message);throw e;}
  finally{phase='finishing';report('Restoring your WhatsApp view…');for(const type of ['pointerdown','wheel','keydown'])document.removeEventListener(type,stop,true);try{if(begun){await this.filters.endDirectory(interrupted?undefined:filter);const restored=this.host();if(restored&&!interrupted){restored.scrollTop=scroll;restored.dispatchEvent(new Event('scroll',{bubbles:true}));}}}catch(e:any){complete=false;failure=e.message;}this.running=false;if(this.cancelled)complete=false;this.scan();this.update({running:false,count:this.contacts().length,complete,progress:complete?100:progress,status:complete?'WhatsApp chat list loaded. You can use your workspace now.':failure||this.cancelReason||(interrupted?'Stopped because you used WhatsApp. Loaded names kept.':this.cancelled?'Loading cancelled. Loaded names kept.':'Partial list kept. Refresh Chat list when convenient.')});}
 }
}
export type ContactChoice={key:string;name:string;type:string;verified?:boolean};
/** Collapse stale accessibility-name aliases without ever remapping a saved automation key. */
export function contactChoices(contacts:ContactChoice[],selected:string[]=[]){const keys=new Map<string,ContactChoice>();for(const c of contacts)keys.set(c.key,{...c,name:cleanContactName(c.name)});const groups=new Map<string,ContactChoice[]>();for(const c of keys.values()){const n=c.key.split('|')[0]+'|'+canonicalName(c.name);groups.set(n,[...(groups.get(n)||[]),c]);}return [...groups.values()].flatMap(cs=>{const stable=cs.filter(c=>c.verified);const keep=stable.length?stable:[cs.at(-1)!];return cs.filter(c=>keep.includes(c)||selected.includes(c.key));}).sort((a,b)=>a.name.localeCompare(b.name));}
