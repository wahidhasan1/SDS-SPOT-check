# Putting Pantora online for a private test

This guide puts Pantora online as a **private website** on [Render](https://render.com), with HTTPS, a permanent SQLite database, and an access code so only your testers can open it. It stays a website: nothing here turns it into a mobile app.

Nothing goes online until you create the service in Render yourself (step 3).

## What you get

- A private address like `https://pantora-test.onrender.com`, with HTTPS set up automatically.
- An **access code** screen in front of every page and API call. Search engines are told not to index the site.
- The SQLite database saved on a **1 GB persistent disk** at `/var/data/pantora.db`. It survives restarts and new deploys, and Render takes a daily snapshot of the disk.
- A health check at `/api/health` that Render uses to confirm the app and database are working.
- The admin area at `/admin` is **locked** unless you enter the admin token.

## Monthly costs (check before you sign up)

Prices below were checked in October 2026 from public listings. Render's pricing page is the final word, so confirm there.

| Item | Cost | Needed? |
| --- | --- | --- |
| Render "Hobby" workspace | $0 / month | Yes |
| Starter web service (512 MB RAM) | about **$7 / month** | Yes. The free plan can't keep a disk, so your data would be erased on every restart. |
| Persistent disk, 1 GB | about **$0.25 / month** | Yes |
| **Hosting total** | **about $7.25 / month** | Billed per second, so deleting the service stops the charge. |
| Claude API (AI feedback) | Pay per use, see below | Optional |
| Custom domain | Your registrar's price (about $10–15 / year) | Optional. The free `onrender.com` address works fine for a test. |

**AI feedback (optional).** Without an `ANTHROPIC_API_KEY`, Pantora uses its free rule-based demo analyzer. With a key, feedback comes from Claude and you pay Anthropic per use. With the default model (Claude Opus 5.5, $4 per million input tokens and $20 per million output tokens), one analysis is roughly **$0.03–0.06**. That's an estimate: the real number depends on answer length. Pantora caches the demo opponent's analysis, so a battle costs about one analysis, not two.

For example, 10 testers doing 20 AI-scored activities each is about **$6–12** in total. Set a monthly spend limit in the Anthropic Console so it can't run over. To spend less, set `PANTORA_AI_MODEL` to `claude-sonnet-5-5` (about half the price) or `claude-haiku-5-5` (much cheaper, simpler feedback).

## Before you start

You need:

1. A Render account (sign up with GitHub at render.com) and a payment card.
2. Access to the GitHub repository `wahidhasan1/SDS-SPOT-check`.
3. An **access code** for your testers. Make it at least 3 words or 12 characters, for example `sunny-pencil-river-42`. Don't reuse a real password.
4. Optional: an Anthropic API key from console.anthropic.com.

## Step 1. Check the code is on GitHub

The deploy settings are in `render.yaml` at the top of the repository, and the app is in the `pantora/` folder. They are on the branch `claude/upbeat-maxwell-sqi3wh`. Either deploy from that branch, or merge it into `main` first.

## Step 2. Connect Render to GitHub

1. Sign in at render.com.
2. Open **Account settings → Git providers**. Connect GitHub and allow Render to read the `SDS-SPOT-check` repository. You can limit it to just this one repository.

## Step 3. Create the service (this is the "go online" step)

1. In the Render dashboard, click **New → Blueprint**.
2. Pick the `SDS-SPOT-check` repository and the branch from step 1. Render reads `render.yaml` and shows one web service, `pantora-test`, with a 1 GB disk.
3. Before approving, check the **region**. `render.yaml` uses `oregon` (US West). If your testers are elsewhere, edit `region:` in `render.yaml` first. The region can't be changed after creation. Options include `oregon`, `ohio`, `virginia`, `frankfurt` and `singapore`.
4. Render asks for the secret values. **These are your secret keys; enter them here, never in the code:**
   - `PANTORA_ACCESS_CODE`: the access code you chose.
   - `ANTHROPIC_API_KEY`: your key, or leave it empty to use the free demo analyzer.
5. Click **Apply**. Render builds the app (about 3–5 minutes) and starts it.

`PANTORA_ADMIN_TOKEN` is generated automatically. To see it, open the service → **Environment** → reveal the value. Keep it private.

### If you'd rather click through it by hand

Choose **New → Web Service** instead and enter:

| Setting | Value |
| --- | --- |
| Root directory | `pantora` |
| Runtime | Node |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Instance type | Starter |
| Health check path | `/api/health` |
| Auto-deploy | Off |

Then:

- Under **Disks**, add a disk with mount path `/var/data` and size 1 GB.
- Under **Environment**, add these variables:
  - `NODE_VERSION` = `22`
  - `PANTORA_DB_PATH` = `/var/data/pantora.db`
  - `PANTORA_DEMO_MODE` = `true`
  - `PANTORA_ACCESS_CODE` = your code
  - `PANTORA_ADMIN_TOKEN` = a long random string
  - `ANTHROPIC_API_KEY` = your key (optional)

## Step 4. Check it from your computer

When the dashboard says **Live**, copy the address (`https://pantora-test-xxxx.onrender.com`) and check:

1. `https://…/api/health` shows `{"status":"ok","database":"ok"}`.
2. Opening the main address shows the **Private test** screen with the padlock, not the app.
3. A wrong code shows "That code isn't right". The correct code lets you in.

## Step 5. Check it from your phone

1. On your phone, open the address in **Chrome** (Android) or **Safari** (iPhone). The address bar should show a padlock, which means HTTPS.
2. Enter the access code.
3. Create a profile through onboarding. Ask each tester to make their own profile. **"Explore the demo account" is one shared account**, so testers using it would see each other's activity.
4. Play a **Quick Fire** battle and choose **Record my voice**. Allow the microphone when asked. The microphone only works on HTTPS, so this confirms it. Live captions work in Chrome. On Safari, type what you said in the box under the recording.
5. Close the browser, open the address again, and check your XP and history are still there.
6. In Render, click **Manual Deploy → Deploy latest commit**. After it finishes, check again that your history is still there. That proves the disk is working.
7. Optional: in Chrome's menu choose **Add to Home screen** for an app-like icon. It's still the website.

## Sharing it with testers

Send testers the address and the access code **in separate messages**. To lock everyone out, change `PANTORA_ACCESS_CODE` in Render's **Environment** tab and save. Render restarts the app, and every tester has to enter the new code.

## Good to know during the test

- **Profiles live in a browser cookie.** There's no password sign-in yet. If a tester clears their browser data or switches devices, they start over with a new profile.
- **Short downtime on deploys.** A service with a disk stops for a few seconds while a new version starts. It's also limited to one instance, which is plenty for a test.
- **Backups.** Render snapshots the disk daily. To keep your own copy, open the service's **Shell** tab and download `/var/data/pantora.db`, or ask for a backup script before the test grows.
- **Reset test data.** Open `/admin`, enter the admin token, and use **Reset demo data**. This deletes all testers' data, so use it carefully.
- **Live calls between real people stay off** (`PANTORA_LIVE_MATCHING=false`). For real-world calls they need a TURN relay service, which costs extra.
- **Stopping the test.** Suspend the service in Render's settings to stop compute charges (the disk is still billed), or delete the service and its disk to stop all charges. Deleting erases the data, so download a copy first.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Build fails with "node:sqlite" or a Node version error | Make sure `NODE_VERSION` is `22`. Pantora needs Node 22.13 or newer. |
| Health check fails | Check that `PANTORA_DB_PATH` is `/var/data/pantora.db` and the disk is mounted at `/var/data`. |
| Data disappears after a deploy | The disk isn't attached, or `PANTORA_DB_PATH` points somewhere else. |
| "Set PANTORA_ADMIN_TOKEN" on `/admin` | Add `PANTORA_ADMIN_TOKEN` in the Environment tab. |
| Microphone button does nothing | Use the `https://` address, and allow the microphone in the browser's site settings. |
| The access-code screen keeps coming back | The browser is blocking cookies. Allow cookies for the site, or turn off private browsing. |
