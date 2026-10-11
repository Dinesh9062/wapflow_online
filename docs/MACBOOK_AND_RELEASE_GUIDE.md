# Wapflow Connect 1.4.13 — MacBook and existing EC2 update

## Findings and fixes

The Mac heartbeat exposes opaque IDs, an unverified recipient and a broad dated envelope containing fourteen bodies. The parser now isolates single-message bodies, keeps nested opaque markers, uses that message's own direction/time evidence and accepts Unicode/dotted AM/PM clocks. Ongoing native mutations cannot keep postponing scans. Native filters reuse unchanged toolbars/patches, honor nested scrolling and reapply after WhatsApp changes row styles.

The separately supplied JSON has `autoPaused: true`, no enabled rules or verified bindings, no open-chat snapshot and no queued schedule/linked reminder. Those are configuration/observation blockers; that snapshot alone does not establish a scheduler failure. `sendButton: false` with an empty composer is normal. Zero serialized message IDs can also be normal after explicit opaque/visible verification.

No actual MacBook browser was available for acceptance. Screenshots were inspected; fixtures reproduce the reported DOM shapes. Check the real Mac profile using the steps below. No actual contact message or payment was sent during these tests.

## Packages

- Source ZIP: `Wapflow_Connect_Extension_Source_v1_4_13.zip`; root `Wapflow-Connect`; full source, built API/admin/extension, demo, tests, docs and logo assets.
- Chrome ZIP: `Wapflow_Connect_Chrome_Production_v1_4_13.zip`; `manifest.json` at root; compiled API `https://api.wapflow.online`.

Extract the Chrome ZIP, replace ALL files in the SAME existing loaded folder, Reload the SAME card at `chrome://extensions`, disable duplicates and refresh WhatsApp. First install uses Developer mode > Load unpacked > extracted folder containing `manifest.json`. Keep profile/storage; a new folder/card can change local extension identity and require verification again. Target: Chrome 120+, Windows/Mac; not Safari or WhatsApp Desktop.

Logos: `apps/extension/assets/wapflow-icon.svg`, `wapflow-logo.svg`, PNG icons and shared React mark. Internal `@zfleet/*` workspace names, DOM attributes and storage keys remain for compatibility.

## EC2 — preserve existing data

Project: `/home/ubuntu/wapflow_online`. Existing PM2 API/worker, PostgreSQL/Redis, API/admin DNS, Nginx and TLS can stay. This release has NOT been installed on your EC2 by this work. Run commands individually and stop if one fails.

Upload Source ZIP from Windows PowerShell, using the already-trusted hostname:

```powershell
scp -i "C:\Users\dines\Downloads\wapflow-key.pem" "$env:USERPROFILE\Downloads\Wapflow_Connect_Extension_Source_v1_4_13.zip" ubuntu@ec2-65-0-243-52.ap-south-1.compute.amazonaws.com:~/
```

In EC2 SSH, back up first:

```bash
cd ~/wapflow_online
WAPFLOW_BACKUP="$HOME/wapflow-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$WAPFLOW_BACKUP"
chmod 700 "$WAPFLOW_BACKUP"
cp -p .env "$WAPFLOW_BACKUP/.env"
sudo -u postgres pg_dump zfleet_connect > "$WAPFLOW_BACKUP/database.sql"
chmod 600 "$WAPFLOW_BACKUP/database.sql"
tar --exclude=node_modules --exclude=.env --exclude=.git -czf "$WAPFLOW_BACKUP/source.tar.gz" .
```

Check backups succeeded, especially `pg_dump`. Extract, stop app services, and copy all source while preserving `.env` and `.git`:

```bash
sudo apt install -y rsync
WAPFLOW_RELEASE_DIR=$(mktemp -d /home/ubuntu/wapflow-release-1.4.13.XXXXXX)
unzip -q ~/Wapflow_Connect_Extension_Source_v1_4_13.zip -d "$WAPFLOW_RELEASE_DIR"
test -f "$WAPFLOW_RELEASE_DIR/Wapflow-Connect/package.json"
pm2 stop wapflow-api wapflow-worker
rsync -a --exclude=.env --exclude=.env.local --exclude=.git --exclude=node_modules "$WAPFLOW_RELEASE_DIR/Wapflow-Connect/" /home/ubuntu/wapflow_online/
cd /home/ubuntu/wapflow_online
npm ci
npm run db:generate
npm run db:migrate
npm run check:setup
npm run typecheck
WAPFLOW_API_ORIGIN=https://api.wapflow.online VITE_API_ORIGIN=https://api.wapflow.online npm run build
```

