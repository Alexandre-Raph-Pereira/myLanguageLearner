# CLAUDE.md — myLanguageLearner

Personal language-learning PWA (Korean first; French/English later, max 3 languages).
Single user today (the owner), owner's AI key only. Hosted on Vercel, installed on a phone as a PWA. Online only (no offline mode).

Read these before any work:
1. `docs/VISION.md` — what the app is and every product decision already made.
2. `docs/plans/README.md` — plan order and how to execute a plan.
3. The plan you were asked to implement (`docs/plans/NN-*.md`).
4. `docs/DECISIONS.md` — decisions taken during implementation (append-only).

## Stack (fixed — do not swap without a logged decision)
- **Next.js (latest stable, App Router) + TypeScript strict**, package manager **pnpm**
- **Tailwind CSS + shadcn/ui** (Drawer = vaul bottom sheet on mobile, Sheet on desktop)
- **Postgres on Supabase**, **Drizzle ORM** + drizzle-kit migrations (`db/migrations`)
- **Supabase Auth** via `@supabase/ssr`, restricted to `ALLOWED_EMAILS`
- **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`) + **zod** schemas
- **TanStack Query** for client data caching
- **Vitest** (unit/integration, DB tests on **PGlite**), **Playwright** (e2e smoke, with `AI_MOCK=1`)
- `papaparse` (CSV/TSV), `react-markdown` (lesson rendering), `recharts` (stats)

## Commands
```
pnpm dev            # local dev
pnpm build          # production build (must pass before a plan is "done")
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm test:e2e       # playwright (AI_MOCK=1)
pnpm db:generate    # drizzle-kit generate (after schema changes)
pnpm db:migrate     # apply migrations to DATABASE_URL
```

## Layout
```
app/                    routes (App Router). Route handlers in app/api/**
components/             UI components (components/ui = shadcn)
db/schema/*.ts          Drizzle tables (one file per domain)
db/migrations/          generated SQL — never hand-edit applied migrations
lib/ai/                 THE ONLY place that talks to model providers
lib/words|grammar|tests|exams|align/   domain logic (pure functions where possible)
lib/text/               Korean/text normalization helpers
tests/                  vitest helpers, fixtures (tests/fixtures/ai/*.json)
e2e/                    playwright specs
docs/                   vision, plans, decisions
```

## Rules
- **Every DB query is scoped by `userId`** obtained from `requireUser()` (lib/auth). No query without it.
- **All AI calls go through `lib/ai/run.ts`** (`aiObject` / `aiText`). Never import a provider SDK elsewhere. This is what enforces budgets and logs cost.
- **Every AI output is validated with a zod schema.** Never trust raw model JSON.
- **Korean text:** always `normalize('NFC')` before storing or comparing (helpers in `lib/text`). Inputs that accept Korean must ignore Enter while `event.nativeEvent.isComposing` is true (IME), otherwise answers get submitted twice / truncated.
- `language` column on every content table (`'ko' | 'fr' | 'en'`). Only `'ko'` is enabled in the UI for now, but never hardcode Korean in data logic.
- Server-only modules start with `import 'server-only'`.
- Mobile first: design for 375px width, then desktop.
- **Secrets:** the repo is PUBLIC. Never commit `.env*` (only `.env.example`). Never log API keys.
- Use the AI SDK API of the **installed version** (check `node_modules/ai` docs/types; e.g. `generateObject` vs `generateText({ output })` differ between majors).

## AI mock mode
`AI_MOCK=1` makes `lib/ai/providers.ts` return mock models (from `ai/test`) that answer from fixtures in `tests/fixtures/ai/<task>.json`. Unit tests, e2e tests and cloud sessions without an API key must work in this mode. When you add a new AI task, add a fixture for it.

## Working autonomously on a plan
- Work task by task, in plan order. After each task: `pnpm lint && pnpm typecheck && pnpm test`, then commit (`feat(words): ...`, `fix: ...`, conventional commits) and tick the task's checkbox in the plan file.
- **Do not stop to ask questions.** If something is ambiguous, pick the default stated in the plan (or the simplest option consistent with VISION.md), append an entry to `docs/DECISIONS.md`, and continue.
- If a step needs a human (create Supabase project, set Vercel env, paste a key, provide a file), add it to `docs/HUMAN_TODO.md` with exact instructions, stub/mock around it, and continue.
- Do not start the next plan unless asked.
- Keep files small and cohesive; prefer pure functions + unit tests for logic (scheduling, selection, grading, normalization, budgets, plan building, alignment).
