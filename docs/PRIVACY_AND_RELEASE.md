> Current release **1.4.10 / dom-v14**: see [DELIVERY_TIMING_FIX_GUIDE.md](DELIVERY_TIMING_FIX_GUIDE.md) for current timing defaults, queue fixes and update steps. Quiet hours default OFF; explicitly saved ON is preserved. Earlier release details below are historical.

# Privacy and release preparation

Draft privacy notice for your review and publication:

Wapflow Connect reads currently visible WhatsApp Web conversation metadata and messages to provide filters, message-linked follow-ups and user-enabled auto reply matching. It preserves the native WhatsApp interface. Full chat history is not uploaded. Incoming text used for auto reply matching is processed transiently and is not saved as a chat-history archive. User-authored scheduled message bodies, follow-up notes and rule responses are stored on the configured server with authenticated encryption. Contact names/keys, message reference IDs, conversation timestamps, account settings, extension/device health, subscription metadata and action results are stored to operate the service. Passwords are hashed; payment card information is handled by the payment provider. No payment secrets are included in the extension.

Browser state contains an access token, cached owned management records, active-chat names/metadata, saved target verification markers and directory completion count/time under extension-only Chrome storage access. Directory completion is scoped by owner and WhatsApp account label and reused for up to 24 hours; name/verification observations remain in the owned local cache across sign-out for reuse by the same account; sign-out clears the current token and queue state. Collection uses rendered All/Groups rows with a visible progress loader and Stop control; it does not open every conversation or create a full history archive. Due jobs can use native search to locate a previously verified recipient; search results must be uniquely identified and the opened conversation reverified before sending. Auto reply is paused by default; each send rule requires user enablement. Scheduled messages require explicit consent. Sending is through native WhatsApp Web controls and requires an available active session. Unknown results are not automatically retried.

Users can cancel schedules/follow-ups, disable/delete rules and sign out. Server data stays in the account after sign out. Before launch, set a retention period and supply a support procedure for account export/deletion. Those account export/deletion endpoints are not implemented in this development build. Set your actual company/controller details, support contact, hosting region, data retention, subprocessors and policy URL before publishing. Do not publish this draft as a finalized legal policy without completing those details.

Release checks:

- [ ] Confirm real current WhatsApp DOM selectors, English/Hindi UI and both dark/light native themes.
- [ ] Test message identity with personal, group, self, archived, muted and newly opened chats; verify no wrong target or duplicate send.
- [ ] Test reload, restart, logout/login, account switch, native drafts, focus loss and offline/network recovery.
- [ ] Test system notifications, click-to-open, snoozed/repeating reminders and Chrome badge.
- [ ] Test real PostgreSQL migrations and backup restore with the encryption key.
- [ ] Test INR 1000 lifetime checkout, captured/pending payments, delayed/replayed/out-of-order signed webhooks, refunds and legacy renewal cancellation.
- [ ] Add verified email and account recovery before public registration; remove known seed credentials.
- [ ] Define contact/account deletion/export and operational retention/support policy.
- [ ] Check dependency updates/vulnerabilities and validate the pinned build on your server.
- [ ] Package only extension `dist` files for the store. Review permissions: storage, alarms, notifications and exact host origins.
- [ ] Publish your actual privacy notice/support URL, screenshots and truthful session/scheduling limitations.
- [ ] Submit through your own Chrome Web Store account and complete review. An unpacked build is not a signed store release.

Platform references used while implementing:

- Chrome alarms: https://developer.chrome.com/docs/extensions/reference/api/alarms
- Chrome service workers: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
- Razorpay Payment Links API: https://razorpay.com/docs/api/payments/payment-links/create-standard/
- Razorpay webhook validation: https://razorpay.com/docs/webhooks/validate-test/

The extension is an independent Wapflow productivity product. Use provider logos/trademarks only according to your final release review; this package does not imply WhatsApp endorsement.

Version 1.4.7 Mentions uses the original native global message-search pane with a configured own @number or exact alias. Search results are not copied into an extension inbox or archived, and never become contact-directory rows. Minimal own-tag/direction/time/identity evidence may update the existing observed conversation metadata. Diagnostics expose query kind and status, not raw numbers/aliases. Only an unchanged extension-owned query is cleared; a user-entered/edited query is preserved.

Version 1.4.8 retains only short-lived native fresh-unread navigation evidence in content-script memory, scoped by owner/account label, expiring after two minutes. Drafts/manual searches are preserved. Own synchronous browser input is distinguished from later user input; this does not authorize unverified names or bypass final recipient markers and the server lease.
