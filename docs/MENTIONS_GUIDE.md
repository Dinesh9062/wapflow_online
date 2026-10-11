> Current release **1.4.12**: see [BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md](BACKGROUND_AND_CUSTOM_DAYS_GUIDE.md) for background sending, Custom weekdays, preserved intervals and complete update steps. Existing numeric limits and saved quiet-hour choices are retained. Earlier release details below are historical.

# Mentions setup aur update — v1.4.8

Mentions groups aur normal chats dono ke liye hai. **All mentions** WhatsApp ke asli message-search results dikhata hai; **Pending** observed tags ko aapke outgoing reply tak rakhta hai. Dono existing WhatsApp portal/pane mein kaam karte hain.

## Ek baar identity set karein

1. Apne existing ZFLEET account se sign in karein. Active trial/paid access chahiye. Settings version **1.4.8**, adapter **2026.10.05-dom-v12** check karein.
2. **Your WhatsApp number** mein apna poora number country code ke saath save karein. Indian number ke liye `91` + apne 10 digits. Kisi doosre contact ka number yahan nahi daalna.
3. **Your mention names / emoji** mein apne tag ke EXACT names/emoji comma se alag daalein, jaise `Dinesh, 🚘, 🚚`. Sirf wahi aliases use karein jo aapke liye WhatsApp mein @ ke baad dikhte hain. Shared emoji/name doosre person ke liye bhi use ho to text-only matching ambiguous ho sakti hai.
4. **Save settings**. Original account label/.env/database rakhein; update ke liye account ya encryption keys reset nahi karni.

## Ek filter se native mention history dekhein

1. WhatsApp ka existing manual search clear karein; extension aapka query overwrite nahi karta.
2. Top **Mentions** click karein. **All mentions** default hai. Native global search mein apna `@number` query ek baar fill hota hai. Extension chats kholkar poori history scan nahi karta.
3. Indian configured number ke liye national 10-digit query pehle select hota hai. Inline dropdown se country-code variant ya exact saved name/emoji choose kar sakte hain. Ek waqt mein ek identity ka native query chalta hai; multiple aliases ke results ko ek combined total nahi bataya jaata.
4. WhatsApp ki ORIGINAL list mein incoming tag candidates groups aur personal chats se dikhte hain. Plain phone references/email aur recognized outgoing results hide hote hain. Original result click karne par WhatsApp usi message/chat par jaata hai; message copy ya second inbox nahi banta.
5. Aur results ke liye native list scroll karein. **Refresh mentions** current selected identity ko dobara query karta hai. **All chats** ya top **All** normal view par laata hai aur sirf extension ka unchanged query clear karta hai.

Native number search kisi contact ke saved tag name se bhi hit laa sakta hai. A search snippet is a history candidate, not automatic proof of pending status. Actual observed message metadata/own identity drives Pending. Native Web search jitni history expose/index karta hai utni hi available hai. Agar WhatsApp “See more chat history on the app” dikhaye, us absent phone-only history ko extension retrieve nahi kar sakta. Full-account archive nahi banta.

Search open hone par existing automation guards schedule/auto reply ko pause karte hain. Automation resume karne ke liye **All chats** par aayein aur composer/manual search clear rakhein. Agar aap extension query edit karte hain, naya query aapka hai; woh delete nahi kiya jaayega.

## Reply tak Pending

- **Pending (N)** same asli chat list mein indexed, observed own mentions dikhata hai; group aur normal chat dono included hain.
- Chat open/read karne se tag clear nahi hota. Us conversation mein aapka outgoing reply observed hone par pending tag clear hota hai. Baad mein naya incoming own tag aaye to woh phir pending hota hai.
- Quote ke andar purana tag, kisi aur ka @tag, plain number/link/email ko own pending tag nahi banaya jaata. Native own-tag attributes, full/national phone matching aur configured exact name/emoji supported hain, including image-alt emoji.
- Native undated tag bhi pending ho sakta hai jab its identity/order establishes it; ambiguous old history ko fake fresh timestamp nahi diya jaata. Reload ke baad known metadata/bindings retained rehte hain.
- Top Mentions badge **pending observed conversations** hai; All mentions history ka total nahi. Toolbar ka “visible results/chats” loaded viewport count hai. Native search hits contact-directory count mein add nahi hote.
- Kisi never-observed/unloaded conversation ka pending status infer nahi kiya jaata. All mentions se actual result open karne par available native message evidence observe ho sakta hai.

## Screenshot wala TypeScript error

`allowImportingTsExtensions: true` ke saath TypeScript ko `noEmit` ya `emitDeclarationOnly` chahiye. Is source mein `compilerOptions.noEmit: true` add hai. Extension/API/admin production output existing esbuild/Vite build banata hai.

Complete new source use karein; selected old files mix na karein. Run:

```powershell
npm ci
npm run typecheck
npm run build
```

VSCode mein old diagnostic reh jaaye to new folder open karein, **TypeScript: Select TypeScript Version → Use Workspace Version**, phir **TypeScript: Restart TS Server**. Same Chrome card ko updated dist files ke saath Reload karke WhatsApp refresh karein. Full service/update commands **INSTALL_UPDATE.txt** mein hain.

## Other screenshots: saved recipient verification

Latest screenshots mein saved target identity confirmed nahi hai aur Verify open chat checkbox unchecked hai. Display name alone se due send authorize nahi hota.

1. Intended recipient ki CORRECT native chat open karein. Personal contact ko group samajhkar ya group ko personal samajhkar verify na karein.
2. Settings → **Verify open chat**. Opaque IDs hon to uniquely identifiable visible messages aur their native date show karein, correct chat/type review karein, confirmation checkbox tick karein aur verify karein.
3. `verifiedCurrent` confirm karein. Saved name/markers changed ya old markers unloaded hon to one-time revalidation needed ho sakti hai. Target lookup actual saved native identity/markers match hone ke baad hi job claim karta hai; guard bypass nahi kiya gaya.
4. New future test schedule save karke doosri chat open kar sakte hain. Foreground WhatsApp, API/worker running, empty composer/search required hain. Unknown/Failed old jobs retry karne se pehle actual outgoing check karein; already delivered message dobara queue na karein.

Report mein parsed latest message May ka aur observation October ka hai. Agar fresh incoming old samjha jaaye to **Date format** ko actual WhatsApp full-date text se compare karein: `05/10/2026` DMY mein 5 October; `10/5/2026` MDY mein 5 October. Screenshot filename se native date order decide na karein. Saved DMY/MDY automatically change nahi hota. A native Today/Yesterday/weekday can resolve an ambiguous date only when it exactly proves the alternate numeric interpretation. Read AUTOMATION_FIX_GUIDE.md for this release.

220 automated behavioral checks aur fresh install/build passed. Ye controlled fixtures hain; installed Windows portal ke current selectors aur actual delivery ki manual acceptance alag hai. Is update ki testing mein real contact ko message ya payment nahi bheja gaya.
