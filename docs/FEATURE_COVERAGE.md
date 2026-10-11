> Current release **1.4.11**: see [AUTO_REPLY_REMINDER_FIX_GUIDE.md](AUTO_REPLY_REMINDER_FIX_GUIDE.md) for contact limit modes, reminder confirmation and update steps. Numeric limits and saved quiet-hour choices are preserved. Earlier release details below are historical.

## Current 1.4.9

Follow-up reminders: own-panel verification, unique legacy-ID resolution, saved offscreen target lookup, consented linked schedule, queue/sent/wait status, idempotent creation and cancel on Done/Cancel. Timing: server gap/contact cooldown/account & contact daily caps/auto delay/quiet hours, all automated jobs and tabs. Existing unread/groups/mentions/awaiting/auth/lifetime billing kept. See FOLLOWUP_REMINDER_GUIDE.md and QA_REPORT.md. Older coverage below is retained as history.

# Blueprint coverage and acceptance map

This map covers all 21 sections of the supplied blueprint. “Implemented” means source/build exists and the listed automated behavior is verified. It does not mean external accounts, a production deployment or current live WhatsApp DOM were accepted.

| Blueprint requirement | Implementation | Verification and limits |
|---|---|---|
| Focused WhatsApp manager | Eight top filters and seven management rail items | UI test excludes CRM stages/campaigns |
| Native UI preservation | Shadow DOM UI; native app space reserved | No replacement chat history or native menu duplication; live visual QA pending |
| All / Unread / Chats / Groups | Shared filters over loaded DOM rows | Unit tests; unknown type stays unknown until verified |
| Mentions | dom-v12 own tags in groups AND normal chats; native All mentions history search plus observed Pending until outgoing reply; full/national number, exact aliases and image-alt emoji | 17 new native DOM/search/bundled cases; original results clickable; one identity query at a time; history limited to native Web search; pending badge is observed conversations |
| Awaiting Reply | Outgoing-last state plus grace; minimal server metadata | Incoming clears filter; known snapshots survive reload; native locale unknown times conservative |
| Contact and message follow-up | Message-bubble actions; editor with group member subject, note, due time, priority, lead reminder, repeat | React create/edit/snooze/done; HTTP CRUD and repeat idempotence |
| Chrome notifications and badge | MV3 alarms, system notification, persistent per-account notification feed, permission/test controls and badge | Service-worker API mocks verify dedupe, denied desktop handling and restart receipts; actual installed Chrome notification/click/restart checks pending |
| Follow-up history | Done/cancelled history and active queue | React test and persisted statuses |
| Scheduled messages | Contact, body, due time, repeat, consent, reschedule/cancel/history | HTTP persistence and lease tests; real send manual acceptance pending |
| Status visibility | Queued, ready, sending, sent, failed, needs-whatsapp-open, unknown, cancelled | Unknown requires explicit review before retry |
| Duplicate prevention | Server CAS lease, local send ledger, transactional completion | Wrong-target, duplicate claim, native/datable-marker overlap and completion tests |
| Correct target before send | Saved native JID or confirmed dated/native-marker binding; unloaded target searched in native chat list, exact unique row, actual current identity before claim and final send | Actual bundled content/background search→verify→claim→send-once fixture; duplicate names, wrong marker, user query, draft and owner switch block sends |
| Auto reply triggers | Keyword, first observed incoming, outside-hours, unanswered delay, contact-specific | Shared engine and server matching tests; fresh visible messages; bounded retries for NEW unread increases on already loaded rows, with actual offscreen recipient→prepare→send fixtures |
| Weekly timetable | Per-rule weekdays, start/end, timezone and overnight windows | Boundary, weekday and timezone tests; seven-day editor |
| Loop controls | Master pause, cooldown, daily cap, per-contact/group exclusions | Server cooldown/idempotency tests; no outgoing triggers; historical indexing does not auto reply |
| Group control | Default off; selected group key required | Shared tests and disabled-by-default UI test |
| Manual typing/reply race | Preserve manual draft; recent typing pauses; latest incoming checked again | Draft and superseded auto target tests |
| Private notes | Contact-specific notes | Database ciphertext test; server state returns owned notes |
| MV3, TypeScript, React | Manifest, content script, React Shadow DOM, background service worker | Build/typecheck; minimum Chrome 120 |
| Local state | Extension-only chrome.storage.local, persisted receipts/ledger/cache | Storage access limited to trusted extension contexts; no IndexedDB needed for this small cache |
| NestJS API and Prisma | Auth, records, jobs, metadata, billing/admin | Actual HTTP integration tests with PostgreSQL protocol fixture |
| PostgreSQL migrations | Initial SQL plus additive LifetimePayment migration | API/worker fixtures apply both migrations; production PostgreSQL acceptance pending |
| Redis/BullMQ worker | Persistent repeat scan, due readiness, stale lease recovery | Real Redis/BullMQ integration test |
| Realtime | Socket.IO user rooms and admin refresh | Source implemented; extension polls for MV3 suspension resilience |
| Auth/trial | Guest basic-only filters; premium UI/API/automation locks; hashed passwords, JWT token version, fixed server trial | Duplicate email/reinstall cannot create another trial for same account; no email verification yet |
| ₹1,000 one-time lifetime | Fixed hosted payment link, captured amount/order verification, webhook replay/refund, manual check, legacy cancellation | Isolated HTTP provider fixture; merchant live keys/UPI activation pending |
| Verified payment webhook | Raw HMAC, event uniqueness, current-provider reconciliation | Signature unit tests; signed/replayed HTTP fixture test |
| Trial expiry | Premium create/claim checks at server | Expired scheduling test; users can still cancel records |
| Admin SaaS operations | Users, trial/paid counts, access restore/disable, support notes, device health, audit, webhook metadata, feature flags | No private message viewer; admin guard and feature gating tested |
| Permission minimization | storage, alarms, notifications and exact WA/API hosts | No broad host access, hidden WA injection, remote JS or bundled secrets |
| Privacy | Encrypted authored records; minimal state; draft notice | Incoming match text not saved as full chat history; export/deletion policy/endpoints future release work |
| Offline/restart behavior | Backend queue, alarms restored, cache, unknown sends held | Worker recovery verified; browser restart/sleep needs real-device QA |
| Store release | Built unpacked extension and release checklist | Chrome Web Store submission/signing not performed |
| Future official Business API mode | Documented optional future mode | Not implemented; requested personal WhatsApp Web mode remains primary |
| Deployment/source deliverables | Source, build, SQL, env template, Docker, API contract, setup/deployment/privacy/QA | Package includes these artifacts; no remote deployment performed |

| Setup animation and interruption | Opaque workspace loader, real name count/scroll progress, Stop setup, prior native view restoration | React loader/cancel and first-progress-before-mutation tests; scan cutoff remains partial |
| Directory cache and refresh | Owner + WhatsApp account label scoped completion, 24-hour reuse, shared names/pickers, manual refresh | Background ownership tests and actual content reload with zero repeated index scroll/filter clicks |
| Follow-up reminder target | Prefilled schedule for saved verified recipient even with another chat open | React test for unloaded saved recipient; sending reuses guarded schedule lookup |

Deliberate operating limits are visible in UI and README: no guaranteed PC-off send, active browser tab, saved verified target with actual native identity confirmation, no blind retries, no entire-account history index. Native WhatsApp can change its DOM; the selector registry and health diagnostics are the supported maintenance surface.

Version 1.4.8 adds 14 cases for browser input ownership, nested native cell activation, native query clearing, envelope/date proof and full incoming/schedule flows. 220 total behavioral checks; installed-device acceptance remains separate.
