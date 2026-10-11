# Wapflow Connect 1.4.9 verification

05 October 2026. Adapter **2026.10.05-dom-v13**. The delivered 1.4.8 Source ZIP was SHA256-checked (`7e38712f923ec93f68a41949a8952ceb90c634b52e479d75fd231ec1774d661b`) and extracted into a new working tree. Complete source updated; no selective old/new overlay.

## Latest evidence

All three supplied local images image(20261005-144639).png, image(20261005-144646).png and image(20261005-144818).png were viewed. Full local Wapflow_diagnostics(4).json was read. The files existed despite the earlier missing-image notices.

Screenshots: Sumit Jind Office follow-up, current unverified Sumit chat, Send reminder displays an open/verify warning and a separate chat-open notice. JSON: 1.4.8/dom-v12, signed-in premium, one saved binding, 13 Sent schedules/one cancelled, current visible-bound verified identity, 15 message envelopes with eight incoming/seven outgoing, native Unread118/Groups12, partial 37-name directory stopped by user interaction, one enabled/active Auto Reply rule and last outcome cooldown-or-daily-cap. These 13 Sent records are the user's evidence; we did not send those messages.

The report does not include the failing follow-up's raw contact key or a captured native DOM. Structural fixtures reproduce the old-ID/verification flow without claiming that every native detail is captured.

## Defects reproduced and corrected

Two React checks failed on the unchanged 1.4.8 standalone demo before edits: legacy local follow-up recipient versus the uniquely verified native identity, and a saved offscreen binding whose key differs from the old task key. Both now pass without opening the unrelated current chat to create the reminder.

- Follow-ups now exposes first-time verification and continues into the authorized reminder editor. Original linked-message visibility is not a prerequisite for creating a reminder; sending still checks actual target identity.
- Resolver merges saved marker bindings and verified contacts independently of current chat/virtual viewport. Local receipt metadata alone cannot authorize an opaque recipient. Account label/type/identity compatibility, unique verified candidates and actual native send verification remain required. Duplicate candidates fail explicitly.
- Reminder recipient is frozen in the editor, links to its source task and uses the existing scheduled native send pipeline. Queue/sent/wait status appears on the follow-up. Concurrent repeated create requests reuse one schedule for the task. Done/Cancel cancels pending linked jobs; sent/already-claimed messages cannot be undone. Linked schedules cannot be reassigned arbitrarily or create their own recurring blast.
- Global timing fields/defaults/restore controls persist in settings. All automated messages share server checks before lease: account gap, contact gap, account/contact daily attempts, quiet hours, only one active send and exclusions. Attempt receipts are durable. Legacy leases are counted. Daily reset uses configured timezone, including DST.
- Configured Auto Reply delay is used server-side. Existing rule cooldowns/caps/timetable remain unchanged. Worker expiration of unserved stale Auto Reply remains in place.
- Timing waits keep the job queued with an explicit reason/next eligible attempt. Client waits before another target search, keeps server rate-limit buckets separate, and clears timing cache when settings change.
- Compare-and-update guards preserve cancellation/reschedule changes while claiming or recording timing waits. Follow-up creation/completion and linked claim use consistent locks. Owner/namespace guards protect verification and native preparation/send; changing account clears open reminder editors.

## Final checks

| Check | Result |
|---|---|
| Main native DOM/shared/React/bootstrap/background suite | **205 passed**, zero failures/skips |
| Actual HTTP API with isolated PostgreSQL-protocol databases | **33 passed**, zero failures/skips |
| Actual Redis7.0.15 / BullMQ worker | **1 passed**, zero failures/skips |
| Total behavioral checks | **239 passed**, zero failures/skips |
| New checks versus 1.4.8 | 14 main + 5 API |
| Full Follow-up reminder fixture | UI opens unverified target → confirm/verify → frozen authorized linked queue → switch to another chat → offscreen native search → actual saved markers before claim → one insertion/send/completion; another tick does not duplicate |
| Resolver controls | Legacy ID and offscreen binding positive; duplicate identity, wrong namespace/type, missing verification/marker negative |
| Follow-up API | Concurrent duplicate create, owner isolation, wrong recipient/association, no implicit recurrence, Done/cancel linked queue |
| Timing API | Settings persistence/invalid values; quiet-hour wait without attempt/lease; eligible retry; concurrent-tab serialization; global/day/contact wait; configured auto delay and original rule cooldown/cap |
| Timing calculations | Half-hour timezone, overnight quiet window, local midnight and 23/25-hour DST day boundaries |
| Clean npm ci | **328 packages**, automatic Prisma6.19.3 generation |
| Production extension/admin/API/demo builds | Passed in release and fresh install trees |
| Strict TypeScript/noEmit | Passed in release and fresh install trees |
| Fresh/release builds | 13 production files byte-identical |
| Dependency lock | Only six owned project version entries changed; third-party lock entries identical to delivered1.4.8 |
| Schema/migrations | No new schema migration; both existing migrations retained; existing Audit/lease fields used |
| Packaging | Complete source, prebuilt Chrome files, standalone demo, setup/timing/feature/previous QA guides; ZIP integrity/version/host/matching-byte checks; no private .env/node_modules |

The first added API checks shared the old fixture's row-count/auth request budget; moving them to an independent database/server retained the original production limits and assertions. Fixed short sleeps in the retained group-verification check were replaced by bounded waits for actual UI state. New UI checks wait for save completion and the actual Follow-ups panel. The initial offline npm ci attempt had an uncached package; normal npm ci then completed and generated Prisma. An initial typecheck used an older workspace-generated Prisma client; generating the current bundled schema resolved it, and the fresh install independently passed. These were QA setup/test synchronization issues, not instructions to replace the user's .env or weaken limits.

## Operation limits

Controlled fixtures and local API/worker tests are not installed Windows browser acceptance. No real recipient messages or payments were made here. Current live WhatsApp selectors, account-specific stored marker availability, notifications/sleep/restart and payment checkout still require deployment acceptance.

Use the original .env/database/keys, the complete new API/worker/extension and the same Chrome extension card. Foreground active/online WhatsApp, awake computer, empty draft/search and saved verified target are needed. A particular recipient conversation need not stay open. Quiet hours/global/contact limits can defer ordinary scheduled/reminder sending; stale Auto Reply expires rather than replays long-delayed responses. No timing setting guarantees immunity from WhatsApp restrictions. See FOLLOWUP_REMINDER_GUIDE.md and INSTALL_UPDATE.txt.
