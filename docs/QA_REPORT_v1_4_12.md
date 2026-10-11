# Wapflow Connect 1.4.12 — validation evidence

The saved complete 1.4.11 Source ZIP was verified against SHA-256 `1a8d24e095b57598b5a95a9dad03388973829092b66f9ad87248369bbec3a479` and extracted into an isolated update tree. All 116 base files remain present. Both 6 October background/profile screenshots supplied in this request were visually inspected from local attachment paths and remain unedited. Native adapter is 2026.10.06-dom-v15. No real contact message or payment was sent.

## Results

| Check | Result |
|---|---|
| Main engine / native DOM / bundled content / worker background / React UI | 232 passed; zero failures/skips |
| Actual HTTP API with isolated PostgreSQL-compatible databases | 39 passed; zero failures/skips |
| Actual Redis/BullMQ worker | 1 passed; zero failures/skips |
| Total | **272 passed** |
| Strict TypeScript | Passed on release and final clean-install source |
| Extension, admin, API and standalone demo production build | Passed on release and clean installation |
| Clean npm ci and postinstall Prisma generation | 328 packages; Prisma 6.19.3 |
| Release vs clean production output | All 13 production files byte-identical |
| Dependency lock comparison against supplied base | Third-party entries unchanged; only six owned versions changed to 1.4.12 |

Clean installation used existing matching-version Prisma engines through supported engine-path environment variables because this environment restricts binary downloads. No such environment paths are baked into the project, user scripts or .env.example. This is not an unrestricted fresh Windows download test.

## New regression evidence

- Actual bundled content, background queue and native DOM fixtures operate with visibilityState hidden and hasFocus false. A matching NEW incoming queues and sends an Auto Reply while another recipient is open. Content interval scans and MutationObserver scanning are disabled in the pulse-only fixture: the worker alarm still discovers the new incoming. Startup unread/old history do not replay.
- The integrated React follow-up form creates an individually authorized linked reminder for its frozen intended recipient, switches to a different WhatsApp chat, locates the offscreen recipient, confirms one native outgoing, completes Sent and leaves the private task pending. Hidden/unfocused variation artificially delays legacy 100ms timer polling to 30 seconds and disables interval polling; DOM-event target/send confirmation still works.
- Native drafts remain intact and block hidden sends until cleared. Background sending OFF blocks hidden navigation/send, remains OFF through the settings form, and retains foreground behavior. Unsupported non-boolean API settings are rejected. Missing older values default ON.
- Pending automation pulses and protects only connected owned background-enabled tabs. The worker sets autoDiscardable false without activating a tab or focusing a window; turning background mode OFF restores prior discardability. Frozen tabs are not messaged/leased; a resumed tab sends once. A malformed post-lease delivery response becomes Unknown and is not blindly retried.
- Actual Schedule forms expose seven weekday checkboxes only in Custom weekdays, reject empty selection, persist selected days and restore them through Reschedule. Every N days exposes a 1–365 interval, displays the saved interval and preserves legacy custom semantics. Existing form behavior was retained; the first fixture used the wrong existing button label Edit, corrected to Reschedule.
- Shared recurrence checks cover weekday selections, saved timezone/wall time, daylight-saving transitions, missed backlog and invalid first dates. Readiness and final claim compose weekday selection with global/contact caps and quiet hours, preventing an overdue or deferred job sending on an unselected day.
- Actual HTTP/API/Prisma creates/edits a weekday record, rejects missing days/wrong first date, completes once and creates exactly one correctly timed next occurrence with unchanged body/day selection. Duplicate completion is rejected. An overdue off-day row advertises its selected next time, rejects direct claim and consumes zero attempts.
- Anonymous diagnostics include background configuration and weekday recurrence; contact keys/names, bodies and account email remain omitted from job summaries.

Existing mentions, Awaiting Reply, filters, native offscreen target verification, manual search/input ownership, group subject/recipient separation, owner changes, burst incoming cancellation, entitlement, lifetime billing, setup/Prisma recovery, notifications and duplicate/Unknown handling remain covered and passing. Prior detailed evidence is retained in QA_REPORT_v1_4_11.md and earlier archives.

## Installed acceptance and limits

Use Source + Chrome 1.4.12 together, original .env/database/secrets and the same Chrome card. See INSTALL_UPDATE.txt and BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md. Keep Background sending ON, original WhatsApp tab/profile running/logged in/online, native composer/search empty, desktop awake and the recipient verified. Add web.whatsapp.com to Chrome Performance → Always keep these sites active. Test one consenting recipient while another profile/browser remains in front; inspect actual outgoing and Sent without creating duplicate jobs. Auto Reply requires a NEW incoming after enabled rule/master Resume setup.

These are controlled JSDOM/native DOM, actual API/Prisma/PostgreSQL-protocol and Redis/BullMQ checks. This environment has no runnable Chrome/Chromium binary; no real Chrome GUI, live logged-in Windows WhatsApp delivery, profile/window lifecycle or OS notification acceptance is claimed. Frozen/discarded/closed/logged-out sessions and sleeping/offline computers cannot send with this DOM extension. Alarm scheduling can be delayed; exact due-second delivery, cloud/browser-closed sending, live merchant payments, unrestricted network installation and protection from account restrictions are not certified.
