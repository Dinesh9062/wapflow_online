# Wapflow Connect WhatsApp Manager

WhatsApp Web ke andar filters, follow-ups, reminders, scheduled messages, auto reply aur private notes. Leads, deals, campaigns ya sales pipeline is product mein nahi hain.

This package contains actual extension source and a built Manifest V3 extension, a NestJS API, PostgreSQL schema and migration, Redis/BullMQ worker, operations admin, an offline interactive demo, and automated tests. The adapter uses visible WhatsApp DOM only. It does not access hidden WhatsApp APIs.

**Release status:** development build with automated verification. Real logged-in WhatsApp, Chrome restart/notifications, current WhatsApp selectors and live Razorpay still need the manual acceptance checks in `docs/QA_REPORT.md`. It is not a Chrome Web Store release and has not been deployed to your server.

## v1.4.13 update — Wapflow Connect

Complete 1.4.12 source updated. Extension, popup, admin, demo and W logo use **Wapflow Connect**. The supplied Chrome ZIP is built for **https://api.wapflow.online**; this release has not been installed on your EC2 server.

Adapter **2026.10.11-dom-v16** separates single-message bodies from broad dated transcript containers, preserves nested opaque markers, reads Unicode/dotted AM/PM clocks and keeps live observation running during continuing DOM mutations. Filter scans reuse unchanged native toolbars and row patches. This addresses the DOM shapes supplied in the Mac report; macOS GUI delivery remains a manual acceptance step.

New schedules show **Verify open WhatsApp chat** directly in the editor. Confirm the intended recipient once per Chrome profile when WhatsApp exposes opaque IDs. Verification remains required before sending, including after background target lookup. Existing ambiguity, draft, account and duplicate-send checks remain enforced.

**Awaiting Reply shows** now lets you choose their reply (last message sent; default and older behavior) or your reply (last message received). Reading does not count as replying. Settings uses **Your mention name**, with no Dinesh example. The top switch explicitly says **Auto replies paused/on**; a readiness card explains enabled rules, verified recipients and private follow-up vs outgoing reminder.

Use Source + Chrome **1.4.13 together**. Keep your original `.env`, database, encryption keys and existing Chrome extension card. Workspace/storage identifiers remain compatible. No new schema migration. Start with **INSTALL_UPDATE.txt** and **[MACBOOK_AND_RELEASE_GUIDE.md](docs/MACBOOK_AND_RELEASE_GUIDE.md)**. Earlier release sections are historical.

## Previous v1.4.12 update

Complete 1.4.11 source updated; native adapter **2026.10.06-dom-v15**. **Background sending defaults ON**: a running, logged-in WhatsApp tab can process schedules, linked follow-up reminders and fresh matching Auto Replies while another tab, Chrome profile, browser or app is in front. Automation does not focus the tab/window. The original WhatsApp profile/tab must remain open, online and awake; closed/frozen/discarded sessions cannot send.

The existing 30-second Chrome worker alarm now pulses incoming observation in hidden tabs. Connected automation tabs are protected from automatic discard while needed; previous discardability is restored afterwards. Native target/outgoing confirmation listens to DOM changes, avoiding dependence on chained short timers in background pages. Draft/search preservation, verified identity, owner labels, license, server timing and duplicate/Unknown protections remain enforced. Add **web.whatsapp.com** to Chrome Settings → Performance → **Always keep these sites active**; other browser/OS suspension remains possible.

Schedule now offers **Custom weekdays** with seven Sun–Sat checkboxes, saved day names and Reschedule retention. **Every N days** retains all older custom intervals. First-date validation and final API claim prevent weekday messages sending on an unselected day, including overdue jobs and quota/quiet-hour delays. Recurrence keeps the saved timezone/wall time and creates one next occurrence only after confirmed completion. Linked follow-up reminders remain individually authorized one-time messages.

Use Source + Chrome **1.4.12 together**, original `.env`, same DB/secrets and same Chrome extension card. Existing timing values, quiet choices, contact-limit mode and other features are preserved. No new database migration. Read **[BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md](docs/BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md)**, **INSTALL_UPDATE.txt** and **docs/QA_REPORT.md**. Earlier release sections/guides below are historical.

