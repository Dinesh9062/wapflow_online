# Wapflow Connect 1.4.8 verification

05 October 2026. Adapter **2026.10.05-dom-v12**. Exact delivered 1.4.7 source ZIP was SHA256-checked and extracted into a new tree, then fully updated. No selective overlay from an older version.

## Latest evidence reviewed

Both image(20261005-121428).png and image(20261005-122412).png were viewed at original resolution. Full local Wapflow_diagnostics(3).json was read. The current attachments were present despite earlier missing-image text.

First screenshot: another user is open, Dinesh schedule needs WhatsApp open / saved identity not confirmed, and target lookup says checking saved identity. The visible Verify open chat checkbox belongs to the OTHER chat and is unchecked. Second screenshot: Dinesh is open, the scheduled test text appears in native outgoing, and Contact specific Auto Reply response 20000 is ON/active All day with one-minute cooldown and cap six.

JSON: extension1.4.7/dom-v11, signed-in premium, settings loaded, Auto not paused, one enabled/active rule, one verified binding, restored COMPLETE **601-name** directory, **12 Sent schedules** and one cancelled schedule. Current chat is unverified with opaque native IDs, six envelopes, four incoming/two outgoing, one envelope containing nine body nodes, no recognized outgoing-check selector hits and native tail-in/out evidence. Native Unread119/Groups12; latest lookup interrupted. The existing 12 Sent records are user evidence, not messages sent by this release.

Parsed latest timestamp **2026-05-10T12:09:00Z**, observed **2026-10-05T12:09:48.150Z**. The new parser uses an unambiguous native relative-date divider to prove an alternate ambiguous numeric date, where available. It does not flip saved date order or assume all old dates are fresh. Without proof, configured order remains authoritative.

## Reproduced defects / correction

Five new cases failed on unchanged 1.4.7 before edits: browser-trusted input from owned native search cancelled lookup; nested mousedown cell was not activated by outer row click; native query clearing on result open aborted lookup; broad msg-container collapsed three dated messages into one; native Today proof did not resolve an ambiguous opposite-format pre-plain date. A no-native-date historical control passed before and after.

These are structural native fixtures derived from the report/visible behavior, not a captured full live WhatsApp DOM. The two screenshots/report alone do not establish every installed-page event detail.

- **Search ownership:** WeakSet-scoped synchronous input ownership recognizes execCommand's browser input in that editor only. Later trusted manual edits still cancel/preserve query. Native Mentions history search uses the same guard. Ownership ends in finally on both success and failure.
- **Native activation:** original name/cell receives pointer/mouse/click activation; no copied inbox. Both offscreen scheduled target and observed incoming target use saved target preparation. The opened header/native JID or exact stored unique message marker still must match before claim and final send.
- **Native rendering:** an exact owned-query replacement search editor may be reused. Empty query after target activation is accepted; nonempty changed query is not overwritten. Drafts, duplicate names, owner/namespace changes and concurrent preparation remain blocked.
- **Envelope/date parsing:** dated native messages inside broad msg-container are kept separate. A visible Today/Yesterday/weekday must exactly match the opposite numeric-date interpretation to resolve ambiguity. No native proof means no automatic date flip; actual old incoming remains suppressed.
- **Incoming retries:** fresh loaded-row unread increases are queued in owner/account-label-scoped content memory. Draft/search/directory/lookup delays do not immediately lose them. Foreground retry happens within a two-minute observation window. Paused/no-rule, expired, owner-changed, same-latest-key and old/future messages are excluded. Startup unread never navigates or auto replies.
- **Status:** Last incoming check now always appears; target verification, navigation wait and date mismatch are visible. Sync outcome renders immediately and clears on owner/account change.
- **Retained:** All/Pending mentions, noEmit/TS5096, native totals, Awaiting Reply, follow-up Done/history/reminder, cache/loader, notifications, auth/trial, INR1000 lifetime billing, encryption and send leases.

## Final validation

| Check | Result |
|---|---|
| Unit/native DOM, React/bootstrap, bundled content/background, shared/crypto | **191 passed**, zero failures/skips |
| Actual HTTP API with isolated PostgreSQL-protocol DB/payment fixture | **28 passed**, zero failures/skips |
| Actual Redis7.0.15 / BullMQ worker, both sorted migrations | **1 passed**, zero failures/skips |
| Total behavioral checks | **220 passed**, zero failures/skips |
| New main-suite checks | **14**: eight native runtime/search/parser, five actual incoming navigation, one actual scheduled offscreen native runtime |
| Full contact auto-reply integration | Other unverified chat → saved opaque recipient → fresh incoming → server preparation/claim → one native send/completion |
| Draft/search retry integration | Original input untouched; after manual clear one response without another incoming |
| Full offscreen schedule integration | Owned trusted contenteditable input, nested native mousedown, native query clearing, actual identity before claim, one send |
| Negative integration | Startup unread cannot navigate; genuinely old date cannot prepare/send; later manual input cancels lookup |
| Clean npm ci without inherited node_modules/.env | **328 packages**, automatic Prisma6.19.3 generation |
| Fresh PrismaClient construction/disconnect | Passed |
| Production extension/admin/API/demo builds | Passed in release and clean-install trees |
| Plain strict tsc | Passed in release and clean-install trees |
| Fresh/release production bytes | Extension/admin/API/demo byte-for-byte comparison checked before packaging |
| Dependency lock | Third-party entries unchanged from delivered1.4.7; only six owned version entries changed |
| Source/Chrome deliverables | ZIP integrity, required files/migrations/guides, 1.4.8/dom-v12, exact host permissions and matching bytes checked; no private .env/node_modules |

The retained mentions integration now waits for the actual debounced metadata observation with a bounded deadline rather than a fixed sleep under concurrent suite load. Its query/count/draft/no-send assertions remain intact.

The worker QA first lacked the extracted Redis runtime library path; after supplying its existing lib directory, the real Redis/BullMQ check passed. This was a QA host setup issue, not a dependency/source change or an instruction to replace the user's .env. Production uses PostgreSQL/Redis; API/worker fixtures use isolated PGlite PostgreSQL-protocol databases and all migrations.

## Installed-device operation

Screenshots clearly show logged-in Windows WhatsApp. Controlled fixtures are not installed-browser acceptance; no real recipient messages/payments were made here. Current live selectors/themes/localization, restart/notifications, sleep/wake and merchant checkout still need deployment acceptance. No hidden WhatsApp APIs were introduced.

Keep original .env/database/secrets/account label and same Chrome extension card. No new HTTP/schema migration in1.4.8. Follow INSTALL_UPDATE.txt and AUTOMATION_FIX_GUIDE.md. Use a new future consenting test schedule from another chat, and a NEW selected-contact incoming for Auto Reply. Foreground/online tab, empty composer/search and actual saved target verification required. Review existing Sent/Unknown/Failed jobs against native outgoing before retry.
