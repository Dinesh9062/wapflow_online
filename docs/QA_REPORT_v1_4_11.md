# Wapflow Connect 1.4.11 — validation evidence

The saved complete 1.4.10 Source ZIP was materialized and its SHA-256 verified: `13e5eee18c431a46e83cb0d8ad7e37d54db5589cd944b3673db81c405140aff9`. All 114 base files remain present. Full diagnostics(6) and all four 6 October screenshots were reviewed from the supplied local attachments; attachments remain unedited. Native adapter remains 2026.10.05-dom-v14; this release changes delivery policy/status rather than selectors. No real recipient message or payment was sent by these checks.

## Results

| Check | Result |
|---|---|
| Main behavioral / native DOM / bundled content / background / React UI tests | 219 passed, zero failures/skips |
| Actual HTTP API with isolated PostgreSQL-compatible databases | 38 passed, zero failures/skips |
| Actual Redis/BullMQ worker | 1 passed, zero failures/skips |
| Total | **258 passed** |
| Strict TypeScript | Passed on release and clean install |
| Extension, admin, API and standalone demo production builds | Passed on release and clean install |
| Clean npm ci and postinstall Prisma generation | 328 packages; Prisma 6.19.3 |
| Clean vs release production output | All 13 production files byte-identical |
| Third-party dependency lock entries | Unchanged; six owned versions changed to 1.4.11 |

The clean install uses already available matching-version Prisma engine files through Prisma's supported engine-path environment variables, because this execution environment restricts the binary download network. Project scripts and user configuration retain the normal install/generation flow. This is not a claim that a fresh unrestricted Windows binary download was reproduced here.

## New regression evidence

- Default rule contact mode permits a fresh automatic reply after a completed linked reminder once the global gap allows it. Reminder attempts do not consume rule cooldown/cap. Automatic attempts do not consume schedule/reminder contact caps. Schedules and linked reminders still share their account contact controls. Shared mode preserves the prior combined policy.
- Global gap/day cap, quiet hours and actual automatic rule cooldown/cap remain enforced in default mode. Overlapping waits, DST local-day boundaries and cooldowns ending during quiet hours remain covered. Unsupported contact modes are rejected.
- An actual HTTP/API/Prisma test creates and completes a linked reminder with a previous lookup error; completion writes error:null, sent time is reported, and the private follow-up remains pending. Older Sent rows suppress stale errors on output. Shared controls block a new incoming; selecting rule mode then permits that same still-fresh, previously unhandled incoming. Claim/completion succeeds. The combined global cap still blocks further auto preparation, and numeric/rule values remain unchanged.
- Real React forms default missing legacy mode to rule limits, preserve saved custom pacing/quiet hours on Shared save and restore timing defaults without replacing unrelated fields. Sent reminder wording and unknown automatic review are exercised. Review opens the native chat and does not create a retry or mutate Unknown.
- Privacy tests correlate a linked reminder and automatic job using the same anonymous recipient slot, distinguish another recipient, include sent time/task state and omit recipient keys/names, bodies and account email from job summaries.
- Queue fairness was verified in Shared mode with 21 contact-blocked earlier jobs. The first run of the older fairness fixture failed because it assumed an automatic attempt blocks later schedules under the old default policy. Its setup now explicitly selects Shared, making those jobs blocked by the policy it tests; the full HTTP suite then passed. This fixture correction did not weaken production quotas or batch ordering.

Earlier offscreen target opening, full content/background follow-up and automatic navigation, draft/manual search preservation, native input ownership, outgoing confirmation, identity/owner changes, duplicate/unknown handling, incoming bursts, expiry, mentions, awaiting state, group rules, notifications, authentication/trial and fixed lifetime billing checks remain passing. See QA_REPORT_v1_4_10.md for earlier detailed evidence.

## Installed acceptance

Use Source and Chrome 1.4.11 together, original .env/DB/secrets and the same Chrome card. Instructions: AUTO_REPLY_REMINDER_FIX_GUIDE.md and INSTALL_UPDATE.txt.

With one known consenting contact, verify target once; from a private task click Send reminder, complete intended-chat confirmation if asked, then choose a future time and authorize Add to queue. Switch to another chat, keep WhatsApp foreground/online with empty search/composer and observe the actual outgoing plus Sent. Private task remains pending until Done. Inspect waiting reason/next check rather than create duplicates.

For Auto Reply, enable one selected Contact rule and master Resume, review current contact mode/global usage/quiet hours, then use a NEW incoming after setup. Inspect Last incoming check and Recent auto replies. Old blocked messages and refresh do not replay. Unknown must be inspected in native chat before a separately authorized new message.

These controlled checks establish source behavior. They do not establish current logged-in Windows delivery, OS notification display, live merchant payments, exact due-second delivery while hidden/asleep, unrestricted network installation or protection from WhatsApp account restrictions.
