# Plan 00 — Foundation

**Goal:** a deployable, installable, login-protected Next.js PWA with the database, the budget-enforcing AI layer, the settings page (including the target TOPIK level) and the app shell that every later plan builds on.

**Depends on:** nothing. Repo currently contains only README.md and .gitignore.

---

## Data model (Drizzle, `db/schema/core.ts`)

`user_settings`
- `user_id` uuid PK (Supabase auth user id)
- `native_language` text default `'en'`
- `active_language` text default `'ko'`
- `ai_provider` text null (null → env `AI_PROVIDER`)
- `ai_model_smart` text null, `ai_model_fast` text null (null → env)
- `budget_per_request_usd` numeric(10,4) default `0.50`
- `budget_monthly_usd` numeric(10,2) default `10.00`
- `created_at`, `updated_at` timestamptz

`language_profiles`
- PK (`user_id`, `language`)
- `exam` text default `'TOPIK'` (for `ko`)
- `target_level` smallint null (TOPIK 1–6)
- `created_at`, `updated_at`

`model_pricing`
- `model_id` text PK
- `input_per_mtok`, `output_per_mtok` numeric(10,4); `cache_read_per_mtok` numeric(10,4) null
- `updated_at`
- Seed one row for the default model with values **to be verified by the owner** (Settings shows "verify prices" banner until the row has been saved once from the UI → `verified` boolean column default false).

`ai_usage`
- `id` uuid PK, `user_id`, `operation_id` uuid, `task` text (e.g. `words.photo_extract`)
- `provider`, `model`
- `input_tokens`, `output_tokens`, `cached_input_tokens` int
- `estimated_cost_usd`, `cost_usd` numeric(10,6)
- `status` text: `ok | error | blocked`
- `error` text null, `created_at`
- index (`user_id`, `created_at`)

Constants `lib/languages.ts`: `SUPPORTED_LANGUAGES = ['ko','fr','en'] as const`, `ENABLED_LANGUAGES = ['ko']`, labels.

---

## Tasks

### [x] T1 — Scaffold
- `create-next-app` (TS, App Router, Tailwind, ESLint, `@/*` alias), pnpm. Add Prettier, shadcn/ui init (button, input, card, dialog, drawer, sheet, select, checkbox, tabs, table, toast/sonner, badge, progress, textarea, form).
- Vitest configured (jsdom for components, node for lib), Playwright installed with one placeholder spec.
- Scripts listed in CLAUDE.md.
- Copy `CLAUDE.md` and `docs/` (already in repo) untouched.
- **Accept:** `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` pass.

