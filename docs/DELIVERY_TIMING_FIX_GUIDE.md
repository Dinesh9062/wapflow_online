> Current release **1.4.12**: see [BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md](BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md) for background sending, Custom weekdays, preserved intervals and complete update steps. Existing numeric limits and saved quiet-hour choices are retained. Earlier release details below are historical.

# Auto Reply, Follow-up aur Schedule — v1.4.10

## Latest report ka result

`ZFLEET_diagnostics(5).json` mein extension 1.4.9/dom-v13, signed-in/premium account, one active auto rule, 3 saved bindings aur complete 487-name directory hai. Last incoming check ka actual reason `cooldown-or-daily-cap` hai. Incoming time 05 October 2026 11:19 PM IST tha. Quiet hours ON, 22:00–08:00 hain: account timezone Asia/Kolkata ho to is time sending blocked hoti hai. Purane report mein timezone/attempt counters nahi the, isliye usse exact rule usage prove nahi hoti.

Report mein **zero pending follow-ups, zero linked outgoing reminders**, aur scheduled history **13 sent / 2 cancelled** hai. Koi pending scheduled job is snapshot mein nahi hai. Empty composer par Send button absent hona normal hai; isse send selector broken prove nahi hota.

## Kya fix hua

- Old auto preparation queued/unsent jobs ko cooldown/day cap mein count karti thi. Pehle reply se pehle second incoming aaye to old reply superseded hota tha, naya reply cap par ruk sakta tha. Now a newer incoming cancels the older unclaimed reply and prepares at most one reply for the latest message. Repeated delivery of the same incoming key returns the same job. Queued, never-attempted jobs do not consume caps.
- Actual lease/start attempts count toward limits, including failed/unknown attempts. Rule caps apply to automatic attempts to that contact, across auto rules; account/contact limits cover all features together. Real limits are preserved and checked again at claim.
- Quiet hours are now **OFF by default** for missing/new settings. Explicitly saved ON remains ON. Settings shows a live Sending status and **Turn off quiet hours** action. There is no silent override of an explicit saved choice.
- Before native target lookup, the server returns the timing reason and next eligible check. A blocked schedule does not repeatedly navigate/search WhatsApp. Settings changes cause another queue check. Deferred earlier jobs cannot occupy all 20 ready slots and starve an eligible recipient.
- Schedule cards and linked follow-up reminders show exact wait reason/time. Auto Reply now includes **Recent auto replies** with queued/waiting/sent/cancelled/error status. Long-blocked automatic replies show a reason and require a NEW incoming later, instead of replaying old responses the next morning.
- Automatic jobs expire five minutes after their due time on API and worker paths. Duplicate claims cannot turn an already sent automatic job into Cancelled. Incoming/manual-reply updates and final claims serialize for the same recipient.
- Download diagnostics includes generated time, account timezone, global attempt count/reset time, quiet window, pending auto/scheduled jobs and rule settings. Job summaries omit recipient names, phone keys and message bodies. Existing adapter health remains included; review the report before sharing it outside support.

## Timing defaults — kya expect karein

| Setting | Default | Result |
|---|---|---|
| All message gap | 30 seconds | Two automated sends cannot start together |
| Same contact gap | 10 minutes | Schedule, follow-up reminder and auto reply share this gap |
| Account attempts/day | 50 | Count across tabs/devices, using account timezone |
| Contact attempts/day | 3 | Only 3 total automated attempts to that identity/day, across features |
| Auto delay | 10 seconds | Unanswered rule uses its longer selected delay |
| Quiet hours | OFF | Enable 22:00–08:00 only when desired |
| New auto rule cooldown/cap | 30 minutes / 3 | Existing customized rule values preserved |
| Auto master | Paused on new accounts | Resume and enable a matching rule |

Daily limits reset at local midnight; an enabled quiet window can extend eligibility to 08:00. Working hours only drive Outside hours auto rules. Rule timetable and quiet window are separate. Future eligibility is a **next check**, not guaranteed exact delivery: WhatsApp must still be foreground, online and ready.

