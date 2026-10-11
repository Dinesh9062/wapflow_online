import type {Settings} from '../../../packages/shared/src/index.ts';
import {chatSearch,searchText,writeSearch,isOwnedSearchInput} from './native-search.ts';
import {mentionQueries,type MentionQuery} from './mentions.ts';

/** Uses the user's native WhatsApp global search. It never opens chats or sends. */
export class NativeMentionSearch {
 private node:HTMLElement|null=null;private owned='';private signature='';private attempted=false;private selected='';
 active=false;status='';options:MentionQuery[]=[];
 constructor(private changed:()=>void=()=>{}){}
 private onInput=(e:Event)=>{if(e.target!==this.node||isOwnedSearchInput(e))return;if(e.isTrusted||this.node&&searchText(this.node)!==this.owned){this.release();this.status='Your WhatsApp search changed. It was kept; choose Pending or clear search and Refresh mentions.';this.changed();}};
 private release(){this.node?.removeEventListener('input',this.onInput);this.node=null;this.owned='';this.active=false;}
 current(){return this.options.find(q=>q.id===this.selected)||this.options[0];}
 start(settings:Settings){
  const options=mentionQueries(settings),signature=JSON.stringify([settings.accountNamespace,options]);
  if(signature!==this.signature){this.stop();this.signature=signature;this.attempted=false;this.selected='';}
  this.options=options;
  if(this.active&&(!this.node?.isConnected||searchText(this.node)!==this.owned)){this.release();this.status='Native search changed. Clear it or use Pending; your input was kept.';}
  if(this.attempted)return;this.attempted=true;
  const query=this.current();if(!query){this.status='Set your WhatsApp number or exact @name/emoji in Settings, then Refresh mentions.';return;}
  const search=chatSearch();if(!search){this.status='Native WhatsApp search is unavailable. Use Pending or wait for WhatsApp to finish loading.';return;}
  if(searchText(search)){this.status='Clear your existing WhatsApp search first. Your query was kept unchanged.';return;}
  this.selected=query.id;this.node=search;this.owned=query.value;this.active=true;search.addEventListener('input',this.onInput);
  try{writeSearch(search,query.value);this.status='WhatsApp is searching message history. Open a native result to jump to that message.';}
  catch{this.release();this.status='WhatsApp did not accept the search. Use Pending or Refresh mentions after loading.';}
 }
 choose(id:string,settings:Settings){if(!mentionQueries(settings).some(q=>q.id===id))return;this.stop();this.selected=id;this.attempted=false;this.start(settings);}
 refresh(settings:Settings){this.stop();this.attempted=false;this.start(settings);}
 stop(){const node=this.node,query=this.owned;this.release();this.attempted=false;if(node?.isConnected&&query&&searchText(node)===query){try{writeSearch(node,'');node.blur();}catch{}}}
}
