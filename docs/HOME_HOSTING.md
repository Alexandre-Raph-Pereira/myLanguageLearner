# Home hosting runbook (WSL + Claude Code + Tailscale)

The app runs on your Windows PC inside WSL (Ubuntu). AI calls use the Claude Code CLI you
are logged into (your Claude plan, no API key). Your phone reaches the app from anywhere
through **Tailscale**: a private network between your own devices, with HTTPS, and **no port
opened on your router**.

```
phone (Tailscale on) ──HTTPS──▶ https://<pc>.<tailnet>.ts.net
                                   │  tailscale serve (in WSL)
                                   ▼
                       next start on 127.0.0.1:3000  (systemd user service)
                                   │                     │
                                   ▼                     ▼
                       Supabase Postgres (cloud)   claude -p (your plan)
```

Two checkouts, never mixed:

| Folder | Used by | You edit it? |
|---|---|---|
| `~/apps/myLanguageLearner` | the always-on app (`deploy.sh` builds it) | **No**, only `git` via `deploy.sh` |
| `~/dev/myLanguageLearner` | `pnpm dev` while you code | Yes |

They must be separate: `pnpm dev` and `pnpm build` both write the `.next` folder, and
`deploy.sh` refuses to pull over local changes.

Every command below runs in the **Ubuntu (WSL) terminal** unless it says PowerShell.

---

## Part A — One-time Windows preparation

1. **WSL 2 + Ubuntu.** In PowerShell: `wsl -l -v` must list Ubuntu with `VERSION 2`. If not:
   `wsl --install -d Ubuntu`, then reboot.
2. **Turn on systemd in WSL.** In Ubuntu:
   ```bash
   sudo tee /etc/wsl.conf >/dev/null <<'EOF'
   [boot]
   systemd=true
   EOF
   ```
   Then in PowerShell: `wsl --shutdown`, reopen Ubuntu and check `systemctl --user status`
   prints a status (not "Failed to connect to bus").
3. **Never sleep.** Windows Settings → System → Power & battery → Screen, sleep & hibernate
   timeouts → *When plugged in, put my device to sleep after* → **Never**. On a laptop also:
   Control Panel → Power Options → *Choose what closing the lid does* → **Do nothing** (plugged in).
4. **Keep WSL running at logon** (step D5 runs the script once the repo is cloned).
5. **After a Windows reboot** (updates) the app comes back only once you **log in** to Windows
   (the keep-alive task starts at logon). Optional: Windows auto sign-in, if your PC is in a
   safe place.

## Part B — Tools inside WSL (once)

```bash
sudo apt update && sudo apt install -y git curl build-essential
# Node 22 LTS (via nvm)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
exec bash            # reload the shell so nvm is on PATH
nvm install 22
corepack enable      # gives the pnpm version pinned in package.json
node -v && pnpm -v
```

**Claude Code** (skip if `claude --version` already works in WSL):
```bash
curl -fsSL https://claude.ai/install.sh | bash
claude               # log in with your Claude account (Pro/Max), then /exit
```
Check it uses **your plan, not an API key**:
```bash
env | grep -E '^ANTHROPIC_(API_KEY|AUTH_TOKEN)=' || echo "no API key in env: good"
claude -p "Say hi in Korean"          # must answer
```
If a key is printed, remove it from `~/.bashrc` / `~/.profile` (the app strips it anyway, but
your own `claude` runs would bill the API).

## Part C — Local development

```bash
mkdir -p ~/dev && cd ~/dev
git clone https://github.com/Alexandre-Raph-Pereira/myLanguageLearner.git
cd myLanguageLearner
pnpm install
cp .env.example .env.local
```

Edit `.env.local` (`nano .env.local`). For development use a **local** database so you never
touch your real data:
```dotenv
DATABASE_URL=pglite://./.pglite
DEV_USER_ID=00000000-0000-4000-8000-000000000001
AI_PROVIDER=claude-code
AI_MODEL_SMART=sonnet
AI_MODEL_FAST=sonnet
AI_MOCK=0
```
(`AI_MOCK=1` instead answers from test fixtures: free and instant, good for UI work.)

```bash
pnpm db:migrate
pnpm db:seed          # sample words / grammar for the dev user (local DB only!)
pnpm dev -p 3001      # 3001 so it never clashes with the always-on app on 3000
```
Open <http://localhost:3001> in a Windows browser (WSL forwards localhost). Checks before you
push: `pnpm lint && pnpm typecheck && pnpm test` (and `pnpm build`).

Try the dev server on your phone (optional, after Part E): `sudo tailscale serve --bg --https=8443 3001`
→ `https://<pc>.<tailnet>.ts.net:8443`. Remove it with `sudo tailscale serve --https=8443 off`.

## Part D — The always-on app

1. **Clone the deploy checkout:**
   ```bash
   mkdir -p ~/apps && cd ~/apps
   git clone https://github.com/Alexandre-Raph-Pereira/myLanguageLearner.git
   cd myLanguageLearner
   ```
2. **Create `.env.production.local`** (never committed; `nano .env.production.local`). Copy the
   values you have in Vercel → Project → Settings → Environment Variables (Production):
   ```dotenv
   DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-....pooler.supabase.com:6543/postgres
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ALLOWED_EMAILS=you@example.com
   NO_LOGIN_USER_ID=<your Supabase user id, same as on Vercel>
   AI_PROVIDER=claude-code
   AI_MODEL_SMART=sonnet
   AI_MODEL_FAST=sonnet
   ```
   Do **not** put `ANTHROPIC_API_KEY`, `AI_MOCK` or `DEV_USER_ID` there.
   `NO_LOGIN_USER_ID` is safe here because only your Tailscale devices can reach the app.
