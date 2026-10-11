import type {Settings} from '../../../packages/shared/src/index.ts';

export const quotedMention='[data-testid*="quoted"], [data-testid*="reply-context"], [data-testid*="quoted-message"], .quoted-mention, blockquote';
const normalized=(s:string)=>s.normalize('NFKC').replace(/[\u200e\u200f\u202a-\u202e\ufe0f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
export function phoneVariants(phone=''){
 const full=phone.replace(/\D/g,'');if(full.length<8||full.length>15)return [];
 // The configured Indian country code has an unambiguous ten-digit local form.
 return full.length===12&&full.startsWith('91')?[full,full.slice(2)]:[full];
}
export function mentionText(node:Element){
 const clone=node.cloneNode(true) as HTMLElement;clone.querySelectorAll(quotedMention+', [data-zfleet-owned]').forEach(n=>n.remove());
 clone.querySelectorAll('img[alt]').forEach(n=>n.replaceWith(node.ownerDocument.createTextNode(n.getAttribute('alt')||'')));
 clone.querySelectorAll('br').forEach(n=>n.replaceWith(node.ownerDocument.createTextNode('\n')));
 return clone.textContent||'';
}
export function ownMentionText(value:string,settings:Pick<Settings,'ownPhone'|'mentionAliases'>,names:string[]=[]){
 const body=normalized(value),aliases=[...(settings.mentionAliases||[]),...names].map(s=>normalized(s.replace(/^@/,''))).filter(Boolean);
 for(const alias of aliases){let from=0;while((from=body.indexOf('@'+alias,from))>=0){const before=body[from-1],after=body[from+alias.length+1];if((!before||!/[\p{L}\p{N}_.@]/u.test(before))&&(!after||!/[\p{L}\p{N}_]/u.test(after)))return true;from++;}}
 const phones=phoneVariants(settings.ownPhone);for(const m of body.matchAll(/(^|[^\p{L}\p{N}_.@])@\s*(\+?\d(?:[\d ()-]{4,22}\d)?)(?!\d)/gu)){if(phones.includes(m[2].replace(/\D/g,'')))return true;}
 return false;
}
export function ownMentionIn(node:HTMLElement,settings:Pick<Settings,'ownPhone'|'mentionAliases'>,ownJids:ReadonlySet<string>=new Set(),names:string[]=[]){
 if(node.closest(quotedMention))return false;
 const phones=phoneVariants(settings.ownPhone);
 const owned=(value:string)=>ownJids.has(value)||(!value.includes('@')||/@(?:c\.us|s\.whatsapp\.net)$/.test(value))&&phones.includes(value.replace(/@(?:c\.us|s\.whatsapp\.net)$/,'').replace(/^tel:/,'').replace(/\D/g,''));
 const candidates=[node,...node.querySelectorAll<HTMLElement>('[data-is-self-mention="true"], [data-mention-jid], [data-jid], a[href^="tel:"]')];
 for(const tag of candidates){if(tag.closest(quotedMention))continue;if(tag.getAttribute('data-is-self-mention')==='true')return true;
  const explicit=tag.getAttribute('data-mention-jid');if(explicit&&owned(explicit))return true;
  const rendered=mentionText(tag).trim();const nativeTag=rendered.startsWith('@')||tag.matches('.mention, [data-testid*="mention"], [data-mention]');
  if(nativeTag&&[tag.getAttribute('data-jid'),tag.getAttribute('href')].some(v=>v&&owned(v)))return true;
 }
 return ownMentionText(mentionText(node),settings,names);
}

export type MentionQuery={id:string;label:string;value:string;kind:'phone'|'alias'};
export function mentionQueries(settings:Pick<Settings,'ownPhone'|'mentionAliases'>):MentionQuery[]{
 const phones=phoneVariants(settings.ownPhone);const result:MentionQuery[]=phones.slice().reverse().map((p,i)=>({id:'phone:'+p,label:i===0&&phones.length>1?'Your number':'Country-code number',value:'@'+p,kind:'phone'}));
 for(const alias of settings.mentionAliases||[]){const value='@'+alias.trim().replace(/^@/,'');if(value.length>1&&!result.some(q=>normalized(q.value)===normalized(value)))result.push({id:'alias:'+value,label:value,value,kind:'alias'});}
 return result;
}