### [x] T2 — Environment
- `lib/env.ts`: zod-validated, **lazy** getters (so tests/builds don't crash when unset). Variables:
  `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAILS` (comma list), `AI_PROVIDER` (`anthropic|openai|google`, default anthropic), `AI_MODEL_SMART`, `AI_MODEL_FAST` (default `claude-sonnet-5-5`), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` (optional), `AI_MOCK` (`1` = mock).
- `.env.example` with every variable and a comment. Ensure `.gitignore` covers `.env*` except `.env.example`.
- **Accept:** missing var produces a clear error only when used.

### [x] T3 — Database
- Drizzle + `postgres` driver (`prepare: false` — required for Supabase transaction pooler). `db/index.ts` exports `db`.
- Schema above, first migration generated.
- Test helper `tests/db.ts`: creates a fresh **PGlite** instance, runs migrations, returns a drizzle client; used by every DB test.
- Seed script `pnpm db:seed` (dev only): settings row for a dev user, pricing row.
- **Accept:** a vitest test inserts/reads `user_settings` on PGlite.

### [x] T4 — Auth
- Supabase Auth with `@supabase/ssr`: email **magic link** login page `/login`, callback route `/auth/callback`, sign-out.
- `middleware.ts`: refresh session; unauthenticated → `/login` (except `/login`, `/auth/*`, manifest, icons, static).
- After callback, if the email is not in `ALLOWED_EMAILS` → sign out + error message.
- `lib/auth.ts`: `requireUser()` (server) returns `{ id, email }` or redirects/throws 401 for route handlers. On first call, upsert `user_settings` and the `ko` `language_profiles` row.
- Dev convenience: when `NODE_ENV !== 'production'` and `DEV_USER_ID` is set, `requireUser()` returns that user (lets cloud sessions/e2e run without Supabase). Never active in production.
- **Accept:** protected page redirects when logged out; dev bypass works in tests.

### [x] T5 — AI layer (`lib/ai/`)
Files:
- `providers.ts` — `getModel(tier: 'smart'|'fast', settings)` → AI SDK `LanguageModel` for the configured provider/model. When `AI_MOCK=1`, return a mock model (`ai/test`) that reads `tests/fixtures/ai/<task>.json` (pick by task name; support an array of responses served in order).
- `pricing.ts` — `getPricing(modelId)`; `costOf(usage, pricing)`.
- `estimate.ts` — `estimateInputTokens({ text, images })`: Hangul/CJK chars ×1.0 + other chars ÷3.5 + 1,600 per image (document it as a rough upper-biased estimate). `estimateCost(inputTokens, maxOutputTokens, pricing)` = upper bound.
- `budget.ts` — `createOperation(userId, label)` returns `{ id, spentEstimate, spentActual }`. `assertBudget(op, estimate)`: throws `BudgetError` if `op.spent + estimate > per-request cap` or `monthSpent + estimate > monthly cap` (month = calendar month UTC, from `ai_usage.cost_usd`).
- `run.ts` —
  ```ts
  aiObject<T>({ userId, operation, task, tier, schema, system, prompt | messages, images?, maxOutputTokens, cacheSystem? }): Promise<T>
  aiText(...)   // same, returns string (used for AI grading feedback)
  ```
  Steps: load settings → pricing (missing pricing → `BudgetError('no pricing for model X')`) → estimate → assertBudget → call AI SDK structured-output API with `maxOutputTokens` → on schema failure retry once with the validation error appended → log `ai_usage` (ok/error/blocked) with real usage → return. `cacheSystem: true` sets Anthropic prompt-caching provider option on the system message (ignored for other providers).
- `errors.ts` — `BudgetError`, `AiError` with user-friendly messages; a shared `<AiErrorMessage>` component shows them (budget errors link to Settings).
- `prompts/` folder (empty index) — every later prompt lives here.
- **Accept:** unit tests with mock model: budget blocks over per-request cap, over monthly cap, logs usage, retries once on invalid JSON, mock mode reads fixtures.

### [x] T6 — App shell & Settings
- Layout: mobile bottom nav (Home, Words, Grammar, Tests, Settings), desktop left sidebar. Language indicator (Korean only now).
- `/` Home: placeholder cards (Word test, Grammar test, TOPIK test, "resume unfinished test" slot).
- `/tests`: hub page with three entries (disabled until their plan ships).
- `/settings`:
  - Language profile: **target TOPIK level 1–6** (with "TOPIK I: 1–2, TOPIK II: 3–6" helper text).
  - AI: provider, smart model, fast model (text inputs, defaults from env shown as placeholders).
  - Pricing table for the configured models (editable; saving sets `verified`).
  - Budgets: per request, monthly; **spent this month** + last 20 `ai_usage` rows.
- Server actions validated with zod.
- **Accept:** settings persist; e2e smoke: open settings, change level, reload, value kept.

### [ ] T7 — PWA
- `app/manifest.ts` (name, short_name "LangLearner", `display: standalone`, theme/background colors, start_url `/`), icons 192/512 + maskable + `apple-touch-icon`, iOS meta (`apple-mobile-web-app-capable`, status bar style), viewport with `viewport-fit=cover` and safe-area padding for the bottom nav.
- No offline service worker (decided: online only).
- Placeholder icons generated by a small script; owner may replace later.
- **Accept:** manifest served; Lighthouse "installable" check passes on the Vercel preview (human check → HUMAN_TODO).

### [ ] T8 — CI
- `.github/workflows/ci.yml`: pnpm install, lint, typecheck, test (AI_MOCK=1), build (with dummy env).
- **Accept:** workflow file valid; passes locally via the same commands.

---

## Human steps (add to `docs/HUMAN_TODO.md`)
1. Create a Supabase project. Copy project URL + anon key; enable Email auth (magic link); add redirect URLs `http://localhost:3000/auth/callback` and `https://<vercel-domain>/auth/callback`.
2. Database connection string: Supabase → Connect → **Transaction pooler** (port 6543) → `DATABASE_URL`.
3. Create the Vercel project from the GitHub repo; set all env vars (Production + Preview). Add `ANTHROPIC_API_KEY`.
4. Run `pnpm db:migrate` against Supabase (or let a Vercel build step do it — default: manual).
5. Verify model prices in Settings.
6. Consider making the GitHub repo private (it is public).

## Definition of Done
- All tasks ticked; lint/typecheck/test/build green; AI layer fully covered by mock tests.
- With env set, the owner can log in on the phone, install the PWA, and change settings.
