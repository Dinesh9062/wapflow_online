# INR 1,000 one-time lifetime payment

New checkout charges INR 1000 (100000 paise) once. The original 14-day account trial remains. A verified captured payment grants lifetime access without an expiry or recurring charge. An unpaid checkout does not extend the trial. Disabled accounts remain blocked. Refunds revoke the lifetime entitlement; an unexpired original trial may still apply.

## Merchant setup

1. Use your own activated Razorpay merchant account. Enable the payment methods you intend to offer, including UPI where available. Money is collected and settled through that merchant account; this code contains no recipient UPI ID or payment credentials.
2. Preserve the original application `.env` and add server-only `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`. Use matching Test or Live keys and a separately configured webhook secret. Restart the API. No `RAZORPAY_PLAN_ID` is used.
3. Run `npm run db:migrate` before starting this release. It adds the `LifetimePayment` table without resetting existing users, encrypted records or legacy subscriptions.
4. Deploy a reachable HTTPS API and register `https://YOUR_API_ORIGIN/webhooks/razorpay` for `payment_link.paid`, `payment.captured` and `refund.processed`. Keep legacy subscription events enabled if existing customers have old recurring plans. The webhook requires the raw signed request and provider event ID. A payment gateway cannot call a private `localhost` URL; use your deployed endpoint. Localhost can still check its own linked payment through the provider API using **Check payment / unlock**.
5. In the extension, sign in and open Subscription -> **Pay ₹1,000 once**. The server creates or reuses an unexpired hosted Standard Payment Link for that account. Repeated concurrent clicks reuse the pending checkout. The amount, INR currency, full-payment policy and account reference are fixed by the server.
6. Complete checkout, then use **Check payment / unlock** if the signed webhook has not arrived. This action re-fetches the current account's provider checkout/payment; it is not an admin override. The license must show **lifetime** only after captured payment verification.

## QR and UPI apps

Checkout is hosted by the gateway. Desktop customers can use the QR offered by the enabled merchant payment methods; mobile customers can use the supported UPI app flow. The available methods depend on gateway, merchant activation and customer device.

Razorpay documents the deprecation of ordinary UPI Collect from 28 February 2026, subject to listed exemptions, and recommends UPI Intent or QR. Consequently this release uses hosted checkout and does not depend on entering a payer's UPI ID to start a Collect request. A bare static QR/UPI ID, browser success text, payment screenshot or typed transaction ID cannot automatically establish account-linked captured payment. Test mode and live UPI availability differ; do the final QR/app acceptance with your own enabled merchant and an intended payer.

This implementation uses **Standard Payment Links**, not UPI-only Payment Links. Razorpay's UPI-only Payment Link documentation states that those links are not supported in Test mode. Do not expect every live UPI method to appear with test credentials.

## Verified unlock and refund behavior

The server verifies the stored link ID/reference, exact amount/currency, the payment's linked order, `status=captured`, `captured=true`, the full paid link amount and zero refunded amount. A signed webhook triggers this verification; it does not replace it. Authorized, pending, wrong-amount, wrong-order and other-account payments cannot unlock access. Duplicate webhook IDs are idempotent. A refunded record cannot be revived by an older paid event.

A linked legacy recurring plan is requested to cancel at the end of its cycle after a verified lifetime purchase. If that provider action fails, lifetime access remains active and Subscription shows a legacy renewal warning with a cancellation retry button. Verify cancellation in your merchant dashboard. Existing legacy paid periods continue to work; legacy events cannot shorten a lifetime entitlement. The deprecated `/billing/create-subscription` endpoint returns 410 and creates no new recurring plan.

## Admin and acceptance checks

Register or retain your intended operator account, then promote that existing account from the application server's project root:

```powershell
npm run admin:grant -- YOUR_EXISTING_ADMIN_EMAIL
npm run dev:admin
```

The grant command changes its role and writes an audit record; it preserves its password, original trial and data. Ordinary customer accounts remain denied at the admin portal. Use your own existing credentials to sign in. Admin Payments shows stored lifetime checkout/payment statuses and signed webhook receipts; it does not grant access from a screenshot.

Before accepting real customers, check a captured payment, a pending/authorized payment, delayed webhook with manual check, webhook replay, refund, cross-account access denial and legacy renewal cancellation. Automated tests use an isolated provider fixture and do not charge money or verify your merchant activation. Review unexpected webhook verification failures in your server audit/provider dashboard without sharing secret keys.

Official references: [Standard Payment Link API](https://razorpay.com/docs/api/payments/payment-links/create-standard/), [fetch a Standard Payment Link](https://razorpay.com/docs/api/payments/payment-links/fetch-id-standard), [UPI Collect deprecation](https://github.com/razorpay/markdown-docs/blob/master/payments/payment-gateway/flutter-integration/custom/payment-methods.md), [UPI Payment Links](https://razorpay.com/docs/payments/payment-links/upi/).
