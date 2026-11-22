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

- [ ] Repo is public — consider making it private; never commit `.env*` (only `.env.example`).

## Plan 00c — Progress & motivation

- [ ] **Apply migration 0002** — with `DATABASE_URL` pointing at Supabase, run `pnpm db:migrate` (adds `activity_events`, `daily_progress`, `milestones_earned` and the goal / timezone / motivation columns).
- [ ] **Check Home and Settings on the phone** — open the deployment once in the phone's browser so the timezone is detected (Settings → Daily goal shows it), set your daily goal, and compare Home / Settings with the canvas in light and dark mode. Locally, `pnpm db:seed` fills 30 days of sample activity for the dev user (do **not** run it against production: it would add sample points to your real account).
- [ ] **Local e2e on WSL/Ubuntu** (optional) — Playwright's Chromium needs `libnspr4`, `libnss3` and `libasound2t64`: `sudo pnpm exec playwright install-deps chromium` (or `sudo apt install libnspr4 libnss3 libasound2t64`).