## Previous v1.4.11 update

Full 1.4.10 source updated; native adapter remains **2026.10.05-dom-v14**. The latest diagnostics(6) report shows a linked follow-up reminder **Sent**, due at 3:40 PM IST. Auto Reply was blocked by a 10-minute account contact cooldown, despite its saved 1-minute rule cooldown; quiet hours were inactive.

**Contact limit mode** defaults to **Auto Reply uses rule limits**. Schedules and follow-up reminders share the account contact cooldown/cap, while automatic replies use their rule contact cooldown/cap. Global gap, total daily cap, quiet hours, exclusions, entitlement, master pause and verified-target checks remain enforced. Select **Share contact limits across all features** in Settings to keep the earlier policy. Existing numeric limits, rule settings and explicit quiet-hour choices are preserved.

Successful completion clears a previous lookup/wait error. Existing Sent rows display their successful status without a stale error. Follow-ups now explain target confirmation, message authorization and Add to queue; a sent reminder leaves the private task pending until Done. Unknown automatic delivery offers native chat review without an automatic resend. Diagnostics correlate recipients using anonymous slots and include sent time and linked task status.

Use the complete source with your **ORIGINAL .env**, same database/secrets and same Chrome extension card. Update API and extension together. No new schema migration. Read **[AUTO_REPLY_REMINDER_FIX_GUIDE.md](docs/AUTO_REPLY_REMINDER_FIX_GUIDE.md)** and **INSTALL_UPDATE.txt** for the exact setup and testing steps. Earlier release guides are historical.

Recipient chat need not stay open. Keep WhatsApp foreground/online, the computer awake, native composer/search empty and the target verified. A NEW incoming after setup triggers Auto Reply; older unread messages do not replay.

## Previous v1.4.8 update


Complete delivered 1.4.7 source updated, 05 October 2026, adapter **2026.10.05-dom-v12**. Both latest screenshots and full ZFLEET_diagnostics(3).json were reviewed. They show active Auto Reply and a saved schedule waiting from another chat, with interrupted lookup and native date/identity evidence requiring a parser/navigation correction.

- **Native recipient opening:** activates the original nested chat cell through pointer/mouse/click events. Older code clicked only the outer row, which did not activate some native rows. Loaded and offscreen saved targets still require actual header/native IDs or stored unique message markers before claim/send.
- **Search input ownership:** native contenteditable insertion can emit a browser-trusted input event. That synchronous event is now recognized as owned, rather than cancelling its own lookup/mention search. Later manual input, drafts, duplicates and owner changes still stop automation. A native query cleared by WhatsApp during result opening is accepted; a nonempty changed user query is preserved. A replaced native search editor is reused only with the exact owned query.
- **Auto Reply retries:** a NEW observed unread increase from a loaded selected row remains pending while another lookup, draft or manual search blocks opening. A foreground retry rechecks it within two minutes after the obstacle clears. Startup unread and genuinely old messages do not become auto replies. Owner/account-label changes clear pending evidence.
- **Message parsing:** a broad msg-container containing several dated messages no longer collapses them into one message. An ambiguous numeric date may be resolved using a visible native Today/Yesterday/weekday that exactly proves the alternate format. Saved date-order settings remain unchanged; without native proof the configured format stays authoritative.
- **Status:** Auto Reply always shows Last incoming check, including waiting for NEW incoming, target verification, temporary navigation/draft/search wait and old/future native message time. Outcomes render immediately.
- **Retained features:** Mentions All/Pending in groups and normal chats, TS5096/noEmit fix, Awaiting Reply, follow-up completion/history, notifications, setup loader/Stop and 24-hour owned directory cache. The 14-day trial and INR 1000 one-time lifetime payment remain unchanged.

**220 behavioral checks passed**, plus clean npm ci/Prisma generation, production build and plain strict tsc. These are controlled fixtures; actual installed Windows selectors/delivery still require a consenting test. No real contact messages or payments were made by this update. Read **docs/AUTOMATION_FIX_GUIDE.md**, **docs/AUTO_REPLY_GUIDE.md**, **docs/QA_REPORT.md**.

