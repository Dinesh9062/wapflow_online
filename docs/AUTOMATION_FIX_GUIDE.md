> Current release **1.4.12**: see [BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md](BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md) for background sending, Custom weekdays, preserved intervals and complete update steps. Existing numeric limits and saved quiet-hour choices are retained. Earlier release details below are historical.

> Current release 1.4.9 / dom-v13: follow-up verification, linked reminder queue and server timing controls are described fully in [FOLLOWUP_REMINDER_GUIDE.md](FOLLOWUP_REMINDER_GUIDE.md). Update API and extension together. Quiet hours/contact limits may defer sends; old auto replies expire rather than replay after long delays. Earlier version details below remain historical.

# Auto Reply / Schedule / Send reminder fix — v1.4.8

Latest two screenshots aur Wapflow_diagnostics(3).json reviewed. Rule “Message acknowledgement” ON hai, Contact specific hai, response `20000`, All day / Asia-Kolkata, cooldown 1 minute, daily cap 6. Is rule ko recreate karna ya account reset karna zaroori nahi.

## Kya fix hua

- **Search khud interrupt ho raha tha:** native contenteditable search insertion ka browser input event trusted ho sakta hai. Older listener ise user interruption maanta tha. Synchronous OWNED search input ab lookup/mention search cancel nahi karta. Uske baad user input/pointer/keyboard interruption ab bhi pause karta hai.
- **Outer row click enough nahi tha:** current native builds nested cell ke mouse/pointer handler se chat open kar sakte hain. Original name/cell ko pointer/mouse/click sequence diya jaata hai. Actual recipient header + native ID/saved message markers verify hone ke baad hi job claim/send hota hai.
- **Native query clear:** WhatsApp result open karte waqt apna search clear kare to lookup continue kar sakta hai. Nonempty changed manual query preserve hota hai. Replaced search editor only exact owned query ke saath reuse hota hai.
- **Incoming lose nahi hoga:** NEW loaded-row unread increase during a draft, manual search, directory pass or another target lookup is retained for a foreground retry. Two-minute observation window applies; expired or different-owner/account-label evidence is discarded. Paused/no-rule state does not replay unread history later.
- **Actual separate messages:** broad msg-container mein kai dated messages hon to they are read separately. One large body cannot hide the latest incoming or borrow another message identity.
- **Date proof:** latest report ka parsed message 10 May hai, observation 5 October. An ambiguous numeric date is resolved ONLY when a visible native Today/Yesterday/weekday exactly proves the opposite numeric interpretation. No DMY/MDY setting changes silently; without native proof it remains authoritative.

## Complete update: original setup rakhein

1. Old API/worker stop karein. Complete new source ZIP NEW folder mein extract karein. ORIGINAL `.env` copy karein. Same database, JWT/encryption keys aur account label rakhein. Selected old/new files mix na karein.
2. PostgreSQL/Redis running rakhein. PowerShell mein new ZFLEET-Connect folder se, each command on its own line:

```powershell
npm ci
npm run db:migrate
npm run check:setup
npm run typecheck
npm run build
npm run dev:api
```

3. Second terminal mein SAME new folder se `npm run dev:worker`. 1.4.8 adds no database migration; db:migrate safely applies missing prior migrations.
4. Same Chrome extension card keep karein. Us card ke loaded folder mein ALL new `apps/extension/dist` files replace karein; root mein manifest.json ho. Reload that card, then refresh WhatsApp. Settings **1.4.8 / 2026.10.05-dom-v12** check karein. localhost:4000 is the supplied API host.

## Dinesh schedule ka test

1. Intended **Dinesh** native chat ek baar open karein. `verifiedCurrent` true hai to existing binding use ho sakta hai. False ho to Verify open chat: correct Individual/Group, visible unique messages/date, intended-chat confirmation checkbox tick, then Verify. Saved name alone is insufficient.
2. Old report already has **12 Sent schedules**; screenshot shows “hello dinesh mesg test 25” delivered after opening Dinesh. Already sent messages ko retry na karein. Unknown/Failed jobs need actual delivery review.
3. NEW future test message + explicit send consent save karein. Ab kisi OTHER user ki chat open karein. That other chat need not be verified to locate the saved verified Dinesh target. WhatsApp foreground/online, composer/search empty aur API/worker running chahiye.
4. Due time par extension native row/search se Dinesh kholega, saved identity confirm karega, server claim lega aur single message send karega. Native outgoing + Sent + Notifications check karein.
5. Follow-up **Send reminder** isi scheduled pipeline mein prefilled message banata hai. Future time/consent save karein. Follow-up **Done** a separate task action hai; chat open/read hone se task complete nahi hota.

## Auto Reply ka test

1. Existing “Message acknowledgement” rule Edit kholein: intended contact ka CHECKBOX selected ho aur Exclude/Settings exclusions mein woh contact na ho. Correct verified identity ka selection save karein.
2. Trigger **Contact specific**, response `20000` ya apna response, All days / All day, Asia/Kolkata, Enabled ON, master Resume / Auto on. Screenshot ka cooldown 1 minute aur daily cap 6 retained hain; unlimited every-message reply nahi.
3. Settings **Read newly unread chats** ON. Native All/All chats view, foreground/online tab aur empty composer/search. Mentions history search open ho to All chats par aayein.
4. Setup complete hone ke AFTER selected user ka NEW incoming message use karein. Kisi doosre user ki chat open rakh sakte hain; incoming contact ka native loaded row/unread evidence available hona chahiye. Extension us saved verified contact ko open/recheck karke eligible reply bhejta hai.
5. If a manual draft/search blocks it, that text stays untouched. Aap manually clear karein within two minutes and keep WhatsApp active; fresh unread processing retries without needing another incoming. If window expires, clear obstacle then use a NEW incoming.
6. Auto Reply → **Last incoming check**:

| Status | Action |
|---|---|
| Waiting for NEW incoming | Setup ke baad naya message; old unread/refresh trigger nahi |
| Incoming observed; opening will retry | Draft/search/another lookup finish/clear; foreground tab; two-minute deadline |
| Incoming chat needs verification | Correct target open → Verify open chat once |
| Native message time appears old/future | Actual full native date text ke against DMY/MDY check |
| No rule matched | Trigger/contact checkbox, days/timezone, rule Enabled |
| Cooldown / daily cap reached | One-minute cooldown; cap ki next local day |
| Reply queued | Queue aur actual native outgoing inspect karein |

## Limits aur verification

This version is still a native DOM extension. Browser/PC off, background/unfocused tab, unloaded/archived inbox and phone-only history are not a full monitoring/sending service. Initial unread/history is not replayed. Wrong markers, duplicate names, account changes and manual drafts still block sends. Unknown delivery is never blindly resent.

220 automated behavioral checks passed, plus clean npm ci, Prisma generation, production build/plain strict tsc and fresh/release byte checks. Fixtures include an offscreen schedule from another unverified chat with native search input, nested cell activation and native query clearing, and full contact auto reply from another chat with draft/search retries. No actual message/payment was sent to a real contact here; installed Windows portal acceptance remains separate. Full evidence: QA_REPORT.md.
