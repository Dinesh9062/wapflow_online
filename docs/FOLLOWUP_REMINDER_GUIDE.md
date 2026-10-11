> Current release **1.4.12**: see [BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md](BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md) for background sending, Custom weekdays, preserved intervals and complete update steps. Existing numeric limits and saved quiet-hour choices are retained. Earlier release details below are historical.

# Follow-up reminder aur timing setup — 1.4.9

## Aapki latest report mein kya tha

05 October ki teen screenshots aur full ZFLEET_diagnostics(4).json review kiya. Extension 1.4.8/dom-v12, account signed in/premium, one saved verification, 13 Sent schedules aur one cancelled schedule the. Sumit Jind Office follow-up ke Send reminder par target verification warning aa rahi thi. Follow-ups panel mein verification controls nahi the. Follow-up ke purane local ID aur current saved identity alag hone par resolver bhi target miss karta tha. Yeh queue mein message create hone se pehle ka failure tha; report healthy scheduled sending dikhati hai.

Auto Reply report ka `cooldown-or-daily-cap` ek limit result hai, offline/server failure nahi. Unread 118 aur Groups 12 native counts the. Chat directory scan user interaction par stop hua tha; 37 partial names kept the. Yeh intentional stop hai: refresh ke liye Chat list use karein jab setup complete karna ho.

## Follow-up se WhatsApp reminder bhejna

1. WhatsApp ke andar **Follow-ups → Send reminder** dabayein.
2. Saved verified target mil gaya to message editor directly khulega. Aap koi doosri chat khol sakte hain; target editor mein frozen hai.
3. Target pehli baar unverified ho to extension loaded row se woh chat kholega aur isi Follow-ups panel mein verification dikhayega. Intended name check karein, Individual/Group choose karein, confirmation tick karein, **Verify and continue reminder** dabayein. Is step se message send nahi hota.
4. Unloaded/unverified target ko WhatsApp native search se ek baar kholein. Send reminder dobara use karein. Saved verification ke baad future reminders native search se automatically target dhoondhenge.
5. Reminder text aur **future date/time** set karein. Default reminder time about two minutes ahead hai. Authorization checkbox tick karke **Add to queue** dabayein. Is button ke baad hi WhatsApp message scheduled hota hai.
6. Target ko open rakhna zaroori nahi. Due time par extension native WhatsApp search se target kholega, actual saved message markers/native ID match karega, phir lease lekar send karega.
7. Follow-up card par **WhatsApp reminder: queued / sent / waiting…** aur **View reminder** dikhega. Same follow-up par repeated clicks naya duplicate message nahi banayenge. Delivery unknown/failed ho to existing schedule par Review/retry use karein, WhatsApp outgoing check aur Not sent checkbox ke baad.

**WhatsApp tab foreground/active, online aur computer awake hona zaroori hai.** Target ki chat open rakhna zaroori nahi. Existing composer draft, active native search, duplicate names, changed identity, another lookup ya manual interaction par sending wait karegi. Draft/search clear karke WhatsApp active rakhein; queued message retry hoga. Hidden tab, browser closed aur computer sleep mein exact-time sending ka promise nahi hai.

Group-member follow-up ka recipient original **group** hai; member name private subject hai. Personal reminder bhejne ke liye us member ki personal chat par separate follow-up/schedule banayein. Arbitrary name se personal number infer nahi hota.

Private follow-up due notification aur outgoing WhatsApp reminder alag actions hain. Note save karna ya personal alert dismiss karna recipient ko message bhejne ki authorization nahi hai. **Done/Cancel** queued linked reminders cancel karta hai; pehle se sent ya already claimed message undo nahi hota. Repeating private follow-up ki next occurrence naya task hai aur uska outgoing reminder separately authorize karna hai.

## Message timing & limits

**Settings → Message timing & limits** mein defaults automatically load hote hain, existing account par bhi. Old rule-specific cooldown/caps aur working hours preserve hote hain.

