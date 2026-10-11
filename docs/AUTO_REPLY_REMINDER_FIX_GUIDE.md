> Current release **1.4.12**: see [BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md](BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md) for background sending, Custom weekdays, preserved intervals and complete update steps. Existing numeric limits and saved quiet-hour choices are retained. Earlier release details below are historical.

# Auto Reply aur Send reminder — 1.4.11

## Aapki latest report mein kya mila

Full `ZFLEET_diagnostics(6).json` aur 6 October ke chaar screenshots check kiye gaye. Report 3:42:48 PM IST ki hai:

- Linked follow-up WhatsApp reminder **Sent**, due time **3:40 PM IST**, one attempt. Ek ordinary scheduled message bhi Sent, due time 3:35 PM. Private follow-up task abhi pending hai; message send hone se task automatically Done nahi hota.
- Latest incoming 3:41 PM. Auto Reply ka outcome **delivery-limit / Contact cooldown**, next eligible **3:50:03 PM IST**, aur is contact ko aaj **0/10 auto attempts**. Is incoming ke liye koi auto message queue nahi hua.
- Rule cooldown **1 minute**, rule cap **10/day**. Purane account controls ka **10-minute contact cooldown / 3 attempts per contact per day** bhi Auto Reply ko rok raha tha. Quiet hours saved ON the, lekin us waqt inactive the. Global daily usage 2/50 tha.
- Empty composer par `sendButton: false` normal hai; is reading se broken Send selector prove nahi hota. Purani Unknown auto delivery kal ki thi; use automatically resend nahi karna chahiye.
- Earlier screenshots mein intended-chat confirmation checkbox unticked tha. Is step par Verify and continue disabled hota hai, aur message queue nahi hota. Later report ke Sent linked reminder se pata chalta hai ki reminder queue subsequently run hui.

Report purane Sent jobs mein lookup errors bhi dikhati thi. Successful completion ab error clear karta hai, aur already Sent older records ka stale error UI/report mein successful result ko contradict nahi karta. Original records ko reset/delete nahi kiya jaata.

## Contact limit mode

Settings → Message timing & limits → Contact limit mode:

| Mode | Schedule / linked reminder | Auto Reply |
|---|---|---|
| **Auto Reply uses rule limits (default)** | Account contact cooldown + contact daily cap; both features share attempts | Saved matching rule cooldown + cap, counting actual automatic attempts to the contact across auto rules |
| **Share contact limits across all features** | Account contact cooldown + cap across all automated attempts | Both account contact controls AND saved rule controls |

Missing mode in older settings resolves to the new default. Existing numeric gaps/caps, saved rules, explicit quiet-hour ON/OFF and timezone are preserved. Select Shared and Save if you want the earlier combined policy.

**Every mode still enforces the global gap, global daily cap, quiet hours, account exclusions, active entitlement, native identity checks and draft/search preservation. Auto Reply also requires master Resume, an enabled matching rule and its timetable.** Only actual starts/leases count; failed/unknown attempts also count. Queue creation alone does not count. Restart/refresh does not reset quotas.

| New account timing setting | Default |
|---|---|
| Global message gap | 30 seconds |
| All automated attempts/day | 50 |
| Schedule + reminder same-contact gap | 10 minutes |
| Schedule + reminder contact attempts/day | 3 |
| Auto Reply delay | 10 seconds |
| New auto rule contact cooldown / cap | 30 minutes / 3 per day, rule disabled initially |
| Quiet hours | OFF; optional 22:00–08:00 in saved timezone |

Your existing 1-minute / 10 rule stays unchanged. A reminder no longer consumes its auto contact limit in default mode, but a reply within 30 seconds of any attempted automated send still waits for the global gap. Shared mode deliberately keeps the longer account contact block. No timing setting guarantees protection from WhatsApp restrictions; send expected messages to consenting contacts.

## Send reminder ka actual flow

