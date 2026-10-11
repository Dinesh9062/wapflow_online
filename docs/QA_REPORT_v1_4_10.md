# Wapflow Connect 1.4.10 — validation evidence

Full saved 1.4.9 source was materialized and its SHA-256 verified before changes. The complete `Wapflow_diagnostics(5).json` was reviewed. Current adapter: 2026.10.05-dom-v14. No real contact message or payment was sent by these checks.

## Results

| Check | Result |
|---|---|
| Main behavioral / native DOM / content / background / React UI tests | 213 passed, zero failures/skips |
| Actual HTTP API with isolated PostgreSQL-compatible databases | 37 passed, zero failures/skips |
| Actual Redis/BullMQ worker | 1 passed, zero failures/skips |
| Total | **251 passed** |
| Strict TypeScript | Passed on release and fresh install |
| Production extension, admin, API and standalone demo builds | Passed on release and fresh install |
| Fresh `npm ci`, postinstall Prisma Client | 328 packages; Prisma 6.19.3 generated |
| Fresh vs release build comparison | 13 production files byte-identical |
| Third-party dependency lock entries | Unchanged; six owned package versions updated |

The clean install initially hit this execution environment's blocked Prisma binary download. It was completed using already available matching-version Prisma engine files via Prisma's supported engine-path environment variables. No project install script or user configuration was changed to bypass downloads. Standard scripts then generated/used the client and built successfully. This is not a claim that an unrestricted Windows binary download was reproduced here.

## New regression evidence

- A five-message live incoming burst replaces four unsent automatic replies, retains one latest pending reply, and repeated preparation returns the same job. Unsent jobs consume zero attempts. A successful claim/completion then enforces actual rule cooldown/day cap with count and next eligibility.
- Overlapping contact cooldown and rule day cap near midnight preserve both blocking reasons and the later eligibility. Turning quiet hours off does not bypass other limits. Daily reset followed by a quiet window advances eligibility to the window end; timezone half-hour offsets and DST day boundaries remain tested.
- Overnight Auto Reply reports a timing block and requires a new incoming later. Scheduled jobs remain queued, expose their wait, and preserve explicit quiet-hour choices. API state reports its release version; mismatched/old API is visible in the installed UI.
- Timing preflight causes no TARGET/PREPARE/send navigation or claim for a blocked job. After changing settings, the existing job is rechecked and sends once in the controlled background fixture. Notifications deduplicate repeated timing checks.
- Twenty-one earlier contact-blocked schedules cannot starve a later eligible recipient. All due candidates are considered before selecting the processing batch.
- Expired auto replies are rejected/cancelled before a lease on API paths without a worker. A duplicate claim after Sent while automation is paused cannot rewrite terminal delivery state.
- Real React settings preserve saved quiet hours and the off switch updates the controlled settings form. Recent automatic queue/history displays wait reasons and cancelled errors. Reports include rule/timing/job metadata, not message bodies or recipient keys/names in job summaries.
- Earlier full content/background/native offscreen follow-up and scheduled target tests remain passing. Mentions, awaiting state, group rules, draft/search preservation, outgoing confirmation, recipient identity/owner changes, unknown delivery, follow-up completion, notifications, authentication/trials and fixed lifetime billing remain covered.

## Installed portal acceptance

Use the complete new API source and Chrome 1.4.10 together, original `.env`/database/secrets and same Chrome card. Follow the steps in DELIVERY_TIMING_FIX_GUIDE.md and INSTALL_UPDATE.txt.

On one known consenting contact, verify once, create an explicitly authorized future schedule or linked reminder, switch to another chat, keep WhatsApp foreground/online with empty native search/composer, and observe the actual outgoing plus Sent. Inspect waits rather than repeatedly creating new jobs. For Auto Reply enable a selected Contact-specific rule and master Resume, review global/contact/rule limits, then use a NEW incoming after setup. Old unread and refresh do not trigger an auto reply. Unknown delivery must be inspected before a confirmed retry.

These isolated checks establish source behavior; they do not guarantee current logged-in Windows selectors, OS notifications, exact-time delivery while hidden/asleep, an unrestricted network install, live merchant payments or exemption from WhatsApp restrictions. Previous release evidence: QA_REPORT_v1_4_9.md and QA_REPORT_v1_4_8.md.
