import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeMessages,mergeChatObservation} from '../apps/extension/src/conversation-observation.ts';
import {initialState,matchesFilter,type Chat,type Message} from '../packages/shared/src/index.ts';
const at=Date.UTC(2026,9,3,9,3);
const chat:Chat={key:'default|team@g.us',name:'Team',type:'group',unread:0,mention:false,lastDirection:'unknown',lastAt:0,preview:'',verified:true};
const m=(key:string,direction:'in'|'out',mentionedMe=false,time=at):Message=>({key,contactKey:chat.key,body:key,direction,mentionedMe,at:time});
test('known latest native message repairs row receipt time when its unique preview still matches',()=>{const prior={...chat,lastDirection:'unknown' as const,lastAt:at+60000,lastMessageKey:'reply'};const result=observeMessages({...prior,preview:'reply'},[m('reply','out')],prior,at+60000,at+120000);assert.equal(result.lastDirection,'out');assert.equal(result.lastAt,at);assert(matchesFilter(result,'Awaiting Reply',{...initialState,settings:{...initialState.settings,graceMinutes:0}},at+120000));});
test('group mention survives reading and unrelated incoming messages, until a same-minute outgoing reply',()=>{
 const tagged=observeMessages({...chat,preview:'tag'},[m('tag','in',true)],undefined,at,at+1);assert(tagged.mention);
 const read=observeMessages({...tagged,unread:0,nativeMentionActive:false,preview:'other'},[m('tag','in',true),m('other','in')],tagged,at,at+2);assert(read.mention);
 const answered=observeMessages({...read,preview:'reply'},[m('tag','in',true),m('other','in'),m('reply','out')],read,at,at+3);assert(!answered.mention);assert.equal(answered.mentionReplyKey,'reply');
 assert(!observeMessages({...answered,preview:'tag'},[m('tag','in',true)],answered,at,at+4).mention,'loading answered history must not revive the tag');
});
test('another group tag after a reply in the same minute becomes pending again',()=>{
 const first=observeMessages({...chat,preview:'reply'},[m('tag','in',true),m('reply','out')],undefined,at,at+1);
 const second=observeMessages({...first,preview:'tag2'},[m('tag','in',true),m('reply','out'),m('tag2','in',true)],first,at,at+2);assert(second.mention);assert.equal(second.mentionKey,'tag2');assert.equal(second.lastDirection,'in');
});
test('native row signal is promoted to an actual tag and then cleared by a reply',()=>{
 const prior={...chat,mention:true,mentionAt:at,mentionKey:'row:abc',mentionUpdatedAt:at+1,preview:'tag'};
 const result=observeMessages({...prior,preview:'reply'},[m('tag','in',true),m('reply','out')],prior,at,at+2);assert(!result.mention);assert.equal(result.mentionKey,'tag');
});
test('loading older messages cannot overwrite newer incoming state or clear its pending tag',()=>{
 const prior={...chat,mention:true,mentionAt:at+60000,mentionKey:'newtag',lastAt:at+60000,lastDirection:'in' as const,lastMessageKey:'newtag',preview:'newtag'};
 const result=observeMessages(prior,[m('oldreply','out')],prior,at+60000,at+61000);assert(result.mention);assert.equal(result.lastDirection,'in');assert.equal(result.lastMessageKey,'newtag');
});
test('native message order resolves outgoing then incoming within the same displayed minute',()=>{
 const prior={...chat,lastDirection:'out' as const,lastAt:at+20000,lastMessageKey:'sent',preview:'sent'};
 const result=observeMessages({...prior,preview:'received'},[m('sent','out'),m('received','in')],prior,at,at+21000);assert.equal(result.lastDirection,'in');assert.equal(result.lastMessageKey,'received');assert(!matchesFilter(result,'Awaiting Reply',initialState));
});
test('a pending mention and its answered state survive stale server and local merges',()=>{
 const pending={...chat,mention:true,mentionAt:at,mentionKey:'tag',mentionUpdatedAt:at+1};
 assert(mergeChatObservation(pending,{...chat,lastAt:at+5000}).mention);
 const answered={...pending,mention:false,mentionReplyKey:'reply',mentionReplyAt:at,mentionUpdatedAt:at+2};
 assert(!mergeChatObservation(answered,pending).mention);assert(!mergeChatObservation(pending,answered).mention);
});
test('Mentions includes pending group and individual tags and an upgraded legacy flag clears on reply',()=>{
 assert(matchesFilter({...chat,mention:true},'Mentions',initialState));assert(matchesFilter({...chat,type:'individual',mention:true},'Mentions',initialState));
 const prior={...chat,mention:true,lastAt:at,lastDirection:'in' as const,lastMessageKey:'old',preview:'old'};
 assert(!observeMessages({...prior,preview:'reply'},[m('old','in'),m('reply','out')],prior,at,at+1).mention);
});

test('initial loaded history keeps a new tag after an answered tag in the same minute pending',()=>{
 const result=observeMessages({...chat,preview:'tag2'},[m('tag','in',true),m('reply','out'),m('tag2','in',true)],undefined,at,at+1);assert(result.mention);assert.equal(result.mentionKey,'tag2');
});

test('stable dated native evidence repairs a loading-time receipt timestamp and direction for the same message',()=>{const prior={...chat,lastDirection:'in' as const,lastAt:at+600000,lastMessageKey:'reply',preview:'reply'};const result=observeMessages(prior,[m('reply','out')],prior,at,at+600001);assert.equal(result.lastDirection,'out');assert.equal(result.lastAt,at);assert(matchesFilter(result,'Awaiting Reply',{...initialState,settings:{...initialState.settings,graceMinutes:0}},at+1));});
test('a latest native preview can correct receipt-time server state while older scrollback remains blocked',()=>{const prior={...chat,lastDirection:'in' as const,lastAt:at+600000};const result=observeMessages({...prior,preview:'reply'},[m('reply','out')],prior,at,at+600001);assert.equal(result.lastDirection,'out');assert.equal(result.lastAt,at);const older=observeMessages({...prior,preview:'new incoming'},[m('reply','out')],prior,at+600000,at+600001);assert.equal(older.lastDirection,'in');});
test('repaired native direction survives stale server receipt metadata but yields to a newer incoming receipt',()=>{const receipt={...chat,lastDirection:'in' as const,lastAt:at+600000,lastMessageKey:'reply'};const native=observeMessages({...receipt,preview:'reply'},[{...m('reply','out'),at}],receipt,at,at+610000);assert.equal(mergeChatObservation(native,receipt).lastDirection,'out');assert.equal(mergeChatObservation(receipt,native).lastAt,at);const incoming={...receipt,lastMessageKey:undefined,lastAt:at+620000};assert.equal(mergeChatObservation(native,incoming).lastDirection,'in');});
