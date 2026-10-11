import type {Message} from '../../../packages/shared/src/index.ts';
import {messageNodes,messageDomKey,SelectorRegistry} from './adapter.ts';
export function mountMessageActions(messages:Message[],emit:(kind:'followup'|'schedule',key:string)=>void){
 for(const old of document.querySelectorAll<HTMLElement>('[data-zfleet-message-actions]'))if(!messages.some(m=>m.key===old.dataset.messageKey))old.remove();
 for(const message of messages){const node=messageNodes().find(n=>messageDomKey(n,message.contactKey)===message.key);
  if(!node||node.querySelector('[data-zfleet-message-actions]'))continue;const tools=document.createElement('span');tools.dataset.zfleetOwned='true';tools.dataset.zfleetMessageActions='true';tools.dataset.messageKey=message.key;tools.style.cssText='display:flex;gap:8px;margin:4px 0;font:11px system-ui;position:relative;z-index:2';
  for(const [kind,label] of [['followup','＋ Follow-up'],['schedule','◷ Send reminder']] as const){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',label+' for this message');button.style.cssText='border:1px solid #00a88455;border-radius:6px;background:var(--panel-background,#fff);color:#008b70;padding:3px 6px;cursor:pointer';button.onclick=e=>{e.preventDefault();e.stopPropagation();emit(kind,message.key);};tools.append(button);}node.append(tools);
 }
}
