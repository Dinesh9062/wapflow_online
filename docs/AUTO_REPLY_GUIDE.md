> Current release **1.4.12**: see [BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md](BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md) for background sending, Custom weekdays, preserved intervals and complete update steps. Existing numeric limits and saved quiet-hour choices are retained. Earlier release details below are historical.

> Current release 1.4.9 / dom-v13: follow-up verification, linked reminder queue and server timing controls are described fully in [FOLLOWUP_REMINDER_GUIDE.md](FOLLOWUP_REMINDER_GUIDE.md). Update API and extension together. Quiet hours/contact limits may defer sends; old auto replies expire rather than replay after long delays. Earlier version details below remain historical.

# Auto reply, schedules and setup — v1.4.8

Ye product web.whatsapp.com ke andar kaam karta hai. Filters WhatsApp ki asli chat list use karte hain. Scheduled recipient ko khula rakhna zaroori nahi; native search ab saved verified target dhoondh sakta hai.

## Selected user ke har naye message par saved reply

Example: Dinesh ka naya message aaye to “Namaste! Aapka message mil gaya. Main jaldi reply karunga.” bhejna hai.

1. Existing ZFLEET account mein sign in karein. Active 14-day trial ya verified paid access chahiye. API aur worker dono running hon.
2. Intended chat ko ek baar native WhatsApp mein open karein. Settings mein verifiedCurrent check karein. Native IDs opaque hon to **Verify open chat** se unique dated visible message ki identity confirm karein. Sirf naam select karna send verification nahi hai.
3. **Auto Reply → Add auto reply rule**. Name: “Dinesh acknowledgement”. Trigger: **Contact specific**.
4. **Selected contacts/groups** mein intended contact ko CHECK karein. Search box mein naam type karna checkbox selection nahi hai. Contact absent ho to Load WhatsApp chat list; setup loader actual collected names dikhata hai.
5. **Auto reply message** mein apna response likhein. Rule Exclude aur Settings exclusions mein usi contact ko selected na rakhein: exclusion hamesha reply block karta hai. Existing exclusions update silently remove nahi karta.
6. Current day ya saare days select karein; **All day**; timezone **Asia/Kolkata**. Controlled test ke liye cooldown **1 minute**, daily cap **10**. Baad mein apne intended limits set karein. Cooldown minimum 1, cap maximum 50 hai; har message par unlimited reply supported nahi.
7. **Enabled** ON karke Save karein. Auto Reply ka master **Resume** aur top Auto status ON hona chahiye. Saved rule aur master switch dono active chahiye.
8. Settings ka **Read newly unread chats** ON rakhein agar doosri chat ke already loaded row par unread count badhne se incoming observe karwana hai. Target verified ho; WhatsApp foreground/online ho, native search/composer empty ho. Recent typing ke baad automation thoda pause karta hai.
9. Setup complete hone ke BAAD intended test contact ka **NEW incoming message** use karein. Purana unread, refresh aur old history naya trigger nahi hain. Pehle match par saved response queue/send hota hai. Within one-minute cooldown dusra message intentional skip hoga; controlled second test cooldown ke baad karein.
10. **Last incoming check**, Scheduled queue, actual native outgoing message aur Notifications dekhein. Rule active hone ka matlab har old message ko reply karna nahi. Apne user se consent ke saath controlled test karein.

Native send ke liye recipient ko pehle se khula rakhna zaroori nahi, jab job ka target saved verified ho. dom-v12 original nested chat cell activate karta hai, aur native search insertion ka apna browser input lookup interrupt nahi karta. Lekin incoming detection visible native message/row evidence par depend karti hai. Read newly unread chats only already loaded native rows ke fresh unread increases observe karta hai. NEW loaded-row unread evidence blocked by a draft/manual search/another lookup is retained for a foreground retry up to two minutes, then expires. Startup unread is not retroactively processed. Ye build hidden WhatsApp APIs se poori unloaded/archived inbox monitor nahi karta. Kisi absent contact ko native WhatsApp mein open karke directory/identity add karein.

## Trigger ka sahi selection

| Trigger | Kab response queue hota hai | Setup |
|---|---|---|
| Contact specific | Checked contact ka har naya incoming, cooldown/cap ke andar | Kam se kam ek checked contact; keyword zaroori nahi |
| Keyword | New incoming text mein koi saved keyword ho | Example price, timing, demo; selected contacts se scope restrict kar sakte hain |
| First incoming conversation | Backend ne is conversation mein pehli incoming ab observe ki ho | Existing observed incoming conversation par repeat nahi; keywords ignored |
| Unanswered for X minutes | Fresh incoming ko delay tak manual answer na mila ho | Manual outgoing reply pending auto response cancel karta hai |
| Outside working hours | Fresh incoming Settings working hours ke bahar aaye | Rule ka apna days/time window bhi active chahiye |

“Har customer ka har naya message” ke liye intended contacts check karke Contact specific rule use karein. First incoming sirf welcome once ke liye hai. Keyword field ko First incoming ke saath fill karna every-message rule nahi banata. Multiple rules match hon to server ek eligible response queue karta hai, sab responses nahi bhejta.

Groups default OFF hain. Group response ke liye **Allow groups** AND exact group ka checkbox dono chahiye. Group member ka incoming group conversation ko trigger karta hai; response group mein jaayega. Member ko privately bhejna ho to uski personal chat select/verify karein.

## Reply kyun pause/skip hota hai

