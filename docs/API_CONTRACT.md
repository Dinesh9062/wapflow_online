> Current release **1.4.12**: see [BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md](BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md) for background sending, Custom weekdays, preserved intervals and complete update steps. Existing numeric limits and saved quiet-hour choices are retained. Earlier release details below are historical.

# ZFLEET Connect API contract

Version 1.4.8 adds no HTTP endpoint or schema migration. Native mention-search results stay in the browser, are not indexed as contacts and do not become an account history archive. Existing conversation events continue syncing minimal observed metadata only.

Base URL defaults to `http://localhost:4000` in development. JSON requests and responses. Authenticated requests use `Authorization: Bearer <token>`. Errors use `{ "error": "reason" }` with 400 validation, 401 auth, 402 license, 403 admin, 404 ownership/not found, 409 conflict, 429 rate limit, or 503 disabled/unconfigured features.

| Method | Path | Body or behavior |
|---|---|---|
| GET | /health | Version and API reachability |
| POST | /auth/register | name, email, password; creates fixed 14-day trial |
| POST | /auth/login | email, password; token expires after seven days |
| POST | /auth/logout | Revokes current user's existing tokens |
| GET | /state | Owned queues, rules, notes, metadata, settings, license and flags |
| GET | /license/status | Server trial/lifetime/legacy paid authority |
| PATCH | /settings | timezone, graceMinutes, notifications, autoPaused, excludedKeys, workingStart, workingEnd, workingDays, accountNamespace |
| POST | /notes | contact, text; encrypted private note |
| GET/POST | /followups | Contact/message follow-up records |
| PATCH | /followups/:id | status, dueAt, note, priority, reminderMinutes, repeat, repeatDays |
| GET | /reminders/due | Due reminder records; notification receipt tracked per device |
| GET/POST | /scheduled-messages | Scheduled message queue |
| PATCH | /scheduled-messages/:id | action=cancel OR future dueAt/body; failed/unknown retry requires confirmNotSent=true |
| GET/POST | /auto-reply-rules | Auto reply rule records |
| PATCH/DELETE | /auto-reply-rules/:id | Edit/toggle/delete owned rule |
| POST | /events/conversation-state | contact, message(key,direction,at), live; no message history body |
| POST | /auto/prepare | contact, message(key,body,at), first; incoming text used transiently for matching |
| GET | /jobs/ready | Owned due jobs eligible for availability check |
| POST | /jobs/claim | id, deviceId(UUID), contactKey; atomic single lease |
| POST | /jobs/complete | id, leaseToken, status(sent/failed/unknown), error? |
| POST | /jobs/unavailable | id, optional reason (1–400 chars); mark owned pending job Needs WhatsApp Open without claiming |
| POST | /extension/heartbeat | deviceId, health; adapter metadata |
| POST | /billing/create-payment | Server creates/reuses fixed INR 1000 lifetime hosted payment link |
| POST | /billing/check | Re-fetch current owner payment and verify captured status/amount/order |
| POST | /billing/create-subscription | Deprecated, returns 410; no new recurring plan |
| POST | /billing/cancel | Cancel renewal at period end |
| POST | /webhooks/razorpay | Raw-body HMAC signature and event ID headers; provider state reconciled |
| GET | /admin/overview | Admin users/licenses, flags, heartbeats, audit, webhook metadata |
| PATCH | /admin/users/:id | disabled and/or supportNote; access changes increment token version |
| PATCH | /admin/flags | scheduling, autoReply |

Contact shape: `{key: "default|919000000001@c.us", name: "Dummy", type: "individual"}`. Keys are scoped by manually configured WhatsApp account label. Real target verification is performed in the browser adapter before every send.

Follow-up POST example:

```json
{"contact":{"key":"default|919000000001@c.us","name":"Dummy","type":"individual"},"messageKey":"false_919000000001@c.us_ID","note":"Confirm timing","dueAt":"2026-10-05T05:30:00.000Z","priority":"high","reminderMinutes":10,"repeat":"weekly","repeatDays":1,"timezone":"Asia/Kolkata"}
```

Schedule uses `contact`, optional `messageKey`, `body`, `dueAt`, `repeat`, `repeatDays`, `timezone`, and mandatory `consent: true`. API validates future times for creation/rescheduling. Scheduled, rule and follow-up records use authenticated encryption at rest.

Rules: `name`, `trigger` (keyword/first/outside-hours/unanswered/contact), `keywords[]`, `response`, `days[]` (Sunday=0), `start`, `end`, `timezone`, `cooldownMinutes`, `dailyCap`, `delayMinutes`, `contactKeys[]`, `excludedKeys[]`, `allowGroups`, `enabled`. Full-day windows use equal start/end. Overnight windows belong to their starting weekday. Boundaries are start inclusive and end exclusive.

Socket.IO uses bearer token in `handshake.auth.token`; each connection joins only its own user room. `changed` event signals a client to reload state. Admin uses this live signal; the MV3 background uses alarms and the extension UI asks every five seconds; background coalesces requests with a five-second server-state cache to tolerate worker suspension.

Data models: LifetimePayment, User, Contact, Followup, Schedule, AutoRule, Conversation, Device, Audit, Webhook, FeatureFlag. A conditional update claims a schedule from queued/ready/needs-whatsapp-open into sending, recording device, lease token and attempt. Only that lease can complete it. Stalled leases become unknown; they are never automatically resent. Completion/recurrence is transactional. Webhook IDs are unique and payment authority comes from the provider API after signature verification, not from browser callback text.