For a repeated controlled test, 10-minute contact gap or 3/contact/day WILL stop further automated sends. In **Settings → Message timing & limits**, choose the gap/cap you intend and Save. In **Auto Reply → Edit rule**, review the rule's separate cooldown and cap. Changing only the rule cannot bypass the account-wide contact limit. Counters are not reset by reinstall, restart or turning quiet hours off. No interval/cap guarantees protection from WhatsApp account restrictions.

## Update both API and Chrome — existing data preserve karein

1. Stop old API/worker terminals. Extract the **complete 1.4.10 Source ZIP into a new folder**. Copy your ORIGINAL `.env` to its `ZFLEET-Connect` root. Keep the same database, Redis, JWT/encryption secrets/keyring and account label. No database reset, new account or secret regeneration is needed. This release adds no schema migration.
2. From the new root, PowerShell:

```powershell
npm ci
npm run db:migrate
npm run check:setup
npm run typecheck
npm run build
npm run dev:api
```

3. Second terminal, same new root:

```powershell
npm run dev:worker
```

4. Keep the **same Chrome extension card and its existing loaded directory**. Replace ALL files in that loaded directory with the newly built `apps/extension/dist` files, or all files from the 1.4.10 Chrome ZIP. `manifest.json` must be directly inside that directory. Reload that card at `chrome://extensions`, then refresh WhatsApp. Check version **1.4.10 / 2026.10.05-dom-v14**. Do not leave old/duplicate extension cards active.
5. Supplied Chrome ZIP uses API `http://localhost:4000`. For a hosted API use your existing `ZFLEET_API_ORIGIN` build configuration. Do not use this local ZIP against a different origin. `npm ci` generates Prisma; `npm run db:generate` is the recovery if the generated client is missing. A different `.env` does not generate Prisma.

## Auto Reply use kaise karein

Open intended contact once; verify it if requested. Add a **Contact specific** rule, CHECK that contact, response, correct days/All day/timezone, Enabled ON, Save. Click master **Resume**. Remove an overlapping exclusion only if you intend to include that contact. Settings → Quiet hours OFF when you want replies now; review both account/contact limits and rule limits.

Use a **NEW incoming message after setup**. A First incoming rule only handles the first observed conversation; use Contact/Keyword for an existing chat. Keep WhatsApp active and composer/native search empty. Read newly unread chats can open a selected verified loaded row after a new unread increase. Old unread/history/refresh does not trigger replies. Another chat may be open; the saved verified target opens automatically.

If the last check says rule cooldown/day cap/delivery limit, read the exact reason/count/time. Long-blocked auto replies are skipped; after changing settings or eligibility resumes, use a NEW incoming. Settings → Sending status and Auto Reply → Recent auto replies show delivery progress.

## Follow-up reminder and scheduled acceptance

A private follow-up alert does not automatically send its note to a contact. **Follow-ups → Send reminder**, verify once if requested, enter future time/message, tick authorization and **Add to queue**. A normal Schedule uses the same send pipeline. You may switch to another chat after queuing. Keep WhatsApp foreground/online, computer awake, and native search/composer empty. Due/eligible time par saved target opens and one message is attempted. An unverified/unloaded target needs one verified saved binding; duplicate names or changed identity remain blocked.

The follow-up card shows linked status; **View reminder** opens its existing schedule. Done/Cancel cancels pending linked sends. Group-member follow-up still sends to its original group; the member name is a private subject, not a resolved personal number. Sent messages cannot be recalled by this task action. Unknown/Failed delivery needs inspection before a confirmed retry.

If no outgoing reminder was created, zero linked reminders is expected. Scheduled “Your queue is clear” means there is no pending scheduled job. Notifications also show timing waits; OS notification suppression does not erase in-app history.

These changes are verified with controlled DOM/content/background fixtures and isolated API/PostgreSQL/Redis tests. They do not claim that a real message was sent from your Windows WhatsApp session. Browser/PC off, hidden/unfocused WhatsApp or absent fresh incoming evidence still prevents this visible-DOM extension from sending.
