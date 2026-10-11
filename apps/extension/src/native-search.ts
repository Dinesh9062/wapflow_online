/** Native chat-list search only; never the conversation composer or message search. */
export function chatSearch(){
 const pane=document.querySelector<HTMLElement>('#pane-side');
 for(let scope=pane?.parentElement;scope;scope=scope.parentElement){
  const candidates=[...scope.querySelectorAll<HTMLElement>('input,[role="textbox"][contenteditable="true"]')].filter(n=>{
   if(n.closest('#main,#pane-side,#zfleet-root,[data-zfleet-owned]'))return false;
   for(let p:HTMLElement|null=n;p&&p!==scope.parentElement;p=p.parentElement){const css=p.ownerDocument.defaultView?.getComputedStyle(p);if(p.hidden||p.getAttribute('aria-hidden')==='true'||css?.display==='none'||css?.visibility==='hidden')return false;}
   return /search|खोज|सर्च/i.test([n.getAttribute('aria-label'),n.getAttribute('placeholder'),n.getAttribute('aria-placeholder'),n.getAttribute('data-testid')].join(' '));
  });
  if(candidates.length===1)return candidates[0];if(candidates.length>1)return null;
 }
 return null;
}
export const searchText=(node:HTMLElement)=>node instanceof node.ownerDocument.defaultView!.HTMLInputElement?node.value:(node.innerText??node.textContent??'').replace(/\u00a0/g,' ').trim();
const writingSearch=new WeakSet<HTMLElement>();
/** execCommand can emit a trusted input event. Ownership is synchronous and scoped to this editor. */
export function isOwnedSearchInput(event:Event){
 if(event.type!=='input')return false;
 for(let node=event.target as HTMLElement|null;node;node=node.parentElement)if(writingSearch.has(node))return true;
 return false;
}
export function writeSearch(node:HTMLElement,value:string){
 if(!node.isConnected)throw Error('WhatsApp search changed. Lookup paused.');node.focus();
 writingSearch.add(node);try{
 if(node instanceof node.ownerDocument.defaultView!.HTMLInputElement){
  const set=Object.getOwnPropertyDescriptor(node.ownerDocument.defaultView!.HTMLInputElement.prototype,'value')!.set!;set.call(node,value);
  node.dispatchEvent(new node.ownerDocument.defaultView!.InputEvent('input',{bubbles:true,inputType:'insertReplacementText',data:value}));
 }else{
  const selection=node.ownerDocument.getSelection(),range=node.ownerDocument.createRange();if(!selection)throw Error('WhatsApp search selection unavailable.');range.selectNodeContents(node);selection.removeAllRanges();selection.addRange(range);
  // Like the native composer, this editor owns its input event. Do not replay insertion.
  node.ownerDocument.execCommand('insertText',false,value);
 }
 if(searchText(node)!==value)throw Error('WhatsApp search did not accept the target query. Lookup paused.');
 }finally{writingSearch.delete(node);}
}
