import {defaultSettings,cleanContactName,type Settings,type Chat,type Message,type Schedule,type ConversationBinding} from '../../../packages/shared/src/index.ts';
import {normalizeName,parseTimeLabel} from './observation.ts';
import {observeMessages,mergeChatObservation} from './conversation-observation.ts';
import {chatSearch,searchText,writeSearch,isOwnedSearchInput} from './native-search.ts';
import {ownMentionIn,ownMentionText} from './mentions.ts';
// Change only this registry when WhatsApp changes its DOM. No undocumented WA APIs.
export const SelectorRegistry={version:'2026.10.06-dom-v15',
 rows:'#pane-side [role="row"], #pane-side [role="listitem"]',
 title:'[data-testid="cell-frame-title"] span, span[title][dir="auto"], [data-testid="cell-frame-title"], span[dir="auto"]',
 unread:'[data-testid="icon-unread-count"], [aria-label*="unread message" i], [aria-label*="unread count" i]',
 mention:'[data-icon*="mention"], [data-testid*="mention"], [aria-label*="mention" i], [title*="mention" i], [data-icon="at"], [data-icon="mention-unread"], [data-is-self-mention="true"]',
 group:'[data-icon="default-group"], [data-testid="default-group"], [aria-label*="group" i]',
 main:'#main',header:'#main header',message:'#main [data-id], #main [data-message-id], #main [data-msg-id], #main [id^="true_"], #main [id^="false_"]',
 text:'.selectable-text, [data-testid="msg-text"]',
 composer:'#main footer [contenteditable="true"][role="textbox"], #main footer [contenteditable="true"][data-tab]',
 send:'#main footer [data-testid="compose-btn-send"], #main footer [data-testid="wds-ic-send-filled"], #main footer [data-icon="send"], #main footer [data-icon="wds-ic-send-filled"], #main footer button[aria-label="Send" i], #main footer [role="button"][aria-label="Send" i], #main footer [aria-label="Send message" i], #main footer [aria-label="भेजें"], #main footer [aria-label="संदेश भेजें"]',
 outgoing:'[data-icon="ic-check"], [data-icon="ic-double-check"], [data-icon="ic-check-double"], [data-icon="check-double"], [data-icon="wds-ic-double-check"], [data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-icon="status-dblcheck"], [data-icon="status-check"], [data-icon="double-check"], [data-icon="checkmark"], [data-icon="wds-ic-checkmark"], [data-icon="wds-ic-checkmark-double"], [data-icon="wds-ic-done"], [data-icon="wds-ic-done-all"], [data-icon="ic-checkmark"], [data-icon="ic-checkmark-double"], [data-icon="ic-done"], [data-icon="ic-done-all"], [data-testid="msg-check"], [data-testid="msg-dblcheck"], [aria-label="Read"], [aria-label="Delivered"], [aria-label="Sent"]'};
export function jidFromMessageId(id:string){id=id.replace(/[\u200e\u200f]/g,'').trim();if(id.startsWith('{')){try{const v=JSON.parse(id);id=String(v._serialized||v.id||'');}catch{return null;}}const m=id.match(/^(?:true|false)_([^_]+@(?:c\.us|s\.whatsapp\.net|g\.us|lid))_/);return m?.[1]||null;}
export function hash(s:string){let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(36);}
const q=(s:string,r:ParentNode=document)=>r.querySelector<HTMLElement>(s);
const visible=(node:HTMLElement)=>{for(let n:HTMLElement|null=node;n&&n.id!=='main';n=n.parentElement){const style=n.ownerDocument.defaultView?.getComputedStyle(n);if(n.hidden||n.getAttribute('aria-hidden')==='true'||style?.display==='none'||style?.visibility==='hidden')return false;}return true;};
export function sendControls(){const controls=[...new Set([...document.querySelectorAll<HTMLElement>(SelectorRegistry.send)].map(n=>n.closest<HTMLElement>('button,[role="button"]')||n))].filter(n=>n.isConnected&&visible(n)&&!n.closest('[data-zfleet-owned]'));return {controls,enabled:controls.filter(n=>!n.matches(':disabled,[aria-disabled="true"]'))};}
function sendControl(){const {enabled}=sendControls();return enabled.length===1?enabled[0]:null;}
const text=(e:Element|null)=>{if(!e)return '';if(!e.querySelector('img[alt],[data-zfleet-owned]')&&(e as HTMLElement).innerText!==undefined)return (e as HTMLElement).innerText.replace(/\r\n/g,'\n').replace(/\u00a0/g,' ').trim();const clone=e.cloneNode(true) as HTMLElement;clone.querySelectorAll('[data-zfleet-owned]').forEach(n=>n.remove());clone.querySelectorAll('br').forEach(n=>n.replaceWith(document.createTextNode('\n')));clone.querySelectorAll('img[alt]').forEach(img=>img.replaceWith(document.createTextNode(img.getAttribute('alt')||'')));return (clone.textContent||'').replace(/\r\n/g,'\n').replace(/\u00a0/g,' ').trim();};
export const rowName=(row:HTMLElement)=>{
 const preferred=row.querySelector('[data-testid="cell-frame-title"]');
 const candidates=preferred?[preferred,...preferred.querySelectorAll('span[title],span[dir="auto"]')]:[...row.querySelectorAll('span[title],span[dir="auto"]')];
 for(const item of candidates){if(item.closest('[data-testid="icon-unread-count"],[aria-label*="unread message" i]'))continue;const value=item.getAttribute('title')?.trim()||text(item);if(!value||/^(?:\d+\s+unread messages?|unread messages?)$/i.test(value))continue;if(/^\d{1,2}:\d{2}(?:\s*[AP]M)?$/i.test(value))continue;return cleanContactName(value);}
 return '';
};
const rawMessageId=(node:HTMLElement)=>node.getAttribute('data-id')||node.getAttribute('data-message-id')||node.getAttribute('data-msg-id')||(node.id.startsWith('true_')||node.id.startsWith('false_')?node.id:'');
export const messageId=(node:HTMLElement)=>{const raw=rawMessageId(node);if(raw.startsWith('{')){try{const v=JSON.parse(raw);return String(v._serialized||v.id||raw);}catch{}}return raw.replace(/[\u200e\u200f]/g,'').trim();};
// Quoted messages can contain another chat's ID. Only outer message envelopes identify this conversation.
const quoted='blockquote,[data-testid*="quoted"],[data-testid*="quoted-message"]';
const outsideMessage=(n:Element)=>!!n.closest(quoted+',#main header,#main footer,[data-zfleet-owned]');
const isOpaque=(id:string)=>!jidFromMessageId(id)&&/^[a-zA-Z0-9_-]{20,80}$/.test(id);
export const opaqueMessageId=(n:HTMLElement)=>isOpaque(messageId(n));
function nativeAnchor(node:HTMLElement){if(isOpaque(messageId(node)))return messageId(node);const ids=[...node.querySelectorAll<HTMLElement>('[data-id],[data-message-id],[data-msg-id]')].filter(n=>!outsideMessage(n)).map(messageId).filter(isOpaque);if(new Set(ids).size===1)return ids[0];
 // Some builds put the marker outside msg-container. Never borrow an ID from a multi-message layout.
 for(let parent=node.parentElement;parent&&parent.id!=='main';parent=parent.parentElement){if(outsideMessage(parent)||parent.querySelectorAll('[data-pre-plain-text]').length>1||[...parent.querySelectorAll(SelectorRegistry.text)].filter(n=>!outsideMessage(n)).length!==1)break;if(isOpaque(messageId(parent)))return messageId(parent);}return '';}