Use the complete new source with your **ORIGINAL .env**, same database/keys/account label and same Chrome extension card. Run `npm ci`, `npm run db:migrate`, `npm run check:setup`, `npm run typecheck`, `npm run build`; restart API/worker and reload the updated extension files. No new API/schema migration in 1.4.8. Exact commands: **INSTALL_UPDATE.txt**.

## Optional offline demo

`Wapflow_Connect_Demo.html` ko Chrome mein open karein. Dummy chats par Follow-ups, Schedule, Auto Reply, Notes, Settings aur Subscription screens test kar sakte hain. Follow-up add/edit/snooze/done, scheduled queue create/cancel, rules create/edit/toggle aur settings demo mein persist hote hain.

Demo real WhatsApp ko connect nahi karta aur message send nahi karta. Iske trial/paid status sirf demo data hain. Extension ka actual trial backend control karta hai.

## First installation on Windows

Node.js 22 LTS or newer, npm, Chrome 120+ and Docker Desktop with Docker Compose are required. Docker Desktop must be running. PostgreSQL and Redis remain bound to localhost.

1. Extract this package. Open CMD or PowerShell in the folder containing `package.json`.
2. Run these commands:

```bat
npm ci
node scripts/setup-env.mjs
docker compose up -d
npm run db:generate
npm run db:migrate
```

`setup-env.mjs` creates `.env` with random JWT/encryption secrets and preserves an existing file. Local Docker uses the development DB password in `.env.example`. Keep `.env` private.

3. API start karein, aur is terminal ko open rakhein:

```bat
npm run dev:api
```

4. Doosre terminal mein scheduler start karein:

```bat
npm run dev:worker
```

5. Optional admin: `.env` mein your own `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` add karein. Password minimum 12 characters ho. Demo seed ke liye `SEED_EMAIL` and `SEED_PASSWORD` review karein. Seed existing users' trial ko reset nahi karta.

```bat
node --env-file=.env --import tsx scripts/seed.ts
npm run dev:admin
```

Admin opens at `http://localhost:5174`. The demo account cannot access admin. Admin access is assigned by the server operator with `npm run admin:grant -- your-existing-email@example.com`, or the optional admin seed configuration.

## Chrome extension install karein

The supplied `apps/extension/dist` folder is built for `http://localhost:4000`.

1. Chrome mein `chrome://extensions` open karein.
2. **Developer mode** ON karein.
3. **Load unpacked** par click karke `apps/extension/dist` select karein. Select the folder that contains `manifest.json`.
4. `https://web.whatsapp.com/` reload karein. Apne phone se normal WhatsApp login complete karein.
5. Right rail mein **Subscription** ya **Settings** open karke Wapflow account register/sign in karein.
6. A WhatsApp contact open karein. Extension reads the header name with or without its title attribute, and verifies native JIDs automatically, or offers explicit visible-message verification for opaque IDs. Quoted IDs are ignored. Within an authenticated active trial, a recognized chat supports manual follow-ups/private notes; scheduling and auto sends require native JID or confirmed visible-message verification.
7. Add a follow-up. Reminder, repeat and priority select karein. Schedule ke liye message, future date/time and send consent choose karein.
8. Auto Reply default paused rahega. Rule create/enable karein, selected days/time set karein, phir master Resume use karein.

Unpacked install is for development/testing. A published extension requires your own store account, listing, privacy URL and manual approval/release.

## Important behavior

