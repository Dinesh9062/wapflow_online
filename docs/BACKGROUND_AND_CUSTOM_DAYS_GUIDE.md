# Background sending aur Custom days — 1.4.12

## Latest screenshots aur root cause

6 October ke `image(20261006-103907).png` mein logged-in WhatsApp, active automation aur native outgoing messages dikhte hain. `image(20261006-103949).png` mein aap doosre Chrome profile ke Gmail window par kaam kar rahe hain. Ye screenshots background failure ka internal error prove nahi karte; source review mein actual blocker mila: TARGET readiness aur incoming-target observation ko visible + focused document chahiye tha. Chrome worker ki queue chalti thi, lekin hidden/unfocused WhatsApp ko eligible nahi maana jaata tha.

1.4.12 mein **Background sending default ON** hai. Foreground/focus guard enabled background sending ko nahi rokta. Native target identity, exact message body, draft/search preservation, live incoming freshness, owner/account label, entitlement, exclusions aur server timing checks barkarar hain. Browser/window focus change nahi kiya jaata.

## Kya support hai

| Situation | Behavior |
|---|---|
| Same Chrome profile mein Gmail/another tab saamne hai, WhatsApp tab still open/logged in | Schedule, linked reminder aur fresh matching Auto Reply background mein process ho sakte hain |
| Aap doosre Chrome profile, browser ya app par kaam kar rahe hain; original WhatsApp profile/window running hai | Original profile ki extension apna WhatsApp tab process karegi; aapke active browser/window ka focus nahi badlega |
| Recipient ki chat ke bajaye another WhatsApp chat open hai | Saved verified recipient automatic native search/open se locate hota hai |
| Background sending OFF aur WhatsApp hidden/unfocused hai | Sending/automatic target observation waits; foreground mode remains available |
| Original WhatsApp tab/browser/profile closed, logged out, disconnected, discarded or frozen | Native send possible nahi; schedule/reminder pending with reason. Long-delayed auto replies expire; old incoming automatically replay nahi hota |
| Computer sleeping/offline | Exact due-time send possible nahi; awake/online session required |
| Native draft/manual search present | Sending waits; existing text kept |

## Background setup

1. Complete API/source aur extension **1.4.12** update karein, original `.env`, DB/secrets, account label aur same Chrome extension card preserve karein. Exact PowerShell commands INSTALL_UPDATE.txt mein hain. New schema migration nahi hai.
2. Extension Settings → **Background sending** → “Allow sending while another tab, browser or Chrome profile is in front” checked → Save settings. This is ON for missing older settings too; an explicitly saved OFF is preserved.
3. Original Chrome profile ka logged-in WhatsApp tab open rakhein. Aap doosre window/profile/browser par kaam kar sakte hain. Us doosre profile ki Gmail login se original WhatsApp session move nahi hota.
4. **Chrome Settings → Performance → Always keep these sites active → Add → web.whatsapp.com**. The extension also sets automatic discardability OFF for its connected WhatsApp tab while pending schedules/enabled automation need it. Original discardability is restored when that protection is no longer needed or background sending is disabled. This does not override every kind of browser/OS freezing.
5. Agar Chrome Energy Saver/Windows sleep tab ko suspend kare, suspended reason check karein, original tab resume karein aur desktop ko awake rakhein. Extension frozen/closed tab par lease ya blind send nahi karti. It does not play fake audio or take browser/window focus to bypass browser lifecycle policy.

The service worker's existing 30-second alarm now pulses the connected page: current native rows are scanned, pending fresh incoming work retried and sending queue checked. Hidden pages do not run the heavy 3-second scan loop. Native DOM changes drive target/outgoing confirmation directly, with timers as fallback. Chrome may delay alarms; the saved Auto Reply delay is a minimum, not an exact delivery-second guarantee.

Official references reviewed for this update:

- Chrome tabs API (autoDiscardable, frozen tab behavior): https://developer.chrome.com/docs/extensions/reference/api/tabs
- Chrome alarms (30-second limit, delay and device sleep): https://developer.chrome.com/docs/extensions/reference/api/alarms
- Chrome Performance site exclusion: https://support.google.com/chrome/answer/12929150
- Chrome Energy Saver freezing: https://developer.chrome.com/blog/freezing-on-energy-saver

## Schedule: Custom days

Repeat controls ab alag aur clear hain:

| Repeat option | Meaning |
|---|---|
| None | One authorized send |
| Daily | Same saved local time every day |
| Weekly | Same saved local time every seven calendar days |
| **Every N days** | Existing custom interval: 1–365 days, e.g. every 3 days |
| **Custom weekdays** | Select Sun/Mon/Tue/Wed/Thu/Fri/Sat, e.g. Mon/Wed/Fri |

Create/edit ordinary Schedule → Repeat → Custom weekdays. Seven checkboxes appear. Select at least one, choose a first future date on one of those selected days, check message/recipient/send authorization and Add to queue. Saved card shows the selected day names; Reschedule restores them. Choosing Every N days shows the numeric interval instead. Legacy `repeat: custom` schedules still use their original N-day interval.

First send uses the date you select. Subsequent successful delivery creates exactly one next authorized occurrence on a selected weekday at the saved timezone/wall time. Missed repeats are skipped rather than replayed as a backlog. DST/timezone boundary checks are covered. Global/contact gaps, daily caps and quiet hours can defer a due occurrence. API readiness and final claim keep delayed/overdue messages on selected weekdays; an off-day occurrence waits for the next selected saved local time.

Linked follow-up **Send reminder remains one-time**. Completing a recurring private follow-up creates its next private task; each occurrence needs its own WhatsApp reminder authorization. Ordinary Schedule supports repeated authorized messages. Sending a reminder does not mark a private task Done.

## Controlled acceptance on your Windows profile

With one known consenting contact: verify once, create an authorized schedule or linked reminder, leave WhatsApp open, switch to the other profile/Gmail or another browser, keep composer/search empty, then inspect native outgoing and Sent. The active Gmail/browser window should stay in front. Repeat with a fresh Contact auto rule (Enabled + master Resume), NEW incoming after setup and available quotas. Inspect Last incoming check, Recent auto replies and exact wait reason.

Use one ordinary custom-weekday schedule to confirm seven choices, first-date validation, saved day names and Reschedule retention. Do not create repeated test messages just to bypass quotas. Unknown delivery needs native chat review before any separately confirmed new message.

All validation evidence is in QA_REPORT.md. These controlled tests do not certify live Windows selectors or OS notification timing. No real contact message/payment was sent during this update.