export const messageNodes=()=>{
 const identified=[...document.querySelectorAll<HTMLElement>(SelectorRegistry.message)].filter(n=>jidFromMessageId(messageId(n))&&!outsideMessage(n));
 const outer=identified.filter(n=>!identified.some(p=>p!==n&&p.contains(n)));const fallback:HTMLElement[]=[];
 for(const body of document.querySelectorAll<HTMLElement>('#main '+SelectorRegistry.text.split(',').map(x=>x.trim()).join(',#main '))){
  if(outsideMessage(body)||outer.some(p=>p.contains(body)))continue;
  let node:HTMLElement|null=body.closest('.message-in,.message-out,[data-testid="msg-container"]');
  // A layout may reuse msg-container around several messages. Never use it as one envelope.
  if(node&&[...node.querySelectorAll('[data-pre-plain-text]')].filter(n=>!n.closest(quoted)).length>1)node=null;
  if(!node){let row:HTMLElement|null=null;for(let parent=body.parentElement;parent&&parent.id!=='main';parent=parent.parentElement){
   if(parent.matches('header,footer'))break;
   if(opaqueMessageId(parent)&&parent.querySelectorAll('[data-pre-plain-text]').length<=1&&[...parent.querySelectorAll(SelectorRegistry.text)].filter(n=>!n.closest(quoted)).length===1){node=parent;break;}
   if(!row&&parent.matches('[role="row"]')&&parent.querySelectorAll(SelectorRegistry.text).length<=1)row=parent;
  }if(!node)node=body.closest('[data-pre-plain-text]')||row;}
  if(node&&!outsideMessage(node)&&!outer.some(p=>p.contains(node)||node!.contains(p)))fallback.push(node);
 }
 return [...new Set([...outer,...fallback.filter(n=>!fallback.some(p=>p!==n&&p.contains(n)))])].sort((a,b)=>a.compareDocumentPosition(b)&4?-1:1);
};
export function messageDirection(node:HTMLElement,ownNames:string[]=[]):'in'|'out'|null{
 const id=messageId(node);if(id.startsWith('true_'))return 'out';if(id.startsWith('false_'))return 'in';
 if(node.matches('.message-out')||node.closest('.message-out'))return 'out';if(node.matches('.message-in')||node.closest('.message-in'))return 'in';
 let scope=node;for(let i=0;i<3;i++){const parent=scope.parentElement;if(!parent||parent.id==='main'||parent.querySelectorAll('[data-pre-plain-text]').length>1||messageNodesIn(parent)>1)break;scope=parent;}
 if(scope.querySelector(SelectorRegistry.outgoing+', [data-icon="tail-out"],[data-testid="tail-out"],[aria-label="You:"]'))return 'out';
 if(scope.querySelector('[data-icon="tail-in"],[data-testid="tail-in"]'))return 'in';
 const label=node.getAttribute('data-pre-plain-text')||node.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text');
 const sender=label?.replace(/^\[[^\]]+\]\s*/,'').replace(/:\s*$/,'').trim();
 if(sender)return ownNames.some(n=>normalizeName(n)===normalizeName(sender))||/^(you|आप)$/i.test(sender)?'out':'in';
 return null;
}
function messageNodesIn(node:HTMLElement){return [...node.querySelectorAll<HTMLElement>('[data-id],[data-message-id],[data-msg-id]')].filter(n=>(jidFromMessageId(messageId(n))||opaqueMessageId(n))&&n.querySelector(SelectorRegistry.text)).length;}