- Native WhatsApp chat list, composer and native message menus remain available. The extension adds a 64px top bar, 66px right rail and centered management dialogs using Shadow DOM; top filters never open a second inbox.
- Notifications rail saves a local account-specific history (up to 200 alerts), including due follow-ups and schedule results even when desktop notifications are denied. Settings has a notification test and permission status. A 15:55 follow-up with a 5-minute lead reminder alerts around 15:50, not immediately after saving.
- Unread and Groups activate WhatsApp’s native filter buttons where available. Chats first reads the native Groups view to identify custom-avatar groups, then returns to All and filters the original row elements. Mentions → Pending, Awaiting Reply, Follow-ups and Scheduled filter the existing list in place. Mentions → All mentions uses the original native message-search pane. Custom filters hide nonmatching native loaded rows; their badges count indexed metadata. The interruptible chat-list index collects rows beyond the viewport. Custom-filter matches still need their native rows to load for display. Scheduled jobs and Open target can search an off-screen saved verified target through native WhatsApp search. The extension does not claim to have read the full account history.
- Mentions includes groups and normal chats. Settings mein apna own number country code ke saath aur exact own @names/emoji save karein. All mentions searches one selected identity in native message history; scroll/click the original results. Pending uses observed native own-tag evidence until your outgoing reply. The top badge is pending observed chats, not a history total. Never-observed pending tags and phone-only history are not inferred. A missing native marker is not a confirmed negative for all account history. See docs/MENTIONS_GUIDE.md.
- Awaiting Reply means last observed meaningful message is outgoing, with no later incoming reply and grace time elapsed. Metadata sync helps restore known conversations after reload. Unknown or ambiguous dates are observed conservatively from first indexing time.
- Follow-up and Send reminder actions appear beside loaded messages. A group follow-up can save a member name as its subject; the target remains the group. Sending privately to that member requires opening their private chat. Message-linked follow-ups use normalized native message IDs where available, with a local locator for manual actions when identity is not verified. If that message is unloaded, the chat can open but you must use native WhatsApp search to locate the older message.
- Scheduled sends require an open, logged-in WhatsApp tab and network. Background sending ON permits hidden/unfocused operation; OFF retains foreground-only sending. A saved verified target is opened automatically from loaded rows or native chat-list search. Verify an opaque target once before authorizing its schedule. Drafts, recent typing, a nonempty native search and duplicate names pause lookup. Browser/PC off does not send messages.
- Chrome alarms are approximate, not second-accurate. Queue records remain on the server. The worker prepares them; only an extension tab can actually send.
- Auto reply triggers on fresh visible incoming messages after indexing. With “Read newly unread chats” enabled, an eligible foreground/background tab can open an already loaded row whose unread count increases, provided no draft/manual typing is present. It does not scan unloaded chats, process startup unread history or replay old messages. First-message means first live incoming conversation observed by this backend, not historical account-wide first contact. After-hours is based on Settings working hours; each rule also has its own active timetable.
- A group member follow-up accepts a loaded sender or a manually typed member name. Its outgoing recipient remains the group; use that member’s private chat for a personal message.
- Group replies need `allowGroups` plus an explicitly selected group in the contact picker. Rules are disabled by default. Master pause, contact exclusions, cooldown and daily cap are server-enforced.
- A send click without observable confirmation becomes **Unknown**. Check WhatsApp before retrying; no automatic resend. Failed jobs can be rescheduled manually. Retry of Failed/Unknown requires an explicit “not sent” confirmation.
- Dates entered in forms use your computer's local timezone. Display and recurring calendar dates use the saved timezone. Keep computer timezone aligned with your preferred timezone for predictable entry.
- Use a separate account label in Settings before switching WhatsApp accounts. This build does not infer your own sending phone number from private WhatsApp internals. Revalidate the correct account and target before enabling automation.
- Sign out cancels server tokens on all devices; current local credentials/cache are cleared. Records stay in your server account.

## Quick functional check after update

1. Restart the updated API and worker; reload the extension and WhatsApp. Open Settings and check extension/server 1.4.12 and DOM adapter 2026.10.06-dom-v15, loggedIn/composer/verifiedCurrent. Set your own WhatsApp number, exact own mention aliases, timezone and DMY/MDY date format. Check Mentions → All mentions on the original native history results and Pending until a reply.
2. Use Test notification and check both the Notifications rail and desktop permission. Add a future follow-up; check its lead time. For groups, select the member subject from a loaded message.
3. Verify your intended test/self-chat, create a future schedule and tick send consent. Open a DIFFERENT chat, clear the composer/native search, keep Background sending ON, and switch to another browser/profile while the WhatsApp tab stays open. At due time the saved target should be found, verified and sent to once. Confirm its actual outgoing message before retrying any Unknown result.
4. For auto reply testing, use a Keyword or Contact rule, All day, an enabled rule and Resume master control. Searching a name alone does not select it: tick the contact. Groups need Allow groups and the exact selected group. Use a new incoming message. First incoming is not a reply-to-every-message trigger.

## Build and tests

