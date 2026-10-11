# Wapflow Connect 1.4.13 — verification evidence

Date: 11 October 2026. Baseline is the exact uploaded 1.4.12 Source ZIP, SHA-256 `e7c833348c29887d64b949aad03048bfe29382a66b398b11e082eac8911bdd7b`. The supplied JSON and both screenshots were read locally. Source files are retained; old generated demo/hashed admin assets are replaced by the renamed demo and current build assets. No actual contact message, payment or EC2 deployment was performed.

## Completed checks

| Check | Result |
|---|---|
| Engine/native DOM/content/background/React UI regression suite | 243 passed, zero failures/skips |
| Actual HTTP API/Prisma/PostgreSQL-protocol integration | 39 passed, zero failures/skips |
| Actual isolated Redis 7.0.15/BullMQ scheduler | 1 passed, zero failures/skips |
| Total | **283 passed** |
| Strict TypeScript | Passed on working source and a fresh ZIP extraction |
| Production Chrome extension, admin, API and standalone demo | Passed; API compiled to https://api.wapflow.online |
| Clean ZIP installation | npm ci / Prisma generation / typecheck / production build passed |
| Clean build reproducibility | All 8 extension, 3 admin and 1 API build files byte-identical |
| Dependency audit | Zero reported vulnerabilities |
| Prisma generation | 6.19.3, retained with compatible existing schema/migrations |

Runtime: Node 24.19.0, npm 11.9.0, Ubuntu test container. PostgreSQL-protocol integration uses isolated PGlite databases. Worker testing uses a real isolated Redis process and cleans it up; it does not use your EC2 data. The scoped `@prisma/config` override pins `deepmerge-ts` 8.0.0; Prisma/client 6.19.3 remain aligned. No force-major upgrade.

## Regression evidence

- Mac-shaped fourteen-body dated transcript with nested selectable text and opaque IDs produces fourteen unique messages, correct alternating direction, sender/time and latest outgoing Awaiting state. Explicit verification keeps fourteen markers without requiring serialized JIDs.
- Same shape retains an observed incoming mention across reads and clears it after a later outgoing reply. Unicode isolation/narrow spaces and dotted AM/PM parse in the configured timezone.
- A saved opaque Mac-shaped target opens from another conversation and confirms the outgoing reminder exactly once; wrong recipient/manual draft/ambiguous identity guards remain covered.
- Continuous native mutations deliver fresh observations before the mutation stream ends. Identical Mentions updates preserve the same native toolbar instead of repeatedly reconstructing it. Pending changes, nested scrolling and native row style changes invalidate the cache correctly.
- Actual React schedule editor requires intended-recipient confirmation, verifies in place and queues that target. Switching to another verified chat cannot bypass verification of the original unverified recipient.
- Awaiting Reply supports backward-compatible outgoing default and optional incoming mode; grace, self-chat and reply direction checks apply. Actual settings form and HTTP persistence preserve the choice and reject an invalid value.
- Existing integration coverage still includes hidden/unfocused target preparation, automatic unread observation, drafts/search preservation, group reminder recipient handling, notifications, task Done/history, stale auto expiry, server quotas/quiet windows, owner namespaces, entitlement and billing idempotency.

## Report interpretation

Mac heartbeat: opaque IDs and unverified target; broad dated envelope with fourteen text bodies. Downloaded JSON: master autoPaused, no enabled rule, no bindings, no queued schedules/linked reminders and no open-chat snapshot. These require setup on the affected Chrome profile. Empty-composer `sendButton=false` and zero serialized IDs are not independently send failures. The snapshot alone does not establish every reported failure's cause.

## Acceptance still required

Actual macOS/Windows Chrome GUI delivery, OS notification permission/Focus, real WhatsApp layout variants and live merchant payment need installed acceptance. These tests do not prove the extension works on every MacBook or guarantee no hangs. Follow INSTALL_UPDATE.txt and MACBOOK_AND_RELEASE_GUIDE.md, using one consenting recipient and observing the actual outgoing plus Sent while another chat is open. Keep the logged-in Chrome profile/tab open, online and awake. Closed/frozen/discarded/sleeping sessions cannot send via this DOM extension. No exact due-second delivery or protection from WhatsApp restrictions is certified.

Preserve original `.env`, database, JWT/encryption keys and Chrome storage. Source and Chrome must both be 1.4.13; adapter 2026.10.11-dom-v16. No new schema migration. Historical 1.4.12 evidence is retained in QA_REPORT_v1_4_12.md.