function prePlain(node:HTMLElement){return node.getAttribute('data-pre-plain-text')||node.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text')||'';}
function dateDivider(node:HTMLElement){const date=/^(?:Today|Yesterday|आज|कल|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})$/i;let cursor:HTMLElement|null=node;while(cursor&&cursor.id!=='main'){let prev=cursor.previousElementSibling;while(prev){if(!prev.querySelector(SelectorRegistry.text)){const candidates=[prev,...prev.querySelectorAll('span,time')].filter(n=>!n.closest('[data-zfleet-owned]')).map(text);const label=candidates.find(v=>date.test(v));if(label)return label;}prev=prev.previousElementSibling;}cursor=cursor.parentElement;}return '';}
const explicitJid=(node:Element|null)=>{const value=node?.getAttribute('data-chat-id')||node?.getAttribute('data-jid')||node?.getAttribute('data-id')||'';return /^[^\s_]+@(?:c\.us|s\.whatsapp\.net|g\.us|lid)$/.test(value)?value:null;};
function messageTime(node:HTMLElement,settings:Settings){
 const epoch=Number(node.getAttribute('data-timestamp'));if(epoch>1e12)return epoch;if(epoch>1e9)return epoch*1000;
 const dt=prePlain(node);if(dt){const parsed=parseTimeLabel(dt,settings.timezone,settings.dateOrder),date=dt.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/),clock=dt.match(/\d{1,2}:\d{2}(?:\s*[AP]M)?/i),divider=dateDivider(node);
  // Resolve an ambiguous numeric date only when a visible native Today/Yesterday/weekday proves it.
  if(date&&+date[1]<=12&&+date[2]<=12&&date[1]!==date[2]&&clock&&/^(Today|Yesterday|आज|कल|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/i.test(divider)){
   const native=parseTimeLabel(divider+' '+clock[0],settings.timezone,settings.dateOrder),other=parseTimeLabel(dt,settings.timezone,settings.dateOrder==='DMY'?'MDY':'DMY');if(native&&native===other)return native;
  }return parsed;
 }
 const label=[...node.querySelectorAll<HTMLElement>('time,span')].filter(e=>!e.closest('[data-zfleet-owned]')).map(e=>e.getAttribute('datetime')||text(e)).find(t=>/^\d{1,2}:\d{2}(?:\s*[AP]M)?$/i.test(t));return label?parseTimeLabel(dateDivider(node)+' '+label,settings.timezone,settings.dateOrder):0;
}
function activateChatRow(row:HTMLElement){
 const target=row.querySelector<HTMLElement>('[data-testid="cell-frame-title"] span,span[title][dir="auto"],[data-testid="cell-frame-title"],span[dir="auto"]')||row,view=row.ownerDocument.defaultView!;
 // New native rows activate from a nested cell's pointer/mouse handler, rather than the outer row click.
 for(const type of ['pointerdown','mousedown','pointerup','mouseup']){const EventClass=type.startsWith('pointer')&&view.PointerEvent?view.PointerEvent:view.MouseEvent;target.dispatchEvent(new EventClass(type,{bubbles:true,cancelable:true,button:0,buttons:type.endsWith('down')?1:0}));}
 target.click();
}
function visibleAnchor(node:HTMLElement,settings:Settings){const body=[...node.querySelectorAll<HTMLElement>(SelectorRegistry.text)].find(e=>!e.closest(quoted));const direction=messageDirection(node,settings.mentionAliases||[]);const at=messageTime(node,settings);const dated=/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(prePlain(node))||!!dateDivider(node)||!!node.getAttribute('data-timestamp');if(!body||!direction||!at||!dated)return '';const signature=[prePlain(node),at,direction,text(body)].join('|');return 'visible:'+hash(signature)+':'+hash([...signature].reverse().join(''))+':'+signature.length;}
function anchor(node:HTMLElement,settings:Settings){return nativeAnchor(node)||visibleAnchor(node,settings);}
function bindingMarkers(nodes:HTMLElement[],settings:Settings){const all=nodes.map(n=>anchor(n,settings)).filter(Boolean),counts=new Map<string,number>();for(const id of all)counts.set(id,(counts.get(id)||0)+1);return {all,ids:all.filter(id=>counts.get(id)===1),conflictingNative:all.some(id=>!id.startsWith('visible:')&&counts.get(id)!==1)};}
export const messageDomKey=(node:HTMLElement,contactKey:string)=>messageId(node)||nativeAnchor(node)||'dommsg:'+hash(contactKey+'|'+prePlain(node)+'|'+dateDivider(node)+'|'+text([...node.querySelectorAll(SelectorRegistry.text)].find(e=>!e.closest(quoted))||null)+'|'+text([...node.querySelectorAll('time,span')].filter(e=>!e.closest('[data-zfleet-owned]')).find(e=>/^\d{1,2}:\d{2}(?:\s*[AP]M)?$/i.test(text(e)))||null));
export class WhatsAppAdapter {
 private rowMap=new Map<string,HTMLElement>();private known=new Map<string,Chat>();private seen=new Set<string>();private initialized=new Set<string>();private observer?:MutationObserver;private timer?:ReturnType<typeof setTimeout>;private typingAt=0;namespace='default';private settings:Settings=defaultSettings;private ownJids=new Set<string>();private bindings=new Map<string,ConversationBinding>();
 private injecting=false;private manualEdits=0;private sending=false;private preparing=false;private targetGeneration=0;private abortTarget?:()=>void;
 constructor(private changed:(chats:Chat[],current:Chat|null,messages:Message[],fresh:Message[])=>void,private revealTarget?:()=>Promise<void>,private targetStatus:(s:{running:boolean;status:string})=>void=()=>{}){}
 start(){document.addEventListener('input',this.onTyping,true);this.observer=new MutationObserver(ms=>{if(ms.every(x=>(x.target as Element).closest?.('#zfleet-root,[data-zfleet-owned]')||(x.type==='childList'&&[...x.addedNodes,...x.removedNodes].every(n=>(n as Element).matches?.('[data-zfleet-owned]')))))return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.scan(),300);});this.observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','data-id','data-message-id','data-msg-id','data-chat-id','data-jid','aria-selected','data-pre-plain-text','data-timestamp','data-icon','data-testid','class','data-mention-jid','data-is-self-mention','href','alt']});this.scan();}
 stop(){this.abortTarget?.();this.observer?.disconnect();clearTimeout(this.timer);document.removeEventListener('input',this.onTyping,true);}
 private onTyping=(e:Event)=>{if(e.isTrusted&&!this.injecting&&(e.target as HTMLElement).closest?.(SelectorRegistry.composer)){this.typingAt=Date.now();this.manualEdits++;}};
 setNamespace(value:string){if(this.namespace!==value){this.targetGeneration++;this.abortTarget?.();this.namespace=value;this.known.clear();this.bindings.clear();this.ownJids.clear();this.seen.clear();this.initialized.clear();this.scan();}}
 clearOwner(){this.targetGeneration++;this.abortTarget?.();this.known.clear();this.bindings.clear();this.ownJids.clear();this.seen.clear();this.initialized.clear();this.rowMap.clear();}
 configure(settings:Settings){if(this.settings.ownPhone!==settings.ownPhone)this.ownJids.delete((this.settings.ownPhone||'').replace(/\D/g,'')+'@c.us');this.settings=settings;const phone=settings.ownPhone?.replace(/\D/g,'');if(phone)this.ownJids.add(phone+'@c.us');}
 private fullKey(jid:string){return this.namespace+'|'+jid;}
 current():Chat|null {
  const header=q(SelectorRegistry.header);if(!header)return null;
  const named=q('[data-testid="conversation-info-header-chat-title"], [data-testid="conversation-header-title"], span[title][dir="auto"], span[dir="auto"]',header);
  const name=cleanContactName(named?.getAttribute('title')?.trim()||text(named));if(!name)return null;
  const ids=messageNodes().map(x=>jidFromMessageId(messageId(x))).filter(Boolean);
  const selected=[...document.querySelectorAll<HTMLElement>(SelectorRegistry.rows)].filter(row=>normalizeName(rowName(row))===normalizeName(name)&&(row.getAttribute('aria-selected')==='true'||row.closest('[aria-selected="true"]')));
  const structural=explicitJid(header)||explicitJid(q('#main'))||(selected.length===1?explicitJid(selected[0])||explicitJid(selected[0].querySelector('[data-chat-id],[data-jid]')):null);if(structural)ids.push(structural);
  const unique=[...new Set(ids)];const jid=unique.length===1?unique[0]:null;
  const previous=jid?this.known.get(this.fullKey(jid)):null;
  const localKey=`${this.namespace}|local:${hash(normalizeName(name))}`;
  const markers=bindingMarkers(messageNodes(),this.settings),anchors=markers.ids;const candidates=[...this.bindings.values()].filter(b=>b.key.startsWith(this.namespace+'|')&&normalizeName(b.name)===normalizeName(name)&&anchors.some(id=>b.messageIds.includes(id)));const binding=candidates.length===1?candidates[0]:undefined;
  const sidebarSearch=chatSearch();const rows=sidebarSearch&&searchText(sidebarSearch)?[]:[...document.querySelectorAll<HTMLElement>(SelectorRegistry.rows)].filter(r=>!r.parentElement?.closest('[role="row"],[role="listitem"]')&&normalizeName(rowName(r))===normalizeName(name));
  const bound=unique.length===0&&!!binding&&rows.length<=1&&!markers.conflictingNative&&anchors.some(id=>binding.messageIds.includes(id));
  if(bound)binding!.messageIds=[...new Set([...binding!.messageIds,...anchors])].slice(-200);
  const verified=!!jid&&(!previous||normalizeName(previous.name)===normalizeName(name)||structural===jid);
  return {key:verified?this.fullKey(jid!):bound?binding!.key:localKey,name,type:verified?(jid!.endsWith('@g.us')?'group':'individual'):bound?binding!.type:'unknown',unread:0,mention:false,lastDirection:'unknown',lastAt:0,preview:'',verified:verified||bound,identityMode:verified?'jid':bound?'visible-bound':undefined,self:/\((?:you|आप)\)/i.test(name)||/message yourself|खुद को/i.test(text(header))};
 }
 restoreBindings(bindings:ConversationBinding[]){for(const b of bindings)if(b.key.startsWith(this.namespace+'|')&&!this.bindings.has(b.key))this.bindings.set(b.key,b);}
 getBindings(){return [...this.bindings.values()];}
 verifyCurrent(type:Chat['type']):ConversationBinding{
  const c=this.current();if(!c)throw Error('Open the intended WhatsApp chat first.');
  const rows=[...document.querySelectorAll<HTMLElement>(SelectorRegistry.rows)].filter(r=>!r.parentElement?.closest('[role="row"],[role="listitem"]')&&normalizeName(rowName(r))===normalizeName(c.name));
  if(rows.length!==1)throw Error('Chat name is ambiguous or unloaded. Use a unique contact name and load its row.');
  if(messageNodes().some(n=>jidFromMessageId(messageId(n))))throw Error('Native IDs conflict; this chat cannot use visible-message verification.');
  const markers=bindingMarkers(messageNodes(),this.settings),messageIds=markers.ids;if(markers.conflictingNative||markers.all.length&&!messageIds.length)throw Error('Duplicate message markers: keep a different dated message visible, then verify again.');if(!messageIds.length)throw Error('No dated message markers found. Keep a message and its date visible, then verify again. Download diagnostics while this chat is open.');
  if(type==='unknown')throw Error('Choose Individual or Group for this chat.');
  const binding={key:c.key,name:c.name,type,messageIds:[...new Set(messageIds)].slice(-200)};this.bindings.set(c.key,binding);this.scan();return binding;
 }
 messages(current:Chat|null=this.current()):Message[]{if(!current)return [];const out:Message[]=[];const seen=new Set<string>();for(const node of messageNodes()){
  const raw=messageId(node),jid=jidFromMessageId(raw);if(current.verified&&jid&&this.fullKey(jid)!==current.key)continue;const id=messageDomKey(node,current.key);if(seen.has(id))continue;seen.add(id);
  const content=[...node.querySelectorAll<HTMLElement>(SelectorRegistry.text)].find(candidate=>!candidate.closest(quoted));if(!content)continue;const ownNames=[...(this.settings.mentionAliases||[]),...[...this.known.values()].filter(c=>c.self).map(c=>c.name)];const direction=messageDirection(node,ownNames);if(!direction)continue;out.push({key:id,contactKey:current.key,body:text(content),direction,at:messageTime(node,this.settings),senderName:(node.getAttribute('data-pre-plain-text')||node.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text'))?.replace(/^\[[^\]]+\]\s*/,'').replace(/:\s*$/,'').trim(),senderKey:node.getAttribute('data-sender-id')||undefined,mentionedMe:direction==='in'&&ownMentionIn(node,this.settings,this.ownJids,ownNames)});
 }return out;}
 private isOwnMentionText(value:string){return ownMentionText(value,this.settings,[...this.known.values()].filter(c=>c.self).map(c=>normalizeName(c.name)));}
 scan(){this.rowMap.clear();const chats:Chat[]=[];const current=this.current();const previousTail=current?this.known.get(current.key)?.lastMessageKey:undefined;const messages=this.messages(current);const last=messages.at(-1);const names=new Map<string,number>();const sidebarSearch=chatSearch();const rows=sidebarSearch&&searchText(sidebarSearch)?[]:[...document.querySelectorAll<HTMLElement>(SelectorRegistry.rows)].filter(r=>!r.parentElement?.closest('[role="row"],[role="listitem"]'));
 for(const row of rows){const name=rowName(row);if(name)names.set(normalizeName(name),(names.get(normalizeName(name))||0)+1);}
 for(const row of rows){const name=rowName(row);if(!name)continue;
  const stored=[...this.known.values()].filter(x=>normalizeName(x.name)===normalizeName(name));const stable=stored.filter(c=>c.verified);const known=names.get(normalizeName(name))===1?(stable.length===1?stable[0]:stable.length===0&&stored.length===1?stored[0]:null):null;
  const isCurrent=current&&normalizeName(current.name)===normalizeName(name)&&names.get(normalizeName(name))===1;const key=isCurrent?current!.key:known?.key||`${this.namespace}|local:${hash(normalizeName(name))}`;
  const prior=this.known.get(key)||known||undefined,badge=q(SelectorRegistry.unread,row);const label=badge?.getAttribute('aria-label')||text(badge);const unread=badge?Math.max(1,Number(label.match(/\d+/)?.[0]||1)):0;
  const outgoing=Boolean(q(SelectorRegistry.outgoing,row));let direction:Chat['lastDirection']=prior?.lastDirection||'unknown';let at=prior?.lastAt||0;
  const preview=text(q('[data-testid="last-msg-status"], [data-testid="cell-frame-secondary"]',row))||text(row).replace(name,'').slice(0,220);
  const labelTime=[...row.querySelectorAll<HTMLElement>('time,span')].map(e=>e.getAttribute('datetime')||text(e)).find(t=>/^(?:\d{1,2}:\d{2}(?:\s*[AP]M)?|yesterday|today|कल|आज|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(t));const rowAt=labelTime?parseTimeLabel(labelTime,this.settings.timezone,this.settings.dateOrder):0;
  if(outgoing&&rowAt>0&&(rowAt>=at||prior?.preview===preview)){direction='out';at=rowAt;} else if(!outgoing&&prior?.preview&&prior.preview!==preview){direction=unread>(prior.unread||0)&&rowAt>0?'in':'unknown';at=Math.max(at,rowAt);}
  const nativeMention=Boolean(q(SelectorRegistry.mention,row));const previewNode=q('[data-testid="last-msg-status"], [data-testid="cell-frame-secondary"]',row);const ownPreviewMention=!outgoing&&(previewNode?ownMentionIn(previewNode,this.settings,this.ownJids):this.isOwnMentionText(preview));
  const mentionSignal=nativeMention&&!prior?.nativeMentionActive||ownPreviewMention&&prior?.preview!==preview;
  const type=isCurrent&&current!.type!=='unknown'?current!.type:known?.type&&known.type!=='unknown'?known.type:q(SelectorRegistry.group,row)?'group':'unknown';
  let c:Chat={...prior,key,name,type,unread,mention:!!prior?.mention,lastDirection:direction,lastAt:at,lastMessageKey:prior?.lastMessageKey,lastMessageObservedAt:rowAt>0&&(outgoing||direction==='in')&&(direction!==prior?.lastDirection||at!==prior?.lastAt)?Date.now():prior?.lastMessageObservedAt,preview,self:isCurrent?current!.self:/\((?:you|आप)\)/i.test(name),verified:Boolean(isCurrent?current?.verified:known?.verified),nativeMentionActive:nativeMention};
  if(mentionSignal){const loadedTag=isCurrent&&!rowAt&&!prior?.lastAt?messages.filter(m=>m.mentionedMe&&m.direction==='in').at(-1):undefined;Object.assign(c,{mention:true,mentionAt:rowAt||loadedTag?.at||Date.now(),mentionKey:loadedTag?.key||'row:'+hash(preview),mentionUpdatedAt:Date.now()});}
  if(!isCurrent&&outgoing&&prior?.mention&&prior.preview!==preview&&rowAt>0&&rowAt>=(prior.mentionAt||0))Object.assign(c,{mention:false,mentionReplyAt:rowAt,mentionReplyKey:undefined,mentionUpdatedAt:Date.now()});
  if(isCurrent)c=observeMessages(c,messages,{...prior,...Object.fromEntries(['mention','mentionAt','mentionKey','mentionReplyAt','mentionReplyKey','mentionUpdatedAt','nativeMentionActive'].map(k=>[k,(c as any)[k]]))} as Chat,rowAt);
  if(this.rowMap.has(key)){c.verified=false;c.key+=`:${chats.length}`;}this.rowMap.set(c.key,row);chats.push(c);this.known.set(c.key,c);
 }
 if(current){const indexed=chats.find(c=>c.key===current.key);Object.assign(current,indexed||observeMessages(current,messages,this.known.get(current.key)));this.known.set(current.key,current);if(current.self&&current.verified&&current.identityMode==='jid')this.ownJids.add(current.key.split('|').at(-1)!);}
 const fresh:Message[]=[];if(current){const firstVisit=!this.initialized.has(current.key);for(const m of messages){if(!this.seen.has(m.key)&&!firstVisit&&(!m.at||Date.now()-m.at<120000)&&(previousTail&&messages.findIndex(x=>x.key===previousTail)>=0?messages.findIndex(x=>x.key===m.key)>messages.findIndex(x=>x.key===previousTail):m.at>0&&Date.now()-m.at<120000))fresh.push({...m,at:m.at||Date.now()});this.seen.add(m.key);}if(messages.length)this.initialized.add(current.key);}
 this.changed(chats,current,messages,fresh);
 }
 getContacts(){return [...this.known.values()].map(c=>({...c,name:cleanContactName(c.name)}));}
 restore(chats:Chat[]){for(const c of chats){if(!c.key.startsWith(this.namespace+'|'))continue;this.known.set(c.key,mergeChatObservation(this.known.get(c.key),c));}}
 private savedTarget(c:{key:string;name:string}){if(!c.key.startsWith(this.namespace+'|'))return false;const known=this.known.get(c.key),binding=this.bindings.get(c.key);return !!(known?.verified&&normalizeName(known.name)===normalizeName(c.name)||binding?.messageIds.length&&normalizeName(binding.name)===normalizeName(c.name));}
 private targetRows(c:{key:string;name:string}){return [...document.querySelectorAll<HTMLElement>(SelectorRegistry.rows)].filter(r=>!r.parentElement?.closest('[role="row"],[role="listitem"]')&&visible(r)&&normalizeName(rowName(r))===normalizeName(c.name));}
 isPreparing(){return this.preparing;}
 canOpen(c:{key:string;name:string}){if(this.preparing||!this.savedTarget(c)||text(q(SelectorRegistry.composer))||Date.now()-this.typingAt<10000)return false;const search=chatSearch();if(search&&searchText(search))return false;const rows=this.targetRows(c);if(rows.length>1)return false;if(rows.length===1)return true;return !!search;}
 async prepareTarget(c:{key:string;name:string}){
  if(this.preparing)throw Error('Another target lookup is running. Retry shortly.');
  if(text(q(SelectorRegistry.composer))||Date.now()-this.typingAt<10000)throw Error('Manual draft/typing present; automation paused');
  const existingSearch=chatSearch();if(existingSearch&&searchText(existingSearch))throw Error('Clear your WhatsApp search to allow automatic target lookup. Your query was kept.');
  if(this.current()?.key===c.key&&this.current()?.verified)return;
  if(!this.savedTarget(c))throw Error('Target has not been verified. Open it once and use Verify open chat in Settings.');
  this.preparing=true;const generation=this.targetGeneration,namespace=this.namespace;let cancelled=false,interrupted=false,activated=false,search:HTMLElement|null=null,query='';let status='Target lookup paused';
  const abort=()=>{cancelled=true;};this.abortTarget=abort;
  const stop=(event:Event)=>{if(event.isTrusted&&!isOwnedSearchInput(event)&&!(event.target as Element)?.closest?.('#zfleet-root,[data-zfleet-owned]')){interrupted=true;abort();}};
  const check=()=>{if(cancelled||generation!==this.targetGeneration||namespace!==this.namespace)throw Error('Target lookup interrupted. No message was inserted.');if(text(q(SelectorRegistry.composer))||Date.now()-this.typingAt<10000)throw Error('Manual draft/typing present; automation paused');if(search){if(!search.isConnected){const replacement=chatSearch();if(replacement&&searchText(replacement)===query)search=replacement;else if(activated&&replacement&&!searchText(replacement)){search=replacement;query='';}else throw Error('WhatsApp search changed. Your input was kept; lookup paused.');}if(searchText(search)!==query){if(activated&&!searchText(search))query='';else throw Error('WhatsApp search changed. Your input was kept; lookup paused.');}}};
  for(const event of ['pointerdown','wheel','keydown','input'])document.addEventListener(event,stop,true);
  this.targetStatus({running:true,status:'Finding scheduled chat…'});
  try{
   await this.revealTarget?.();check();this.scan();let rows=this.targetRows(c);
   if(rows.length>1)throw Error('Duplicate chat name. Give the intended contact a unique name and verify it again.');
   if(!rows.length){search=chatSearch();if(!search)throw Error('Native WhatsApp chat search unavailable. Open the target once.');if(searchText(search))throw Error('Clear your WhatsApp search to allow automatic target lookup. Your query was kept.');query=cleanContactName(c.name);writeSearch(search,query);
    await this.wait(()=>{check();rows=this.targetRows(c);if(rows.length>1)throw Error('Duplicate chat name. Give the intended contact a unique name and verify it again.');return rows.length===1;},8000,'Saved target not found in WhatsApp search. Check its name or open it once.');
   }
   check();const row=rows[0];if(!row?.isConnected)throw Error('Target row changed. Lookup paused.');activated=true;activateChatRow(row);
   this.targetStatus({running:true,status:'Checking saved chat identity…'});
   await this.wait(()=>{check();const current=this.current();return current?.key===c.key&&current.verified&&normalizeName(current.name)===normalizeName(c.name);},6000,'Saved identity could not be confirmed. Open this chat once and verify its visible messages in Settings.');
   if(search&&searchText(search)===query){writeSearch(search,'');query='';search.blur();await new Promise(r=>setTimeout(r,200));}
   check();this.scan();const current=this.current();if(current?.key!==c.key||!current.verified)throw Error('Target changed after lookup. No message was inserted.');status='Saved target ready';
  }catch(e:any){status=e.message;throw e;}
  finally{
   for(const event of ['pointerdown','wheel','keydown','input'])document.removeEventListener(event,stop,true);
   if(!interrupted&&query&&search?.isConnected&&searchText(search)===query){try{writeSearch(search,'');search.blur();}catch{}}
   if(this.abortTarget===abort)this.abortTarget=undefined;this.preparing=false;this.targetStatus({running:false,status});
  }
 }
 health(){const parsed=this.messages();const nodes=messageNodes(),ids=nodes.map(n=>jidFromMessageId(messageId(n))).filter(Boolean),send=sendControls();return {latestParsedMessage:parsed.at(-1)?{direction:parsed.at(-1)!.direction,at:parsed.at(-1)!.at}:undefined,statusIcons:[...new Set([...document.querySelectorAll<HTMLElement>('#main [data-icon],#pane-side [data-icon]')].map(n=>n.getAttribute('data-icon')||''))].filter(v=>/check|done|tick|read|sent/i.test(v)).slice(0,20),sendButton:send.enabled.length===1,sendCandidates:send.controls.length,sendEnabled:send.enabled.length,footerIcons:[...new Set([...document.querySelectorAll<HTMLElement>('#main footer [data-icon]')].map(n=>n.getAttribute('data-icon')||''))].filter(v=>/^[a-zA-Z0-9_-]{1,60}$/.test(v)).slice(0,16),directionHints:{prePlain:document.querySelectorAll('#main [data-pre-plain-text]').length,outgoingChecks:document.querySelectorAll('#main '+SelectorRegistry.outgoing.split(',').map(x=>x.trim()).join(',#main ')).length,tailIn:document.querySelectorAll('#main [data-icon="tail-in"]').length,tailOut:document.querySelectorAll('#main [data-icon="tail-out"]').length},candidateMessageIds:document.querySelectorAll(SelectorRegistry.message).length,nativeMessageContainers:document.querySelectorAll('#main .message-in,#main .message-out').length,messageTextNodes:document.querySelectorAll('#main .selectable-text').length,idShapes:[...document.querySelectorAll<HTMLElement>(SelectorRegistry.message)].slice(0,8).map(n=>({attributes:n.getAttributeNames().filter(a=>a.startsWith('data-')||a==='id'),length:messageId(n).length,hasMessagePrefix:/^(true|false)_/.test(messageId(n)),jidDomains:messageId(n).match(/@[a-z.]+/g)||[]})),messageEnvelopes:nodes.length,recognizedMessageIds:ids.length,uniqueChatIdentities:new Set(ids).size,opaqueMessageIds:nodes.filter(n=>nativeAnchor(n)).length,visibleMessageMarkers:nodes.filter(n=>visibleAnchor(n,this.settings)).length,messageDirections:{incoming:nodes.filter(n=>messageDirection(n,this.settings.mentionAliases||[])==='in').length,outgoing:nodes.filter(n=>messageDirection(n,this.settings.mentionAliases||[])==='out').length},snapshotContext:q(SelectorRegistry.header)?'open-chat':'no-chat-open',envelopeShapes:nodes.slice(0,5).map(n=>({tag:n.tagName,attributes:n.getAttributeNames().filter(a=>a.startsWith('data-')||a==='role'),bodies:n.querySelectorAll(SelectorRegistry.text).length,nativeAnchor:!!nativeAnchor(n),datedAnchor:!!visibleAnchor(n,this.settings)})),identityMode:this.current()?.identityMode||'unverified',identityReason:this.current()?.verified?'Verified':!nodes.length?'Message envelopes not found':!ids.length?'Opaque message IDs: verify the open chat in Settings':'Conversation IDs conflict',version:SelectorRegistry.version,loggedIn:Boolean(q('#pane-side')),rows:document.querySelectorAll(SelectorRegistry.rows).length,header:Boolean(q(SelectorRegistry.header)),verifiedCurrent:!!this.current()?.verified,composer:Boolean(q(SelectorRegistry.composer)),draftPresent:!!q(SelectorRegistry.composer)?.textContent?.trim(),pageVisible:document.visibilityState==='visible',pageFocused:document.hasFocus(),backgroundSending:this.settings.backgroundSending!==false,online:navigator.onLine};}
 async open(c:Pick<Chat,'key'|'name'>,messageKey?:string){await this.revealTarget?.();this.scan();const local=c.key.startsWith('unverified:')||c.key.includes('|local:');const matches=[...this.rowMap.values()].filter(r=>normalizeName(rowName(r))===normalizeName(c.name));const row=this.rowMap.get(c.key)||(local&&matches.length===1?matches[0]:undefined);if(!row||!row.isConnected||normalizeName(rowName(row))!==normalizeName(c.name)){if(this.savedTarget(c))await this.prepareTarget(c);else throw Error('Chat is not in loaded rows. Search and open it in WhatsApp once, then verify it.');}else{activateChatRow(row);await this.wait(()=>local?normalizeName(this.current()?.name||'')===normalizeName(c.name):this.current()?.key===c.key,5000);}this.scan();if(messageKey){const nodes=messageNodes().filter(x=>messageDomKey(x,this.current()?.key||c.key)===messageKey);const node=nodes.length===1?nodes[0]:null;if(!node)throw Error('Chat opened. Original message is not loaded; use WhatsApp search.');node.scrollIntoView({block:'center'});node.style.outline='2px solid #00a884';setTimeout(()=>node.style.outline='',3000);}}
 async observeTarget(c:Pick<Chat,'key'|'name'>){await this.prepareTarget(c);}
 private wait(check:()=>boolean,ms:number,error='WhatsApp target or send confirmation unavailable'){return new Promise<void>((resolve,reject)=>{
  let done=false;let poll:ReturnType<typeof setInterval>,deadline:ReturnType<typeof setTimeout>;const observer=new document.defaultView!.MutationObserver(()=>run());
  const finish=(failure?:unknown)=>{if(done)return;done=true;observer.disconnect();clearInterval(poll);clearTimeout(deadline);failure?reject(failure):resolve();};
  const run=()=>{if(done)return;try{if(check())finish();}catch(e){finish(e);}};
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});poll=setInterval(run,250);deadline=setTimeout(()=>{run();if(!done)finish(Error(error));},ms);run();
 });}
 private editComposer(composer:HTMLElement,command:'insertText'|'delete',value?:string){composer.focus();const range=document.createRange();range.selectNodeContents(composer);if(command==='insertText')range.collapse(false);const selection=document.getSelection();if(!selection)throw Error('Composer selection unavailable');selection.removeAllRanges();selection.addRange(range);this.injecting=true;try{if(command==='insertText')return document.execCommand('insertText',false,value);const result=document.execCommand('insertText',false,'');if(text(composer)){range.selectNodeContents(composer);selection.removeAllRanges();selection.addRange(range);composer.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'deleteContentBackward'}));}return result;}finally{this.injecting=false;}}
 async send(job:Schedule):Promise<{status:'sent'|'failed'|'unknown';error?:string}>{
  if(this.sending)return {status:'failed',error:'Another message is being sent; this message was not inserted'};this.sending=true;
  let clicked=false;let owned:HTMLElement|null=null;let ownedText='';const edits=this.manualEdits;const body=job.body.replace(/\r\n/g,'\n').replace(/\u00a0/g,' ').trim();
  try{
   if(!navigator.onLine)throw Error('Network offline');const current=this.current();if(!current||!current.verified||current.key!==job.contact.key||normalizeName(current.name)!==normalizeName(job.contact.name))throw Error('Target identity mismatch; message not sent');
   let composer=q(SelectorRegistry.composer);if(!composer)throw Error('Message composer unavailable');if(text(composer))throw Error('Your draft is present. Automation paused.');if(Date.now()-this.typingAt<10000)throw Error('Manual typing detected');
   const msgs=this.messages(current);if(job.kind==='auto'&&(msgs.at(-1)?.key!==job.incomingKey||msgs.at(-1)?.direction!=='in'))throw Error('Incoming message was answered or changed');
   if(!body)throw Error('Message is empty');const before=new Set(msgs.map(x=>x.key));owned=composer;
   // execCommand emits the native editor input event. A second synthetic insertText event can insert the body twice.
   const inserted=this.editComposer(composer,'insertText',job.body);ownedText=text(composer);
   if(!inserted&&!ownedText)throw Error('WhatsApp editor rejected text insertion; nothing sent');
   await this.wait(()=>text(q(SelectorRegistry.composer))===body,2000,'WhatsApp editor did not accept the exact scheduled text; nothing sent');
   const staged=q(SelectorRegistry.composer);if(staged&&text(staged)===body&&this.manualEdits===edits){composer=staged;owned=staged;}
   if(this.manualEdits===edits)ownedText=body;
   if((!this.current()?.verified||this.current()?.key!==job.contact.key||normalizeName(this.current()?.name||'')!==normalizeName(job.contact.name))||!composer.isConnected||q(SelectorRegistry.composer)!==composer||text(composer)!==body||this.manualEdits!==edits)throw Error('Target/draft changed before send');
   if(job.kind==='auto'&&this.messages().at(-1)?.key!==job.incomingKey)throw Error('Manual reply race detected');
   await this.wait(()=>!!sendControl(),3000,'Send button unavailable or ambiguous; nothing sent');const send=sendControl()!;
   // Last identity check immediately before the single native send click.
   if((!this.current()?.verified||this.current()?.key!==job.contact.key||normalizeName(this.current()?.name||'')!==normalizeName(job.contact.name))||this.manualEdits!==edits||q(SelectorRegistry.composer)!==composer||text(composer)!==body||sendControl()!==send)throw Error('Target/draft changed');clicked=true;send.click();
   await this.wait(()=>this.current()?.verified===true&&this.current()?.key===job.contact.key&&normalizeName(this.current()?.name||'')===normalizeName(job.contact.name)&&this.messages().some(m=>m.direction==='out'&&!before.has(m.key)&&m.body===body),8000,'Send was clicked but a new outgoing message was not confirmed. Check the native chat before retrying.');
   return {status:'sent'};
  }catch(e:any){let error=e.message;if(!clicked&&owned&&ownedText&&owned.isConnected&&q(SelectorRegistry.composer)===owned&&this.manualEdits===edits&&text(owned)===ownedText&&this.current()?.key===job.contact.key&&normalizeName(this.current()?.name||'')===normalizeName(job.contact.name)){try{this.editComposer(owned,'delete');if(text(owned))error+=' Draft remains; review it in WhatsApp.';}catch{error+=' Draft remains; review it in WhatsApp.';}}return {status:clicked?'unknown':'failed',error};}finally{this.sending=false;}
 }
}