1. Follow-ups mein note/task add karna private reminder hai. Notification aapko milti hai; recipient ko message nahi jaata.
2. Task par **Send reminder** message setup kholta hai. Saved target verified ho to editor seedha khulta hai. Otherwise target chat open hoti hai: name check karein, **I confirm…** tick karein, phir **Verify and continue**.
3. Editor mein reminder text check/edit karein, **future date/time** choose karein, send authorization tick karein aur **Add to queue** click karein. Verification click akela message send nahi karta.
4. Task card ab linked reminder ka Queued / Waiting / Sent / Failed / Unknown status dikhayega. **View reminder** usi existing job ko kholta hai; repeated clicks naya message nahi banate.
5. Due time par active WhatsApp tab saved target automatically search/open karega, verify karega aur message send karega. Aap dusri chat khuli rakh sakte hain. Native composer/search empty, tab foreground/online aur computer awake hona chahiye. Draft/manual search se automation pause hoti hai.
6. **Sent** WhatsApp message ki delivery confirmation hai. Task ko **Done** tab karein jab kaam complete ho. Pending reminder se pehle task Done/Cancel karne par uska unsent linked message cancel ho jaata hai.

Waiting reason aur Next check dekhein. Exact due-second sending hidden tab, sleep, drafts, quiet hours ya quota block ke dauran possible nahi hai. Failed/Unknown mein native chat inspect karein; delivery unknown hone par automatic retry nahi hoti, taaki duplicate na jaaye.

## Auto Reply ka setup aur test

1. Updated API + extension dono run karein; login/trial/lifetime entitlement active ho.
2. Target chat once open karke Settings mein verify karein. Auto Reply → Add/Edit rule: **Contact** trigger, intended contact CHECKED, excluded nahi, response filled, days selected, current time active (All day = 00:00–00:00), **Enabled ON**, Save.
3. Master **Resume**. Settings mein Contact limit mode default **Auto Reply uses rule limits** rakhein aur Save. Existing rule limits intended values hon; optional quiet hours ki actual state check karein.
4. Settings Sending status, Auto Reply Last incoming check aur Recent auto replies dekhein. Tab foreground/online aur native composer/search empty rakhein; selected target ki chat already open rakhna zaroori nahi.
5. Kisi known consenting contact ka **NEW incoming after setup** use karein. Historical unread, reload aur old blocked message auto response trigger nahi karte. Rule delay/global gap ke baad outgoing confirmation aur Sent check karein.
6. Agar cap/long cooldown/quiet window reply ko stale kare to woh queue nahi hota ya expire hota hai. Eligibility ke baad NEW incoming required hai. Old Unknown entry ko Open chat to review se inspect karein; woh automatically replay nahi hogi.

## Windows update — existing setup preserve karein

1. Old API/worker stop karein; PostgreSQL/Redis running rakhein. Complete Source ZIP ko **new folder** mein extract karein. ORIGINAL `.env` new `ZFLEET-Connect` root mein copy karein. Same DB, JWT/encryption keys/keyring, account namespace aur user account rakhein. Database reset ya fresh account ki zaroorat nahi. This release adds no migration.
2. New root mein PowerShell:

```powershell
npm ci
npm run db:migrate
npm run check:setup
npm run typecheck
npm run build
npm run dev:api
```

3. Second terminal, SAME root: `npm run dev:worker`.
4. Same Chrome extension card / existing loaded folder preserve karein. ALL contents replace karein with new `apps/extension/dist`, ya complete Chrome ZIP contents. `manifest.json` directly loaded folder mein ho. Same card Reload; WhatsApp refresh. Duplicate old extension cards disable karein. Diagnostics extension AND server **1.4.11** hon; adapter remains **2026.10.05-dom-v14** because this correction changes delivery policy/status rather than native selectors.
5. Supplied Chrome build localhost:4000 API use karta hai. Hosted API ho to your existing `ZFLEET_API_ORIGIN` ke saath source build karein. Chrome update alone backend update nahi karta.

Prisma missing error ho to root mein `npm run db:generate`; `.env` change client generate nahi karta. Keys regenerate ya Docker volumes delete na karein. Full original features, 14-day trial and INR 1000 one-time lifetime plan remain present.

Controlled test results: QA_REPORT.md. Real installed Windows outgoing/Chrome notification acceptance must use a consenting contact; no real recipient message or payment was sent by this update.
