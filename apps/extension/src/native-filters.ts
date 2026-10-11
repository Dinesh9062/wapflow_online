import {matchesFilter, type Chat, type Filter, type State} from '../../../packages/shared/src/index.ts';
import {normalizeName} from './observation.ts';
import {SelectorRegistry,rowName} from './adapter.ts';
import {NativeMentionSearch} from './mention-search.ts';
import {mentionText,ownMentionIn} from './mentions.ts';

const labels={All:/^(all(?: chats)?|सभी)(?:\s*[\d,]+)?$/i,Unread:/^(unread(?: chats)?|अपठित|बिना पढ़े)(?:\s*[\d,]+)?$/i,Mentions:/^(mentions?|@mentions?|उल्लेख)(?:\s*[\d,]+)?$/i,Groups:/^(groups(?: chats)?|ग्रुप|समूह)(?:\s*[\d,]+)?$/i};
export type Native=keyof typeof labels;
const cleanLabel=(value:string)=>value.replace(/[\u200e\u200f\u202a-\u202e]/g,'').replace(/[()]/g,' ').trim();
// WhatsApp sometimes omits #side and inserts additional ancestors around the pane.
export function nativeFilterButton(mode:Native){
 const pane=document.querySelector<HTMLElement>('#pane-side');
 for(let scope:HTMLElement|null=pane?.parentElement||null;scope;scope=scope.parentElement){
  const found=[...scope.querySelectorAll<HTMLElement>('button,[role="button"],[role="tab"]')].filter(e=>{
   if(e.closest('#pane-side,#main,#zfleet-root,[data-zfleet-owned]'))return false;
   for(let n:HTMLElement|null=e;n&&n!==scope.parentElement;n=n.parentElement){const style=n.ownerDocument.defaultView?.getComputedStyle(n);if(n.hidden||n.getAttribute('aria-hidden')==='true'||style?.display==='none'||style?.visibility==='hidden')return false;}
   return [e.getAttribute('aria-label'),e.textContent].some(label=>labels[mode].test(cleanLabel(label||'')));
  });if(found.length===1)return found[0];if(found.length>1)return null;
 }return null;
}
type Patch={node:HTMLElement;property:string;value:string;priority:string;applied:string};
/** Filters WhatsApp's actual row elements. Never copies chats or opens another inbox. */
export class NativeFilters {
 private filter:Filter='All';private state?:State;private chats:Chat[]=[];private patches:Patch[]=[];private generation=0;private groupNames=new Set<string>();private nativeMode:Native='All';private strip?:HTMLElement;private notice='';private probing=false;private namespace='';
 private scrollTimer?:ReturnType<typeof setTimeout>;
 private groupReady=false;private groupObserver?:MutationObserver;
 private selectedButton?:HTMLElement;private directoryActive=false;private mentionMode:'all'|'pending'='all';private mentionSearch:NativeMentionSearch;private indexedChats:Chat[]=[];
 constructor(private changed:()=>void,private report:(message:string)=>void=()=>{}){this.mentionSearch=new NativeMentionSearch(()=>this.changed());document.addEventListener('click',this.onNative,true);document.addEventListener('scroll',this.onScroll,true);}
 private onNative=(event:MouseEvent)=>{if(!event.isTrusted)return;const target=event.target as Element;for(const mode of ['All','Unread','Groups','Mentions'] as Native[]){const button=this.button(mode);if(button&&button.contains(target)){this.restore();this.report(mode);break;}}};
 private onScroll=(event:Event)=>{if(this.directoryActive||!(event.target as Element).closest?.('#pane-side'))return;clearTimeout(this.scrollTimer);this.scrollTimer=setTimeout(()=>this.changed(),120);};
 private pane(){return document.querySelector<HTMLElement>('#pane-side');}
 private button(mode:Native){return nativeFilterButton(mode);}
 private native(mode:Native){const b=this.button(mode);if(!b)return false;const selected=b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-selected')==='true';if(selected||this.nativeMode===mode&&this.selectedButton===b&&b.getAttribute('aria-pressed')!=='false'&&b.getAttribute('aria-selected')!=='false'){this.nativeMode=mode;if(mode==='Groups')this.groupReady=true;return true;}this.groupObserver?.disconnect();this.groupReady=mode==='Groups'&&selected;this.nativeMode=mode;this.selectedButton=b;
  if(mode==='Groups'){const pane=this.pane();this.groupObserver=new MutationObserver(ms=>{if(ms.some(m=>!(m.target as Element).closest?.('[data-zfleet-owned]')&&[...m.addedNodes,...m.removedNodes].some(n=>!(n as Element).matches?.('[data-zfleet-owned]'))||m.type==='characterData'))this.groupReady=true;});if(pane)this.groupObserver.observe(pane,{childList:true,characterData:true,subtree:true});}
  b.click();return true;}
 private rows(){return [...document.querySelectorAll<HTMLElement>(SelectorRegistry.rows)].filter(r=>!r.parentElement?.closest('[role="row"],[role="listitem"]'));}
 private rememberGroups(){if(this.nativeMode==='Groups'&&this.groupReady&&!this.probing)for(const row of this.rows()){const name=rowName(row);if(name)this.groupNames.add(name);}}
 annotate(chats:Chat[]){this.rememberGroups();for(const c of chats)if(c.type==='unknown'&&chats.filter(x=>x.name===c.name).length===1&&this.groupNames.has(c.name))c.type='group';return chats;}
 async select(filter:Filter,state:State,chats:Chat[]){if(this.namespace!==state.settings.accountNamespace){this.namespace=state.settings.accountNamespace;this.groupNames.clear();}const token=++this.generation;const changed=filter!==this.filter;this.filter=filter;this.state=state;this.chats=chats;this.notice='';this.restore();
  if(filter!=='Mentions'||this.mentionMode==='pending')this.mentionSearch.stop();
  if(filter==='Mentions'&&this.mentionMode==='all'){if(changed&&this.nativeMode!=='All'){this.native('All');await new Promise(r=>setTimeout(r,350));if(token!==this.generation)return;}this.mentionSearch.start(state.settings);this.changed();this.apply();return;}
  if(['All','Unread','Groups'].includes(filter)&&this.native(filter as Native)){this.changed();return;}
  if(changed&&filter==='Chats'&&this.button('Groups')&&this.button('All')){
   // WhatsApp knows group membership even when a group uses a custom photograph.
   const pane=this.pane();let dirty=Date.now();let mutated=false;const observer=new MutationObserver(()=>{dirty=Date.now();mutated=true;});if(pane)observer.observe(pane,{childList:true,subtree:true});
   this.probing=true;this.native('Groups');const started=Date.now();while(token===this.generation&&Date.now()-started<2500){await new Promise(r=>setTimeout(r,80));if(mutated&&Date.now()-dirty>300)break;}
   observer.disconnect();this.probing=false;if(token!==this.generation)return;this.rememberGroups();this.native('All');
   // Wait for the native list to return before applying the local filter.
   await new Promise(r=>setTimeout(r,350));if(token!==this.generation)return;
  }else if(changed)this.native('All');
  this.changed();this.apply();
 }
 update(chats:Chat[],indexed:Chat[]=chats){this.chats=this.annotate(chats);this.indexedChats=indexed;this.apply();}
 async revealTarget(){if(this.filter==='All'&&this.nativeMode==='All')return;this.report('All');if(this.state)await this.select('All',this.state,this.chats);else{this.generation++;this.filter='All';this.restore();this.native('All');}await new Promise(r=>setTimeout(r,350));}
 private patch(node:HTMLElement,property:string,value:string){this.patches.push({node,property,value:node.style.getPropertyValue(property),priority:node.style.getPropertyPriority(property),applied:value});node.style.setProperty(property,value,'important');}
 private restore(){for(const p of this.patches){if(p.node.style.getPropertyValue(p.property)!==p.applied)continue;if(p.value)p.node.style.setProperty(p.property,p.value,p.priority);else p.node.style.removeProperty(p.property);}this.patches=[];this.strip?.remove();this.strip=undefined;}
 private wrapper(row:HTMLElement,pane:HTMLElement){let node=row;while(node.parentElement&&node.parentElement!==pane){if(node.style.position==='absolute'||node.style.transform.includes('translate'))return node;const parent=node.parentElement;if(parent.matches('[role="grid"],[role="list"], [role="tree"]'))break;node=parent;}return row;}
 private scrollHost(first:HTMLElement,pane:HTMLElement){for(let node:HTMLElement|null=first.parentElement;node&&pane.contains(node);node=node.parentElement){const overflow=node.ownerDocument.defaultView?.getComputedStyle(node).overflowY;if(node.scrollTop||node.scrollHeight>node.clientHeight&&node.clientHeight>0||overflow==='auto'||overflow==='scroll')return node;}return pane;}
 private apply(){this.restore();if(!this.state)return;if(this.filter==='Mentions'&&this.mentionMode==='all'&&!this.mentionSearch.active&&this.mentionSearch.options.length){this.mentionToolbar(0);return;}if(['All','Unread','Groups'].includes(this.filter)&&this.button(this.filter as Native))return;if(this.filter==='All')return;const pane=this.pane();if(!pane)return;
  const rows=this.rows(),counts=new Map<string,number>();for(const r of rows){const n=rowName(r);counts.set(n,(counts.get(n)||0)+1);}
  let matches=0;const wrappers=rows.map(row=>this.wrapper(row,pane));const first=wrappers[0];const scroll=first?this.scrollHost(first,pane):pane;const rect=first?.getBoundingClientRect();const base=first?Number(first.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1]||first.style.transform.match(/translate(?:3d)?\([^,]+,\s*([-\d.]+)px/)?.[1]||0)+(parseFloat(first.style.top)||0):0;
  // Anchor matches at the actual viewport, not at an overscanned row above it.
  let y=rect?.height?base+scroll.getBoundingClientRect().top-rect.top:scroll.scrollTop;
  for(let i=0;i<rows.length;i++){const row=rows[i],name=rowName(row),chat=this.chats.find(c=>normalizeName(c.name)===normalizeName(name))||this.indexedChats.find(c=>normalizeName(c.name)===normalizeName(name));let yes=false;if(this.filter==='Mentions'&&this.mentionMode==='all'&&this.mentionSearch.active){const preview=row.querySelector<HTMLElement>('[data-testid="cell-frame-secondary"], [data-testid="last-msg-status"], [data-testid="search-message-result"], .selectable-text')||row;if(preview&&!row.querySelector(SelectorRegistry.outgoing)){const text=mentionText(preview);yes=this.mentionSearch.current()?.kind==='phone'?/(?:^|[\s:])@(?=[^\s@])/.test(text)||ownMentionIn(preview,this.state.settings):ownMentionIn(preview,this.state.settings);}}else if(chat){const classified=chat.type==='unknown'&&counts.get(name)===1&&this.groupNames.has(name)?{...chat,type:'group' as const}:chat;
    // Local reminders remain usable before a stable automation identity is available.
    const candidates=[...new Set([...(this.state.conversations||[]),...this.state.followups.map(x=>x.contact),...this.state.schedules.map(x=>x.contact)].filter(c=>normalizeName(c.name)===normalizeName(name)).map(c=>c.key))];
    const linked={...classified,key:!classified.verified&&counts.get(name)===1&&candidates.length===1?candidates[0]:classified.key};
    yes=this.filter==='Chats'?classified.type!=='group':(counts.get(name)!==1&&['Follow-ups','Scheduled'].includes(this.filter)?matchesFilter({...linked,name:'__ambiguous__'},this.filter,this.state):matchesFilter(linked,this.filter,this.state));
   }
   const wrapper=wrappers[i];if(!yes){this.patch(wrapper,'display','none');continue;}matches++;
   if(wrapper.style.position==='absolute'||wrapper.style.transform.includes('translate')){const h=wrapper.getBoundingClientRect().height||row.getBoundingClientRect().height||76;this.patch(wrapper,'transform',`translateY(${y}px)`);this.patch(wrapper,'top','0px');y+=h;}
  }
  if(this.filter==='Mentions'){this.mentionToolbar(matches);return;}
  this.notice='WhatsApp ki loaded chat list par filter laga hai. Aur chats load karne ke liye list scroll karein.';
  const strip=document.createElement('div');strip.dataset.zfleetOwned='true';strip.style.cssText='position:sticky;top:0;z-index:5;padding:8px 12px;background:var(--panel-background,#fff);color:var(--primary,#111b21);font:12px system-ui;display:flex;gap:8px;align-items:center';
  const label=document.createElement('span');label.textContent=`${this.filter} · ${matches} matching / ${rows.length} loaded chats${this.filter==='Awaiting Reply'?' · Your last message sent; grace '+this.state.settings.graceMinutes+' min':!matches?' · No loaded matches':''}`;label.style.flex='1';strip.append(label);
  const clear=document.createElement('button');clear.textContent='All chats';clear.style.cssText='border:0;background:transparent;color:#00a884;cursor:pointer';clear.onclick=()=>this.report('All');strip.append(clear);pane.prepend(strip);this.strip=strip;
  this.notice='WhatsApp ki loaded chat list par filter laga hai. Aur chats load karne ke liye list scroll karein.';
 }
 private mentionToolbar(visible:number){const pane=this.pane();if(!pane||!this.state)return;const pending=(this.indexedChats.length?this.indexedChats:this.chats).filter(c=>c.mention).length;
  const strip=document.createElement('div');strip.dataset.zfleetOwned='true';strip.style.cssText='position:sticky;top:0;z-index:5;padding:9px 12px;background:var(--panel-background,#fff);color:var(--primary,#111b21);font:12px system-ui;display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  const button=(label:string,click:()=>void,selected=false)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.setAttribute('aria-pressed',String(selected));b.style.cssText='border:1px solid #c8ddd3;border-radius:15px;padding:5px 9px;background:'+ (selected?'#dcf8e7':'transparent')+';color:var(--primary,#111b21);cursor:pointer';b.onclick=click;strip.append(b);};
  const switchMode=(mode:'all'|'pending')=>{this.mentionMode=mode;void this.select('Mentions',this.state!,this.chats);};
  button('All mentions',()=>switchMode('all'),this.mentionMode==='all');button('Pending ('+pending+')',()=>switchMode('pending'),this.mentionMode==='pending');
  if(this.mentionMode==='all'&&this.mentionSearch.options.length){const select=document.createElement('select');select.setAttribute('aria-label','Mention search identity');select.style.cssText='max-width:180px;padding:4px;border:1px solid #c8ddd3;border-radius:8px;background:var(--panel-background,#fff);color:var(--primary,#111b21)';for(const q of this.mentionSearch.options){const o=document.createElement('option');o.value=q.id;o.textContent=q.label;select.append(o);}select.value=this.mentionSearch.current()?.id||'';select.onchange=()=>{this.mentionSearch.choose(select.value,this.state!.settings);this.changed();};strip.append(select);}
  if(this.mentionMode==='all')button('Refresh mentions',()=>{this.mentionSearch.refresh(this.state!.settings);this.changed();});
  button('All chats',()=>this.report('All'));
  const note=document.createElement('span');note.style.cssText='flex-basis:100%;line-height:1.5';note.textContent=this.mentionMode==='all'?(this.mentionSearch.active?'Native message search · '+visible+' visible results · Groups + chats. Scroll for more; replies pause while search is open.':this.mentionSearch.status+(this.mentionSearch.options.length?'':' Known pending: '+visible+' visible pending chats.')):'Pending observed mentions · '+visible+' visible chats. Reading does not clear a tag; your outgoing reply clears it.';strip.append(note);
  pane.prepend(strip);this.strip=strip;this.notice=note.textContent||'';
 }
 diagnostics(){const nativeCounts:Partial<Record<Native,number>>={};for(const mode of ['All','Unread','Groups'] as Native[]){const b=this.button(mode);for(const value of [b?.textContent,b?.getAttribute('aria-label')]){const label=cleanLabel(value||'');if(!labels[mode].test(label))continue;const match=label.match(/(\d[\d,]*)\s*$/);if(match){nativeCounts[mode]=Number(match[1].replaceAll(',',''));break;}}}return {filter:this.filter,loadedRows:this.rows().length,hiddenRows:this.patches.filter(p=>p.property==='display').length,nativeCounts,status:this.notice,mentions:{mode:this.mentionMode,nativeSearchActive:this.mentionSearch.active,queryKind:this.mentionSearch.current()?.kind,configuredIdentities:this.mentionSearch.options.length,status:this.mentionSearch.status}};}
 resetOwner(){this.mentionSearch.stop();this.indexedChats=[];this.chats=[];this.groupNames.clear();this.restore();this.report('All');}
 getSelection(){return this.filter;}
 async beginDirectory(){this.directoryActive=true;clearTimeout(this.scrollTimer);this.generation++;this.restore();this.filter='All';this.native('All');await new Promise(r=>setTimeout(r,350));}
 async directoryMode(mode:'All'|'Groups'){this.restore();this.native(mode);await new Promise(r=>setTimeout(r,350));}
 async endDirectory(filter?:Filter){this.directoryActive=false;if(filter===undefined)return;if(this.state)await this.select(filter,this.state,this.chats);else{this.filter=filter;this.restore();this.native('All');}}
 status(){return this.notice;}
 stop(){this.mentionSearch.stop();this.directoryActive=false;this.generation++;this.groupObserver?.disconnect();clearTimeout(this.scrollTimer);document.removeEventListener('click',this.onNative,true);document.removeEventListener('scroll',this.onScroll,true);this.restore();}
}