No new migration in 1.4.13. Do not run `migrate reset`, replace `.env`, regenerate encryption/JWT keys or seed a demo. Your existing Node 24 and PM2 entry points remain compatible. If installation/build fails, keep services stopped, correct the error or restore the source backup and reinstall its dependencies before restarting.

After successful checks/build:

```bash
sudo rsync -a --delete apps/admin/dist/ /var/www/wapflow-admin/
pm2 restart wapflow-api wapflow-worker
pm2 save
pm2 logs --lines 30 --nostream
curl --fail --show-error https://api.wapflow.online/health
curl -I https://admin.wapflow.online
```

Health and extension server version should be `1.4.13`. Refresh admin to see the new branding. Your existing certificate does not need reinstalling. For admin access, create the production account in the extension first, then `npm run admin:grant -- your-account@email.com`, sign out/in of admin. Grant does not create an account/password.

## GitHub

Copy all new source into the existing Windows Git checkout, keeping its `.git` and original `.env`. Keeping the existing folder name is fine. Inspect staged filenames; never publish `.env`, keys, backups or private reports.

```powershell
git status --short
git check-ignore .env
npm ci
npm run typecheck
git add .
git diff --cached --stat
git commit -m "Wapflow Connect 1.4.13: Mac DOM fixes and branding"
git push origin main
```

Do not mix individual old/new files. Workspace commands still use `@zfleet/extension`, `@zfleet/admin`, `@zfleet/api`, `@zfleet/worker`.

## Mac setup and acceptance

1. Sign in to Wapflow. On EACH profile/device open the uniquely named intended chat once; keep a dated message visible. Settings or schedule editor > Individual/Group > tick intended-recipient confirmation > Verify open chat. A Windows binding does not verify a new Mac Chrome profile. Duplicate names or conflicting markers block automation.
2. Settings > your own WhatsApp number with country code, **Your mention name** = exact @name/emoji, correct timezone/date order; Save. Mentions > All mentions uses native history search. Pending retains observed tags until a later outgoing reply. Reading does not clear pending. Historical pending counts depend on observed/indexed evidence.
3. **Awaiting Reply shows**: Their reply pending (your last outgoing message) is the default and older behavior. Choose My reply pending for last incoming messages you have not answered. Grace delays eligibility; use 1 minute for a controlled check and wait that minute. Check last direction/time in diagnostics. Unread count is not reply state; chats without observed direction evidence cannot be reliably classified until observed.
4. Auto Reply > Contact specific > tick this verified recipient > response > active days/All day > Enable > Save. Master must say **Auto replies on**. Request a NEW incoming AFTER setup. First incoming conversation does not mean every message from an existing contact. Selected groups require Allow selected groups; exclusions still block. Read Last incoming check / Recent auto replies for the actual reason.
5. Queue a schedule a few minutes ahead with authorization; switch to another contact, keep composer/search empty. Check actual outgoing and Sent exactly once for the intended recipient. Read any waiting reason instead of creating duplicate jobs.
6. Follow-up is a private task. Send reminder > future time + send authorization > Add to queue creates a linked outgoing schedule. Check actual message/Sent while another chat is open. The task remains pending until Done. Private task alerts alone are not WhatsApp messages.
7. Background sending ON; this Chrome profile and WhatsApp tab open, logged in, online and awake. Another chat/tab/browser/profile may be in front. Chrome notifications plus macOS Notifications permission are needed for alerts; Focus can hide banners. Test notification does not send a WhatsApp message. Closed/frozen/discarded/sleeping sessions cannot send via this DOM extension; exact due-second timing is not promised.
8. If still failing, download diagnostics with the affected chat OPEN during the failed state. Version, header/composer, parsed direction/time, identity reason, rule status and queue reason matter. Never include `.env`, keys or passwords.

Defaults: 30-second account gap; 10-minute contact gap and 3/contact/day for schedules/reminders; 50 total attempts/day; 10-second auto delay. Auto-rule contact mode uses each rule's contact cooldown/cap. Quiet hours default OFF, saved choices remain. No setting guarantees protection from WhatsApp restrictions. For Failed/Unknown inspect actual WhatsApp before an explicitly confirmed retry.