Conversation events return {ok, first, at}. For live events, at reflects monotonic observation order to resolve minute-only native clocks; callers use that returned at for /auto/prepare. Duplicate latest incoming keys retain their stored timestamp. A historical baseline cannot move that direction backwards or cancel a newer incoming auto job. Live events older than two minutes and timestamps more than one minute into the future are rejected. No historical message bodies are stored by this endpoint.

Read/write throttles are separate per authenticated account (240 reads/minute, 120 writes/minute); auth has its own IP budget, checkout/reconciliation have six calls/minute. 429 includes Retry-After and retryAfter seconds. Public GET / and /health do not consume a customer's background-read budget. Follow-up PATCH returns {ok:true,followups:[...]} after the transaction; use this confirmed list even when a subsequent read is throttled.

Lifetime payment authority: raw signed payment_link.paid / payment.captured / refund.processed webhooks map to stored checkout records and re-fetch the provider. Only INR 100000 paise, linked order, captured=true and zero refund unlock lifetime. Duplicate notifications preserve a single webhook receipt. Refunded records cannot be revived by a stale paid event. Browser callbacks and client amount/status/UPI screenshots cannot activate entitlement. /billing/check is restricted to the current owner. Legacy subscription events cannot shorten a lifetime license.

Browser-only directory cache: State.directory is optional {completedAt,count}, composed by the MV3 background from directoryByAccount[authenticatedOwner][accountNamespace]. DIRECTORY_RESULT accepts completion only from the active signed-in premium owner/namespace after observed names/bindings are written. This is not a public HTTP endpoint and does not add a database migration. Incomplete/cancelled or mismatched results are ignored. A completed cache is reused for up to 24 hours only if the corresponding conversation records were restored.

Target preparation precedes /jobs/claim. The eligible foreground/background content script may search and open a unique saved verified native target, but must confirm its actual current key/header/markers. Duplicate names, changed identity, drafts, user search or interruption report unavailability without acquiring a send lease. /jobs/unavailable's optional reason is shown in the existing status. Server lease, final native identity check and completion ledger remain authoritative for duplicate prevention.

Fresh unread retry is browser-local, owner/account-label scoped and expires two minutes after its native observation. Startup unread is not an event. Target preparation still precedes server claim; 1.4.8 does not loosen lease/identity/API freshness validation.


## 1.4.10 delivery metadata

`GET /state` reports `serverVersion`, `delivery` (checked time, timezone, today's automated attempts, cap/reset and quiet window), all pending `autoJobs` plus recent terminal auto history, and scheduled/auto `waitReason`, `waitReasons`, `waitUntil`, `expiresAt` when applicable. Times are ISO timestamps; the client displays account-local next checks.

`POST /auto/prepare` is idempotent per incoming key; it returns the existing job ID or creates one for the latest unresponded incoming. New incoming events supersede older unclaimed auto jobs. Rule cooldown/caps use actual attempt starts, not queued creation time. Long waits return `queued:false`, explicit reason, blocker list, `retryAt`, rule ID and a count/explanation; a NEW incoming is required after eligibility. Short waits stay queued with timing metadata.

`GET /jobs/ready` expires stale auto jobs, decorates due jobs with current timing controls, and selects eligible jobs before deferred ones. Clients check wait metadata before native navigation. `POST /jobs/claim` remains authoritative: rechecks account/contact/rule limits and recipient-linked state in the serialized transaction, then records the lease/attempt. A timing 409 returns `retryAfter`; terminal/claimed jobs cannot be overwritten by an auto cancellation. All attempts share account/contact caps across feature kinds.

## 1.4.11 contact policy and completed delivery metadata

`PATCH /settings` accepts `contactLimitMode`: `auto-rule` (default for missing older settings) or `shared`; unknown values are rejected. Numeric controls and rules are not reset. Rule mode separates automatic contact attempts from schedule/linked-reminder contact attempts, while global attempts/gap, busy-send checks and quiet hours remain shared. Final claim serializes and rechecks current policy. See AUTO_REPLY_REMINDER_FIX_GUIDE.md.

`Schedule.sentAt` reports an actual successful completion time. Successful `/jobs/complete` writes `error:null`; existing Sent rows suppress obsolete earlier errors on output. Follow-up task state changes only through task actions, independent of Sent. Local diagnostics use anonymous `recipientSlot` values for same-report job correlation, with linked `followupStatus`, contact mode and sent time; summaries omit raw contact identities and message bodies.


## 1.4.12 background sending and weekday recurrence

`PATCH /settings` accepts boolean `backgroundSending` (default true for a missing older value). Explicit false is preserved. False restricts target observation/preparation/send to the visible focused document. This setting does not enable server-only/cloud sending and does not bypass license or timing policy. The MV3 worker pulses owned connected pages, skips frozen/discarded pages, bounds response waits and records an unconfirmed post-lease response as Unknown.

Schedule/follow-up recurrence accepts `repeat`: `none`, `daily`, `weekly`, `custom` (legacy every N calendar days) or `weekdays`. Optional `repeatWeekdays` is a unique sorted integer array 0–6 (Sunday=0), max seven. Weekday mode requires at least one and first `dueAt` on a selected day in the saved timezone. `repeatDays` retains its 1–365 interval for custom mode. Linked follow-up messages require repeat none.

Encrypted record JSON stores the day selection; there is no additional SQL column/migration. Schedule PATCH validates merged values, including first date. `/jobs/ready` and transactional `/jobs/claim` apply selected-day eligibility together with timing controls. Overdue off-day jobs wait for the next selected local date/time; a quota or quiet-hours delay is advanced again if it ends on an unselected day. Completion creates exactly one next selected future occurrence at the saved wall time and skips missed backlog. UI cards expose selected days; diagnostics expose recurrence configuration without contact identifiers/bodies.
