# Things that need the owner

Claude Code appends here when a step needs a human (accounts, keys, files, manual checks). Tick when done.

## Plan 00 — Foundation

- [ ] **Supabase project** — create a project at supabase.com (region close to you).
  - Settings → API: copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` and the **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Authentication → Sign In / Providers → **Email**: enabled, "Confirm email" on (magic link works with the default email template).
  - Authentication → URL Configuration: **Site URL** = `https://<your-vercel-domain>`; **Redirect URLs** add `http://localhost:3000/**` and `https://<your-vercel-domain>/**` (`/**` is needed: the app redirects to `/auth/callback?next=…`). For logins on preview deployments add `https://<vercel-project>-*-<team-slug>.vercel.app/**` (preview URLs look like `<project>-<hash>-<team-slug>.vercel.app`).
- [ ] **Database URL** — Supabase → Connect → **Transaction pooler** (port **6543**) → copy the URI (replace `[YOUR-PASSWORD]`) → `DATABASE_URL`. The app already uses `prepare: false`, required by this pooler.
- [ ] **Apply migrations** (manual by default): locally, with `DATABASE_URL` set to the Supabase URL, run `pnpm db:migrate`. Re-run after each plan that adds migrations. This also seeds the placeholder price row for `claude-sonnet-5-5`.
- [ ] **Vercel project** — import the GitHub repo in Vercel (framework: Next.js, install command auto-detected from `packageManager`). Set, for **Production and Preview**:
  `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAILS` (your email), `AI_PROVIDER=anthropic`, `AI_MODEL_SMART=claude-sonnet-5-5`, `AI_MODEL_FAST=claude-sonnet-5-5`, `ANTHROPIC_API_KEY`. Do **not** set `DEV_USER_ID` or `AI_MOCK` there (dev bypass is ignored in production anyway). See `.env.example`.
- [ ] **Local dev** — copy `.env.example` to `.env.local` and fill it. Without Supabase you can run fully locally with `DATABASE_URL=pglite://./.pglite`, `DEV_USER_ID=00000000-0000-4000-8000-000000000001`, `AI_MOCK=1`, then `pnpm db:migrate && pnpm dev`.
- [ ] **Verify model prices** — open Settings → Pricing, check the input / output / cache-read prices (USD per million tokens) against Anthropic's pricing page and press **Save** on each row. The "Verify prices" banner disappears once saved. The migration seeded placeholders ($3 / $15 / $0.30); current Sonnet 5.5 list prices are $2 input / $10 output / $0.10 cache read per MTok — confirm on the pricing page and save.
- [ ] **Install check on the phone** — on the Vercel deployment: log in, then "Add to Home Screen" (iOS Safari) / "Install app" (Android Chrome). Optionally run Chrome DevTools → Lighthouse (or Application → Manifest) on the deployment and confirm the manifest is installable with no errors.
- [ ] **Replace placeholder icons** (optional) — overwrite `public/icons/*.png` and `public/apple-touch-icon.png`, or tweak `scripts/generate-icons.mjs` and run `pnpm icons`.

## Plan 00b — Design system

- [ ] **Compare with the canvas** — open the deployed app on the phone in light and dark mode (Settings → Appearance, or the sun/moon button in the header) and compare Home, Tests, Settings and Login with the Navy & Cream canvas (Claude Design → "myLanguageLearner redesign" → page "Navy & Cream — chosen"), also on a desktop browser (~1280 px). Locally you can run `SCREENSHOTS=1 pnpm test:e2e e2e/screenshots.spec.ts` and look at `test-results/screenshots/`. Note any differences in a new issue or here; the canvas was not available to the implementer, so spacing/wording follow `docs/DESIGN.md` only.
- [ ] **Re-install the PWA** (optional) — the icons and theme colour changed; remove and re-add the home-screen app to pick up the new navy/brass icon.

## All plans

- [ ] **Migrations are automatic** — every Vercel deployment (production and previews) runs `pnpm db:migrate` before building, so future plans need no manual migrate step. Previews share the production database, so a branch's migration is applied as soon as its preview deploys.

- [ ] Repo is public — consider making it private; never commit `.env*` (only `.env.example`).

## Plan 00c — Progress & motivation

- [ ] **Apply migration 0002** — with `DATABASE_URL` pointing at Supabase, run `pnpm db:migrate` (adds `activity_events`, `daily_progress`, `milestones_earned` and the goal / timezone / motivation columns).
- [ ] **Check Home and Settings on the phone** — open the deployment once in the phone's browser so the timezone is detected (Settings → Daily goal shows it), set your daily goal, and compare Home / Settings with the canvas in light and dark mode. Locally, `pnpm db:seed` fills 30 days of sample activity for the dev user (do **not** run it against production: it would add sample points to your real account).
- [ ] **Local e2e on WSL/Ubuntu** (optional) — Playwright's Chromium needs `libnspr4`, `libnss3` and `libasound2t64`: `sudo pnpm exec playwright install-deps chromium` (or `sudo apt install libnspr4 libnss3 libasound2t64`).

## Magic-link login flag

- [ ] **Turn magic-link login off (optional)** — Vercel → Project → Settings → Environment Variables: add `MAGIC_LINK_LOGIN` = `0` for Production (and Preview if wanted), then redeploy. Set it to `1` (or delete it) to turn login back on. Note: magic link is currently the **only** way to sign in — while it is off, only browsers that are already signed in can use the app; sign out and you are locked out until you set it back to `1`.

