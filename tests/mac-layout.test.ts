import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {WhatsAppAdapter,messageNodes} from '../apps/extension/src/adapter.ts';
import {defaultSettings,initialState,matchesFilter} from '../packages/shared/src/index.ts';
import {parseTimeLabel} from '../apps/extension/src/observation.ts';

// Report shape: opaque IDs, nested msg-container bodies and a broad dated ancestor.
// This models DOM evidence, not an OS-specific browser API.
const bubble=(id:number,out=false,body='Hello')=>`<div data-pre-plain-text="[9:${String(id).padStart(2,'0')} a.m., 11/10/2026] ${out?'You':'Contact'}:"><div data-testid="msg-container"><div data-id="MACMESSAGE0000000000${id}" data-testid="message"><span data-testid="msg-text"><span class="selectable-text">${body}</span></span></div></div><span data-icon="tail-${out?'out':'in'}"></span></div>`;
function fixture(){
 const dom=new JSDOM(`<div id="pane-side"><div role="row"><span dir="auto" title="Contact">Contact</span></div><div role="row"><span dir="auto" title="Other">Other</span></div></div><div id="main"><header><span title="Contact" dir="auto">Contact</span></header><div id="messages" data-pre-plain-text="[9:00, 11/10/2026] Wrong transcript sender:">${Array.from({length:14},(_,i)=>bubble(i+1,i%2===1)).join('')}</div><footer><div contenteditable="true" role="textbox"></div><button aria-label="Send"><span data-icon="send"></span></button></footer></div>`,{url:'https://web.whatsapp.com/',pretendToBeVisual:true});
 for(const k of ['window','document','navigator','MutationObserver','HTMLElement','InputEvent','Event'])Object.defineProperty(globalThis,k,{value:(dom.window as any)[k],configurable:true});
 let snapshot:any;const adapter=new WhatsAppAdapter((chats,current,messages,fresh)=>snapshot={chats,current,messages,fresh});
 adapter.configure({...defaultSettings,mentionAliases:['My mention name']});
 return {dom,adapter,get:()=>snapshot};
}
test('Mac-shaped broad dated transcript is split into fourteen unique messages with correct sender, direction and clock',()=>{
 const f=fixture();try{f.adapter.scan();const {messages,current}=f.get();assert.equal(messageNodes().length,14);assert.equal(messages.length,14);assert.equal(new Set(messages.map((m:any)=>m.key)).size,14);assert.deepEqual(messages.map((m:any)=>m.direction),Array.from({length:14},(_,i)=>i%2===1?'out':'in'));assert.equal(messages[0].senderName,'Contact');assert.equal(messages[13].senderName,'You');assert.equal(messages[13].at,Date.parse('2026-10-11T03:44:00Z'));assert.equal(current.lastDirection,'out');assert(matchesFilter(current,'Awaiting Reply',initialState,Date.parse('2026-10-11T10:00:00Z')));assert(!current.verified);const binding=f.adapter.verifyCurrent('individual');assert.equal(binding.messageIds.length,14);assert(f.adapter.current()?.verified);assert.deepEqual(f.adapter.health().messageDirections,{incoming:7,outgoing:7});assert.equal(f.adapter.health().recognizedMessageIds,0);}finally{f.dom.window.close();}
});
test('Mac-shaped mention remains pending through reads and clears only after a later outgoing message',()=>{
 const f=fixture();try{document.getElementById('messages')!.innerHTML=bubble(1,false,'Please check @My mention name');f.adapter.scan();assert(f.get().current.mention);f.adapter.scan();assert(f.get().current.mention);document.getElementById('messages')!.insertAdjacentHTML('beforeend',bubble(2,true,'Checked'));f.adapter.scan();assert.equal(f.get().current.mention,false);assert.equal(f.get().current.lastDirection,'out');}finally{f.dom.window.close();}
});
test('Mac-shaped verified target is found from another open chat and its reminder is confirmed exactly once',async()=>{
 const f=fixture();try{f.adapter.scan();f.adapter.verifyCurrent('individual');const target=f.adapter.current()!;const history=document.getElementById('messages')!.innerHTML;document.querySelector('#main header span')!.setAttribute('title','Other');document.querySelector('#main header span')!.textContent='Other';document.getElementById('messages')!.innerHTML=bubble(20,false,'Other conversation');document.querySelector('#pane-side [role="row"]')!.addEventListener('click',()=>{document.querySelector('#main header span')!.setAttribute('title','Contact');document.querySelector('#main header span')!.textContent='Contact';document.getElementById('messages')!.innerHTML=history;});
 assert(f.adapter.canOpen(target));await f.adapter.prepareTarget(target);assert.equal(f.adapter.current()?.key,target.key);
 (document as any).execCommand=(cmd:string,_b:any,value:string)=>{if(cmd==='insertText')document.querySelector('[contenteditable]')!.textContent=value;return true;};let clicks=0;document.querySelector('footer button')!.addEventListener('click',()=>{clicks++;document.getElementById('messages')!.insertAdjacentHTML('beforeend',bubble(15,true,'Reminder'));document.querySelector('[contenteditable]')!.textContent='';});const result=await f.adapter.send({id:'mac-reminder',contact:target,body:'Reminder',dueAt:new Date().toISOString(),repeat:'none',repeatDays:1,timezone:'Asia/Kolkata',status:'ready',consent:true});assert.equal(result.status,'sent');assert.equal(clicks,1);assert.equal(document.querySelector('[contenteditable]')!.textContent,'');}finally{f.dom.window.close();}
});
test('Mac clock with narrow space, dotted AM/PM and direction controls is parsed in the account timezone',()=>{
 assert.equal(parseTimeLabel('\u2068[9:14\u202fp.m., 11/10/2026]\u2069 You:'),Date.parse('2026-10-11T15:44:00Z'));
 assert.equal(parseTimeLabel('[12:00\u00a0a.m., 11/10/2026] Contact:'),Date.parse('2026-10-10T18:30:00Z'));
});
test('continuous native mutations still deliver fresh observations before the mutation stream ends',async()=>{
 const f=fixture();let adapter:WhatsAppAdapter|undefined,timer:ReturnType<typeof setInterval>|undefined;let changing=true,observedDuringStream=false;
 try{adapter=new WhatsAppAdapter((_c,_current,_messages,fresh)=>{if(changing&&fresh.length)observedDuringStream=true;});adapter.start();document.getElementById('messages')!.insertAdjacentHTML('beforeend',bubble(15,false,'New incoming'));document.getElementById('messages')!.lastElementChild!.querySelector('[data-id]')!.setAttribute('data-timestamp',String(Date.now()));let i=0;timer=setInterval(()=>document.querySelector('#main header span')!.setAttribute('aria-label','Live '+(++i)),40);await new Promise(r=>setTimeout(r,1100));changing=false;assert(observedDuringStream,'Live updates were starved until DOM activity stopped');}finally{clearInterval(timer);adapter?.stop();f.dom.window.close();}
});