| Setting | Default | Kahan apply hoti hai |
|---|---|---|
| Gap between messages | 30 seconds | All automated send attempts together |
| Total attempts/day | 50 | Account ke sab tabs/devices together |
| Same contact gap | 10 minutes | Scheduled + reminder + auto to that identity |
| Contact attempts/day | 3 | Same contact/group together |
| Auto reply delay | 10 seconds | New live incoming; Unanswered uses its longer rule delay |
| Quiet hours | ON, 10 PM–8 AM | All automated sending, every day |
| Timezone | Existing setting, default Asia/Kolkata | Quiet hours aur daily midnight reset |
| Auto Reply master | New accounts paused | Resume aur enabled matching rule required |
| Rule cooldown/cap | New rules 30 minutes / 3 replies | Existing custom rule settings preserved |
| Groups in auto rules | OFF | Explicit selected group plus Allow groups required |

Timing server par checked hoti hai **before a send lease/attempt**. Multiple tabs simultaneous send nahi kar sakte. Attempt receipts restart ke baad bhi DB mein rehte hain; failed/unknown attempts bhi quota count karte hain. Old schedule leases count hote hain. Manual WhatsApp messages in these automated quotas mein count nahi hote.

Limits/quiet hours ki wajah se future send late ho sakta hai. Message Scheduled aur linked Follow-up par reason/next attempt dikhega. Contact cooldown ya day limit quietly bypass nahi hota. Quiet hours disable karna allowed hai, lekin total/contact gap aur quotas remain enforced. **Restore timing defaults** form fields reset karta hai; **Save settings** se apply karein. Mention phone/names, exclusions, working hours aur account label reset nahi hote.

Auto replies time-sensitive hain: due hone ke five minutes baad unserved reply worker expire karta hai. Quiet hours/day cap ke baad next morning old auto response blast nahi hoga. Ordinary scheduled/reminder messages remain queued. Contact exclusions apply to all automated sending. Only chosen contacts/rules and explicit authorized reminders are sent.

Koi interval/limit WhatsApp account restrictions se immunity guarantee nahi karta. Yeh conservative application defaults hain, WhatsApp-approved thresholds nahi. Known/consenting contacts ko useful messages bhejein; unwanted repeated contact avoid karein. WhatsApp guidance: https://faq.whatsapp.com/361005896189245/?locale=en_US

## Update — old .env preserve karein

Full new source ek **new folder** mein extract karein. Original `.env` copy karein; DATABASE_URL, JWT_SECRET, DATA_ENCRYPTION_KEY, previous keyring, Redis, merchant keys aur account label same rakhein. Database reset/re-register zaroori nahi. Selective old/new file mix na karein.

New source root `ZFLEET-Connect` se:

```powershell
npm ci
npm run db:migrate
npm run check:setup
npm run typecheck
npm run build
npm run dev:api
```

Second terminal, same new root:

```powershell
npm run dev:worker
```

API aur worker ki old copies stop karein; PostgreSQL/Redis running rakhein. 1.4.9 adds no database migration; db:migrate missing prior migrations safely apply karta hai. npm ci Prisma client automatically generate karta hai. Manual recovery command `npm run db:generate` hai, .env replace karna generated client problem solve nahi karta.

Existing Chrome extension **card keep karein**. Us card ke currently loaded folder mein complete new `apps/extension/dist` files replace karein, ya Chrome ZIP extract karein; `manifest.json` directly loaded folder mein ho. Same card par Reload karein, then WhatsApp refresh. Version **1.4.9 / 2026.10.05-dom-v13** check karein. Extension remove karke duplicate load karne se saved bindings/cache lose ho sakte hain.

Supplied Chrome build API `http://localhost:4000` use karta hai. Hosted API ke liye original deployment guide ke mutabik `ZFLEET_API_ORIGIN` se rebuild karein. Local frontend demo real messages nahi bhejta.

## One consenting acceptance check

Existing Sent/Unknown records inspect karein; unhe blindly recreate na karein. Ek known consenting test contact par new follow-up → Send reminder → verify once if asked → future time/authorization → Add to queue. Doosri chat kholein. Native composer/search empty aur WhatsApp foreground rakhein. Due time aur timing controls ke baad target automatically open hona, outgoing message ek baar appear hona aur linked status Sent expected hai. Quiet/cooldown test mein Waiting reason expected hai; sending ke liye us control ka eligible time wait karein.

This release was checked with actual bundled content/background/native DOM fixtures and isolated API/database/Redis worker tests. These are controlled tests, not a claim of sending real messages on your Windows device.