## No-login mode (until all features are done)
- [ ] Vercel → Project → Settings → Environment Variables (Production): add `NO_LOGIN_USER_ID` = `2dd3bfbe-a490-4cbc-a9c6-92eac7767842` (your own account id, so your data is kept), then redeploy. The app then opens straight on Home.
- [ ] Locally it is already set in `.env.local`; restart `pnpm dev` to pick it up.
- ⚠️ While it is set, **anyone who has the URL** can use the app and spend your AI key (the monthly AI budget in Settings is the only cap). Keep the URL private and keep the budget low.
- [ ] When you want login back: delete `NO_LOGIN_USER_ID` in Vercel and `.env.local` and redeploy.

## Plan 01 — Words

- [ ] **Apply migration 0003** — with `DATABASE_URL` pointing at Supabase, run `pnpm db:migrate` (adds `words`, `test_sessions`, `word_reviews` and the `word_type` / `content_status` / `content_source` enums). Do **not** run `pnpm db:seed` against Supabase (it adds 41 sample words and 30 days of sample points to your account).
- [ ] **Import your Quizlet words** — Quizlet → your set → ⋯ → Export → keep "Tab" between term and definition and "New line" between rows → Copy text. In the app: Words → Import CSV → paste → check the column mapping (Column 1 = Term, Column 2 = Meaning) → Preview → review duplicates / invalid rows → optionally "Suggest types with AI" (shows the cost first) → Import. Alternatively, give the list to Claude in a new session as planned.
- [ ] **Phone check** — on the deployment, take a 25-word EN→KR test with the Korean keyboard: typing 한글 and pressing Enter/Done must commit the syllable without submitting early or twice; check the feedback panel, "I was right", and the results page in light and dark mode.
- [ ] **Photo import check** — Words → Import photo → "Take a photo" of a notebook page; verify the preview against the page before importing (real AI call, costs a few cents per photo with Sonnet).
- [ ] **Local e2e without sudo** (optional, alternative to installing the libs) — `apt-get download libnspr4 libnss3 libasound2t64`, extract each with `dpkg-deb -x <file>.deb ./pwlibs`, then run e2e with `LD_LIBRARY_PATH=$PWD/pwlibs/usr/lib/x86_64-linux-gnu pnpm test:e2e`.

## Plan 02 — Grammar

- [ ] **Migration 0004 (grammar tables)** — now applied automatically by the next Vercel deployment (`vercel.json` runs `pnpm db:migrate` before the build). Check the deployment's build log shows `Migrations applied.` and that `/grammar` opens. If the build fails at the migrate step, check that `DATABASE_URL` exists for that environment (Production / Preview) in Vercel → Settings → Environment Variables. Do **not** run `pnpm db:seed` against Supabase (it adds sample words, points and 3 grammar lessons).
- [ ] **Notebook photo check (Definition of Done, real AI)** — on the deployed app on your phone: Grammar → Add lesson → **From photo** → "Take a photo" of a notebook grammar page → Read. Check the draft against the page, press **Rewrite** with an instruction (e.g. "shorter description"), check **Undo rewrite** works, then **Save**. The lesson must appear in Grammar and its page must be readable in light and dark mode. Each photo / rewrite costs a few cents with Sonnet (the estimate is shown next to each AI button).
- [ ] **Korean keyboard check** — on the phone, type Korean in the variants field and press Enter: the syllable must be committed and added as one form (not cut or added twice).

## Plan 07 — Home server (WSL + Claude Code + Tailscale)

Full step-by-step guide with every command: **`docs/HOME_HOSTING.md`**.

- [x] **Windows prep** (runbook Part A): systemd on in WSL (`/etc/wsl.conf`), PC never sleeps when plugged in.
- [x] **Tools in WSL** (Part B): git, Node 22 (nvm), `corepack enable`, Claude Code installed **and logged in** (`claude -p "hi"` answers, no `ANTHROPIC_API_KEY` in your shell).
- [x] **Local dev** (Part C, optional now): clone to `~/dev/myLanguageLearner`, `.env.local` with `DATABASE_URL=pglite://./.pglite`, `AI_PROVIDER=claude-code`, `pnpm dev -p 3001`.
- [x] **Always-on app** (Part D): clone to `~/apps/myLanguageLearner`, create `.env.production.local` (values from Vercel, `AI_PROVIDER=claude-code`, **no** API key), `pnpm home:install --auto-update`, `pnpm home:deploy` → "Healthy".
- [x] **Keep WSL running** (Part D5): run `scripts/home/windows/keep-wsl-running.ps1` once in PowerShell, `wsl --shutdown`, log off/on, check `/api/health`.
- [x] **Tailscale** (Part E): account, `sudo tailscale up --hostname=langlearner` in WSL, enable MagicDNS + HTTPS certificates, disable key expiry for the machine, `sudo tailscale serve --bg 3000`, Tailscale app on the phone (always-on).
- [x] **Phone check** (Definition of Done): Wi-Fi off, open `https://langlearner.<tailnet>.ts.net`, install the PWA, remove the old Vercel one.
- [x] **Real AI checks** (Part F): Settings → AI shows "Claude Code found"; provider is Default/Claude Code (not "Anthropic API" saved from before); a grammar import from text returns a draft; one words photo import; Settings → Last AI calls shows cost "plan".
- [ ] **Retire Vercel** (plan 07 T9) once you are happy with the home server for a few days: Vercel → Project → Settings → Git → Disconnect (or delete the project). Then ask Claude to finish plan 07 T9 (removes `vercel.json`, updates CLAUDE.md / VISION.md / README). Until then both run against the same Supabase database, which is fine.
