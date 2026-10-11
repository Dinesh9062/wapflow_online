> Current release **1.4.10 / dom-v14**: see [DELIVERY_TIMING_FIX_GUIDE.md](DELIVERY_TIMING_FIX_GUIDE.md) for current timing defaults, queue fixes and update steps. Quiet hours default OFF; explicitly saved ON is preserved. Earlier release details below are historical.

> Current release 1.4.9 / dom-v13: follow-up verification, linked reminder queue and server timing controls are described fully in [FOLLOWUP_REMINDER_GUIDE.md](FOLLOWUP_REMINDER_GUIDE.md). Update API and extension together. Quiet hours/contact limits may defer sends; old auto replies expire rather than replay after long delays. Earlier version details below remain historical.

# Deployment and operational setup

Use a server or managed services that can run Node, PostgreSQL and Redis continuously. This source package does not create infrastructure or a public deployment. Build/test locally, then deploy your own API and extension build.

1. Run Node 22+ as an unprivileged service account. Keep PostgreSQL/Redis on private interfaces; do not expose their ports publicly. Use TLS for the API and admin origin. Supply `.env` through your secret manager/service environment.
2. Set `DATABASE_URL`, `REDIS_URL`, a random 32+ character `JWT_SECRET` and a random 64-hex-character `DATA_ENCRYPTION_KEY`. Back up the encryption key securely alongside your backup recovery procedure. Losing it prevents record decryption.
3. Run `npm ci` (explicit client-generation postinstall), `npm run db:generate`, `npm run db:migrate`, `npm run build`. Use the exact lockfile in this package. Do not copy development `.env`, seed passwords, test binaries or node_modules from someone else's machine.
4. Start the API and queue worker as separate supervised processes. API: `node --env-file=.env apps/api/dist/main.js`. Worker: `node --env-file=.env --import tsx apps/worker/src/main.ts`. Both run from the project root. Configure restart-on-failure and startup on reboot.
5. Serve `apps/admin/dist` at a restricted HTTPS admin origin. Build it with `VITE_API_ORIGIN=https://YOUR_API_ORIGIN`. Add its origin to `CORS_ORIGINS`. Provision your admin with the seed script, using strong private credentials.
6. Build the extension for your actual API host. The manifest grants only WhatsApp and that exact host.

PowerShell example:

```powershell
$env:ZFLEET_API_ORIGIN="https://YOUR_API_ORIGIN"
npm run build -w @zfleet/extension
```

Linux:

```bash
ZFLEET_API_ORIGIN=https://YOUR_API_ORIGIN npm run build -w @zfleet/extension
```

7. Extension clients install that rebuilt `apps/extension/dist`. Changing the server domain requires rebuilding; there is no wildcard API host permission.
8. Configure Razorpay Payment Links and merchant UPI methods, with server-only RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET. No plan ID is used. Amount is fixed at INR 100000 paise for lifetime; no recurring subscription is created. See BILLING_SETUP.md.
9. Register the public HTTPS /webhooks/razorpay endpoint for payment_link.paid, payment.captured and refund.processed. Retain legacy subscription events for existing installations. Exact raw bytes are HMAC-verified; provider amount/currency/order/captured status are re-fetched before changing entitlement.
10. Test hosted checkout, delayed webhook/manual Check payment, replay and refund on the configured gateway. Enable merchant UPI methods before live QR/app acceptance. No production money was charged by these automated tests. Never put payment/JWT/encryption secrets in extension code.

When using the supplied loopback reverse proxy, set `TRUST_PROXY=loopback` so per-client API limits use its sanitized forwarded IP. Keep port 4000 reachable only by that proxy. A reverse proxy must forward `/socket.io/` websocket upgrades to port 4000. Set request body size limits and proxy rate limiting at the edge. The sample in `infra/nginx.conf` assumes you supply your actual domain and TLS configuration. API in-process throttling protects a single instance; use a shared rate limiter before scaling to multiple API nodes.

Back up PostgreSQL and encryption keys. Redis AOF persists the repeat scheduler. Due schedule records remain authoritative in PostgreSQL, so a worker restart can rebuild readiness scans. Monitor queue failures, API 5xx, webhook retries, last device heartbeats and unknown send states. No send job can be guaranteed exactly once across a browser click and an external app; ambiguous results require inspection rather than blind retry.

Trial policy: 14 days from server account creation. Same email cannot reset trial via reinstall. This version has no email verification/social sign-in/password reset; add those before opening registration widely. Creating a new account with a different email is not prevented by installation identity. A lifetime license has no renewal expiry. A legacy paid/cancelled subscription retains access until the provider period end; pending payment receives no additional grace beyond that already-paid period. Configure a different grace policy only with explicit product rules and additional billing tests.

Before public launch, test on real PostgreSQL in your deployment and complete the current WhatsApp DOM/manual browser suite. PGlite test protocol fixtures supplement those checks.

## Updating to 1.4.8

Deploy the complete API/worker/extension update together and preserve the original .env, keys and database. 1.4.8 has no new schema migration. Run npm run db:migrate to apply any missing prior LifetimePayment migration; existing records are preserved. Reload the existing extension card and WhatsApp. Inspect old drafts/sent messages before retrying Failed/Unknown jobs; both retries require delivery review. See INSTALL_UPDATE.txt.

check:setup scans all encrypted authored categories. DATA_ENCRYPTION_PREVIOUS_KEYS may contain up to eight available original 64-hex keys from your own backups; new writes use DATA_ENCRYPTION_KEY. Unknown/lost keys cannot be recovered. An inherited service environment can override --env-file; the checker compares without logging secrets. Restart both API and worker after keyring/configuration changes. Unsupported legacy/damaged formats are preserved with a distinct warning and cannot be repaired by changing a key.

Keep the existing Chrome extension identity/card when updating so saved bindings and observed names remain available. Version 1.4.8 / dom-v12 searches an off-screen saved verified schedule/reminder recipient via native chat-list search; it still requires an active foreground session, empty composer/search and identity confirmation. Completed chat-list cache is owned and account-label scoped, reused for up to 24 hours; manual Chat list refresh is available. A loader covers native indexing before scroll starts and cancellation keeps partial names.

Mentions adds native global-search ownership and a Pending view, with no HTTP/API/schema changes. Native history hits are not contact records or an archived message history. Configure own identity; while native search is open, existing automatic sends pause. See MENTIONS_GUIDE.md.

1.4.8 fixes native cell navigation/trusted search events and bounded fresh unread retries. No schema/API change; saved recipient verification and send lease still apply. See AUTOMATION_FIX_GUIDE.md.