3. **Install the services** (asks for your sudo password once, for "linger"):
   ```bash
   pnpm home:install --auto-update
   ```
   `--auto-update` deploys `origin/main` within 10 minutes of every push. Leave it out to deploy
   only by hand. Re-run this after moving the folder or reinstalling Node / pnpm / Claude Code.
4. **First deploy:**
   ```bash
   pnpm home:deploy
   ```
   It pulls `main`, installs, applies migrations to Supabase, builds, restarts the service and
   waits for `Healthy: {"ok":true,...,"ai":{"provider":"claude-code","ready":true}}`.
5. **Keep WSL running at logon.** In **PowerShell** (normal, not admin):
   ```powershell
   powershell -ExecutionPolicy Bypass -File "\\wsl$\Ubuntu\home\<your-linux-user>\apps\myLanguageLearner\scripts\home\windows\keep-wsl-running.ps1"
   wsl --shutdown
   ```
   (Add `-Distro "Ubuntu-24.04"` if `wsl -l -v` shows another name.) Then log off and on, open
   nothing, and check from PowerShell: `wsl -d Ubuntu --exec curl -s localhost:3000/api/health`.

## Part E — Tailscale (reach the app from anywhere)

1. **Account:** create a free account at tailscale.com (log in with Google / GitHub / Microsoft).
2. **Install in WSL and connect:**
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --hostname=langlearner
   ```
   Open the printed link, log in, approve the machine.
3. **Admin console** (login.tailscale.com/admin):
   - **DNS** → *MagicDNS* **on**, and *HTTPS Certificates* → **Enable HTTPS**.
   - **Machines** → `langlearner` → ⋯ → **Disable key expiry** (otherwise it disconnects
     every 180 days until you log in again).
4. **Publish the app inside your tailnet:**
   ```bash
   sudo tailscale serve --bg 3000
   tailscale serve status      # shows https://langlearner.<your-tailnet>.ts.net
   ```
   This setting is saved and survives reboots. The first HTTPS request can take ~30 s while
   the certificate is issued.
   (Do **not** use `tailscale funnel`: that would publish the app to the whole internet.)
5. **Phone:** install the **Tailscale** app (App Store / Play Store), log in with the **same
   account**, turn the VPN on. Android: Settings → Network → VPN → Tailscale → *Always-on VPN*.
   iOS: in the Tailscale app enable *VPN On Demand*. Tailscale only routes traffic for your
   tailnet, so the rest of the phone's traffic is unaffected.
6. **Install the app:** on the phone open `https://langlearner.<your-tailnet>.ts.net`, check
   it works on **mobile data** (Wi-Fi off), then *Add to Home Screen* (iOS Safari) / *Install
   app* (Android Chrome). Remove the old Vercel home-screen app.

If Tailscale is **already installed on Windows**, keep using it instead of installing it in
WSL: in PowerShell run `tailscale serve --bg 3000` (WSL forwards Windows' localhost:3000).
Don't run both on the same PC.

## Part F — First checks with real AI

1. Settings → **AI**: Provider = *Default (Claude Code …)* or *Claude Code (this computer, …)*.
   A green line "Claude Code found (…)" must show. If your account had **Anthropic API**
   selected before, change it here: the per-user choice overrides the server default.
2. Settings → AI → *Daily AI calls*: the cap that replaces the dollar budgets (default 150).
3. Grammar → Add a lesson → *From text* → paste a short note → Read. The button shows
   "included in your Claude plan" instead of a price, and a draft appears in a few seconds.
4. Words → Import photo with one notebook page.
5. Settings → *Last AI calls* lists them with provider claude-code and cost "plan".

## Everyday use

- **Ship a change:** merge to `main` on GitHub. With auto-update it is live within 10 minutes;
  otherwise in `~/apps/myLanguageLearner` run `pnpm home:deploy`.
- **Logs:** `journalctl --user -u mylanguagelearner -f` (app),
  `journalctl --user -u mylanguagelearner-update -n 50` (auto-update).
- **Restart:** `systemctl --user restart mylanguagelearner`.
- **Health:** `curl -s localhost:3000/api/health` (or the tailnet URL + `/api/health` on the phone).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Phone can't open the URL | Tailscale VPN on in the phone? `tailscale status` in WSL shows both devices? PC awake and logged in? |
| `/api/health` → `"db":"error"` | `DATABASE_URL` in `.env.production.local`; Supabase project paused (free tier pauses after a week idle — open the Supabase dashboard to resume). |
| `"ai":{"ready":false}` / "not installed" | `claude` not on the service PATH: re-run `pnpm home:install` (it records where `claude` is), then `systemctl --user restart mylanguagelearner`. |
| "Claude Code is not logged in" | Run `claude` in WSL, log in again, `/exit`. |
| "usage limit is reached" | Your Claude plan's window is used up (shared with your coding sessions). Wait, or temporarily switch Settings → AI → Anthropic API with a key. |
| "Daily AI call limit reached" | Raise Settings → AI → Daily AI calls. |
| Deploy says "uncommitted changes" | Someone edited `~/apps/...`: `git status`, then `git stash` or `git checkout -- .` there. Code in `~/dev/...`. |
| Nothing runs after a reboot | Log in to Windows; check Task Scheduler → *myLanguageLearner - keep WSL running* ran; `systemctl --user status mylanguagelearner`. |
| `systemctl --user` fails | systemd not on: redo Part A step 2. |

## Fallback: API key

If Claude Code can't be used for a while: add `ANTHROPIC_API_KEY=...` to
`.env.production.local`, `systemctl --user restart mylanguagelearner`, then Settings → AI →
Provider *Anthropic API* (and check Settings → Pricing / Budgets). Switch back the same way.
