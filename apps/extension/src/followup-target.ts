import {sameReminderRecipient,type Chat,type ConversationBinding} from '../../../packages/shared/src/index.ts';

// Resolve a saved task independently of the currently open native conversation.
// Names may migrate a local task only when there is one verified identity.
export function reminderTarget(contact:Pick<Chat,'key'|'name'|'type'>,chats:Chat[],bindings:ConversationBinding[]):Chat|null {
 const candidates=new Map<string,Chat>();
 for(const b of bindings){if(!b.messageIds.length)continue;candidates.set(b.key,{...b,verified:true,unread:0,mention:false,lastDirection:'unknown',lastAt:0,preview:''});}
 for(const c of chats){
  if(!c.verified)continue;
  // A server receipt marked verified is not a saved opaque-chat binding.
  // Local identities still need the marker evidence that the native adapter uses.
  const binding=bindings.find(b=>b.key===c.key&&b.messageIds.length&&sameReminderRecipient(b,c));
  if(c.key.includes('|local:')&&!binding)continue;
  candidates.set(c.key,c);
 }
 const matches=[...candidates.values()].filter(c=>sameReminderRecipient(contact,c));
 if(matches.length>1)throw Error('More than one verified chat matches this follow-up. Open the intended chat and verify it; use a unique contact name.');
 return matches[0]||null;
}