```bat
npm run build
npm run typecheck
npm test
npm run test:api
npm run test:worker
```

`npm test` executes adapter, service-worker notification/send mocks, shared engine, encryption and actual React form tests in JSDOM. `test:api` starts an isolated PGlite PostgreSQL protocol fixture and tests the built API plus a local payment-provider fixture. These tests never contact or send a real WhatsApp message and never charge a payment. `test:worker` expects Redis on localhost:6379 (start Docker first), starts its own PGlite database and exercises BullMQ. Ports 4400, 4401, 5440 and 5441 must be free for tests. PGlite is test infrastructure; production uses PostgreSQL.

`npm run build` regenerates `apps/extension/dist`, the standalone HTML demo, `apps/admin/dist`, and `apps/api/dist`. Source changes require rebuilding the extension and clicking Reload on its Chrome extension card.

## Project locations

| Location | Purpose |
|---|---|
| apps/extension/src/adapter.ts | WhatsApp selectors, automatic saved-target lookup, identity checks and native sending |
| apps/extension/src/native-search.ts | Scoped native chat-list search and guarded query editing |
| apps/extension/src/mentions.ts | Own-tag phone/name/emoji/native metadata matching |
| apps/extension/src/mention-search.ts | Owned native mention-history query and identity choices |
| apps/extension/src/conversation-observation.ts | Reply ordering, pending mentions and conversation state |
| apps/extension/src/contact-directory.ts | Interruptible native directory collection and setup progress |
| apps/extension/src/observation.ts | Locale/timezone parsing and canonical names |
| apps/extension/src/alerts.ts | Persistent local notification feed and desktop delivery |
| apps/extension/src/message-actions.ts | Actions on original loaded message bubbles |
| apps/extension/src/native-filters.ts | Native WhatsApp filter controls, original-row filtering and style restoration |
| apps/extension/src/content.tsx | Shadow DOM mount, fresh-message events, content message handling |
| apps/extension/src/background.ts | MV3 alarms, notifications, server sync, send ledger |
| apps/extension/src/App.tsx | Top filters, rail, editors and management queues |
| apps/extension/src/bridge.ts | Actual extension bridge and isolated dummy demo |
| apps/api/src/main.ts | Auth, trial, data CRUD, job leases, billing, admin routes |
| apps/api/src/crypto.ts | AES-256-GCM records and raw webhook signatures |
| apps/api/prisma | PostgreSQL models and migration |
| apps/worker/src/main.ts | Redis/BullMQ due scan and stalled-send recovery |
| apps/admin | SaaS operations only; no private message viewer |
| packages/shared/src/index.ts | Validation, filters, rule windows, recurrence, license engine |
| tests | Unit, React UI, HTTP API and worker acceptance tests |
| docs | Coverage map, QA report, API contract, deployment, privacy, release |

## Troubleshooting

“Server offline”: check API terminal, `.env`, PostgreSQL and the API origin in this build. The standalone demo works without a backend; actual premium features need a reachable server.

“Target identity unavailable”: open an existing conversation with visible messages. Settings → Verify open chat handles opaque native message IDs or dated native message fingerprints. Keep the message date visible. If message markers are unavailable, Settings → Download diagnostics exports structural counts and redacted ID shapes without message bodies or phone/JID values. If verifiedCurrent remains false, retain this file for adapter troubleshooting. Sends remain paused until identity is verified.

“Needs WhatsApp Open”: keep the original logged-in WhatsApp tab open/online, enable Background sending, clear native composer/search and read the job reason. Resume a frozen/discarded tab when necessary. A saved verified target need not be the open chat. If its name or visible identity changed, open/verify it once again. The next eligible worker pulse/alarm retries availability without replaying a claimed send.

“Unknown”: look in WhatsApp first. If already sent, cancel/archive the schedule. If definitely not sent, use Review / retry, acknowledge the checkbox and set a future time.

Payment setup: add server Razorpay keys and webhook secret; no plan ID is required. Enable UPI on the merchant account. Read docs/BILLING_SETUP.md. A static UPI QR/payment screenshot is not proof of a captured payment. Keys do not belong in the extension.

Docker port 5432 already used: use another host port in compose and update `DATABASE_URL` consistently.