| UI/result | Check |
|---|---|
| Globally paused | Auto Reply master Resume |
| Contact excluded | Rule Exclude aur Settings exclusions |
| No rule matched | Trigger, checked contact/group, keyword, day/timezone, active rule |
| Outside selected time | All day/current day ya correct hours/timezone |
| Cooldown / daily cap reached | Cooldown ke baad test; cap ki next local date tak wait |
| Incoming answered or changed | Aapke manual reply/new latest message ne old auto job supersede kiya |
| Waiting for NEW incoming | Setup ke baad naya message mangwayein; old unread/history trigger nahi |
| Incoming observed; opening will retry | Manual draft/search clear karein, WhatsApp active rakhein; two-minute window applies |
| Incoming chat needs verification | Intended recipient ki chat open karke Verify open chat complete karein |
| Native message time appears old/future | DMY/MDY actual full-date text se compare karein; no native proof means no fresh reply |
| Server busy/offline | Fresh preparation retries up to two minutes; API/worker/network check |
| Needs WhatsApp Open | Foreground/online tab, saved target verification, empty native search/composer; job reason dekhein |
| Duplicate chat name / identity not confirmed | Intended contact ko unique name dein aur Verify open chat again |
| Unknown | Native outgoing check karein; blind retry nahi; definitely unsent ho tab reviewed future retry |

Matched non-delayed response normally around two seconds ahead queue hota hai. Foreground due check around three seconds hai; native rendering/network adds time. Alarms exact-second delivery guarantee nahi hain. Browser/PC off, background/unfocused tab ya manual draft mein automatic send wait karta hai.

Latest report mein observation October ka hai aur parsed native message timestamp May ka hai. Agar FRESH incoming old samajhkar skip ho, Settings DMY/MDY ko native full date se compare karein: `04/10/2026` with DMY = 4 October; `10/4/2026` with MDY = 4 October. Apni WhatsApp locale/date text ke hisaab se select karein. Filename se order decide na karein. Extension ye setting silently change nahi karta. dom-v12 visible native Today/Yesterday/weekday se matching opposite interpretation prove ho tab that message timestamp resolve karta hai; without proof configured format stays authoritative. Read AUTOMATION_FIX_GUIDE.md.

## Schedule aur Follow-up Send reminder

1. Intended recipient ki native identity ek baar verify karein. Future date/time, message aur explicit send consent save karein.
2. Doosri WhatsApp chat open kar sakte hain. Recipient row viewport mein hona zaroori nahi. Composer/native search empty, foreground/online WhatsApp aur API/worker running chahiye.
3. Due time par loaded saved row use hota hai, warna native chat-list search saved name dhoondhta hai. Ek exact result open hota hai; header plus native JID/saved message markers rechecked hote hain. Verification ke BAAD server lease claim aur single native send hota hai.
4. Lookup ka “Finding scheduled chat / Checking saved chat identity” status dikhega. User interaction, duplicate name, draft, existing search ya changed identity par lookup pause hota hai; query/draft aapke hi rehte hain.
5. Follow-ups → **Send reminder** saved recipient ka prefilled schedule kholta hai even when doosri chat open ho. Note review karein, future time/consent save karein. Follow-up **Done** alag task action hai; reminder bhejne ya chat open karne se task automatically complete nahi hota.
6. Actual outgoing message aur Sent status verify karein. Failed preparation lease claim nahi karta; next availability check can retry. Claimed/ambiguous Unknown message automatically resend nahi hota.

Group member subject private task context hai; reminder group recipient ko jaata hai. Private personal message ke liye member ka personal contact explicitly select/verify karna padega.

## Setup loader aur chat-list cache

Initial collection ke BEFORE animated opaque loader shows actual names, phase and scroll-based progress. WhatsApp ke All/Groups list rows behind it read hote hain; collection har chat open nahi karta aur message send nahi karta. **Stop setup · use WhatsApp** partial names retain karta hai. Native pointer/keyboard/wheel use bhi collection stop karta hai. Prior filter/scroll restore hota hai, unless aapne native UI use kiya ho.

Completed directory same signed-in ZFLEET owner AND WhatsApp account label ke liye 24 hours reuse hoti hai. Browser refresh par full scan repeat nahi chahiye jab cache valid/restorable ho. Visible rows still update in realtime; **↻ Chat list** manually new full collection start karta hai. A due job collection interrupt kar sakta hai. 90-second budget/10,000-name limit ke baad partial status milega, complete claim nahi. Large/slow virtualized lists ko staged refresh chahiye ho sakta hai.

Ye active chat-name/metadata index hai; entire phonebook, complete archived list aur full message history archive nahi. Account switching se pehle Settings mein correct account label set karein. Date/name cache ka completion anonymous total nahi; it is owned and namespace-scoped. A verification may need refresh if old markers no longer render.

## Existing filters and update

Unread/Groups totals native WhatsApp buttons se aate hain. Custom-filter badges indexed metadata se count hote hain; list shows real loaded native rows. Awaiting Reply = aapka latest outgoing + no later incoming + grace time. Reading chat reply nahi hai. Mentions → Pending mein observed group aur personal own tags aapke outgoing reply tak rehte hain. Mentions → All mentions original native @number/name/emoji history search dikhata hai. One identity query at a time; native Web history limits apply. Search open ho to automation pause; All chats par aayein. Detailed setup: MENTIONS_GUIDE.md.

Complete v1.4.8 source + ORIGINAL .env/same database use karein. INSTALL_UPDATE.txt commands run karein, same Chrome card Reload and WhatsApp refresh. Settings version **1.4.8 / 2026.10.05-dom-v12**. No new account, reset, seed or keys required. 1.4.8 adds no new migration; db:migrate covers missing earlier migrations. Detailed diagnostics after stable loading omit raw names/JIDs/message bodies.
