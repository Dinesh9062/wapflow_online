import type {Chat,Message} from '../../../packages/shared/src/index.ts';

const compact=(s:string)=>s.replace(/[\u200e\u200f]/g,'').replace(/\s+/g,' ').trim();
/** Read history without moving the known latest message backwards. Equal-minute clocks use native order. */
export function observeMessages(chat:Chat,messages:Message[],prior:Chat|undefined,rowAt=0,now=Date.now()):Chat{
 const out={...chat};const last=messages.at(-1);const previousIndex=messages.findIndex(m=>m.key===prior?.lastMessageKey);
 const preview=compact(chat.preview);const body=last?compact(last.body):'';
 const previewMatches=!!body&&preview.includes(body.slice(0,Math.min(60,body.length)))&&messages.filter(m=>compact(m.body)===body).length===1;
 const at=last?.at||rowAt||(!prior?.lastAt?now:0);
 // Loading/receipt clocks may be newer than the actual message. Native order or
 // a unique latest-row preview repairs them, provided the row is not newer history.
 const nativeLatest=previousIndex>=0||previewMatches;
 const tailMatches=!!last&&(!prior?.lastAt||at>prior.lastAt||nativeLatest);
 const notOlderThanRow=!rowAt||!last?.at||last.at>=rowAt||previewMatches;
 if(last&&tailMatches&&notOlderThanRow){out.lastDirection=last.direction;out.lastAt=at;out.lastMessageKey=last.key;if(last.key!==prior?.lastMessageKey||at!==prior?.lastAt||last.direction!==prior?.lastDirection)out.lastMessageObservedAt=now;}
 else if(prior&&prior.lastAt>out.lastAt){out.lastDirection=prior.lastDirection;out.lastAt=prior.lastAt;out.lastMessageKey=prior.lastMessageKey;}

 let mentionAt=prior?.mentionAt||0,mentionKey=prior?.mentionKey,replyAt=prior?.mentionReplyAt||0,replyKey=prior?.mentionReplyKey,pending=!!prior?.mention;
 const replyIndex=messages.findIndex(m=>m.key===replyKey);

 for(let i=0;i<messages.length;i++){const m=messages[i];if(m.direction!=='in'||!m.mentionedMe)continue;
  const rowMatches=mentionKey?.startsWith('row:')&&(m.at===mentionAt||m===last&&previewMatches)&&[preview,compact(prior?.preview||'')].some(p=>!!compact(m.body)&&p.includes(compact(m.body)));
  // A previously answered tag does not return just because older history is loaded.
  const afterReply=replyIndex>=0?i>replyIndex:m.at>replyAt||(!replyAt&&!replyKey)||m.at===replyAt&&pending&&rowMatches;
  if(afterReply&&(!mentionKey||m.at>mentionAt||m.key===mentionKey||messages.findIndex(x=>x.key===mentionKey)>=0&&i>messages.findIndex(x=>x.key===mentionKey)||rowMatches)){mentionAt=m.at||mentionAt||now;mentionKey=m.key;pending=true;}
 }
 const mentionIndex=messages.findIndex(m=>m.key===mentionKey);
 const outgoing=messages.map((m,i)=>({m,i})).filter(({m,i})=>m.direction==='out'&&(mentionIndex>=0?i>mentionIndex:mentionAt>0&&(m.at>mentionAt||m.at===mentionAt&&previousIndex>=0&&i>previousIndex))).at(-1);
 if(outgoing&&(!replyAt||outgoing.m.at>=replyAt||replyIndex>=0&&outgoing.i>replyIndex)){replyAt=outgoing.m.at||now;replyKey=outgoing.m.key;pending=false;}
 // Upgrade an older saved pending flag when a newly observed latest reply is trustworthy.
 if(pending&&!mentionAt&&last?.direction==='out'&&out.lastMessageKey===last.key&&last.key!==prior?.lastMessageKey){replyAt=last.at||out.lastAt;replyKey=last.key;pending=false;}
 const changed=pending!==!!prior?.mention||mentionKey!==prior?.mentionKey||replyKey!==prior?.mentionReplyKey;
 return {...out,mention:pending,mentionAt,mentionKey,mentionReplyAt:replyAt,mentionReplyKey:replyKey,mentionUpdatedAt:changed?now:prior?.mentionUpdatedAt};
}

export function mergeChatObservation(prior:any,next:any){if(!prior)return next;const result={...prior,...next};
 const clock=(c:any)=>Math.max(c.lastAt||0,c.lastMessageObservedAt||0);
 if(clock(prior)>clock(next))Object.assign(result,{lastDirection:prior.lastDirection,lastAt:prior.lastAt,lastMessageKey:prior.lastMessageKey,lastMessageObservedAt:prior.lastMessageObservedAt});
 if(prior.lastAt===next.lastAt&&!next.lastMessageKey&&prior.lastMessageKey)Object.assign(result,{lastDirection:prior.lastDirection,lastMessageKey:prior.lastMessageKey});
 const mentionOwner=(prior.mentionUpdatedAt||0)>(next.mentionUpdatedAt||0)?prior:next;
 for(const key of ['mention','mentionAt','mentionKey','mentionReplyAt','mentionReplyKey','mentionUpdatedAt','nativeMentionActive'])if(key in mentionOwner)result[key]=mentionOwner[key];
 if(next.type==='unknown'&&prior.type!=='unknown')result.type=prior.type;return result;}
