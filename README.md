# myLanguageLearner

Personal language-learning PWA (Korean first): word bank, grammar library and AI-generated TOPIK practice. Next.js + Supabase + Drizzle + Vercel AI SDK, deployed on Vercel and installed on a phone.

- Product decisions: [`docs/VISION.md`](docs/VISION.md)
- Implementation plans: [`docs/plans/`](docs/plans/README.md)
- Owner setup steps: [`docs/HUMAN_TODO.md`](docs/HUMAN_TODO.md)

## Quick start (no accounts needed)

```bash
pnpm install
cp .env.example .env.local   # then set the dev-only values below
# DATABASE_URL=pglite://./.pglite
# DEV_USER_ID=00000000-0000-4000-8000-000000000001
# AI_MOCK=1
pnpm db:migrate
pnpm dev
```

## Commands

| Command | What |
|---|---|
| `pnpm dev` | local dev server |
| `pnpm build` | production build |
| `pnpm lint` / `pnpm typecheck` | eslint / tsc |
| `pnpm test` | vitest (DB tests on PGlite, AI mocked) |
| `pnpm test:e2e` | playwright smoke tests (PGlite + dev user + `AI_MOCK=1`) |
| `pnpm db:generate` | drizzle-kit migration after schema changes |
| `pnpm db:migrate` | apply migrations to `DATABASE_URL` |
| `pnpm db:seed` | dev seed (settings + pricing) |
| `pnpm icons` | regenerate placeholder PWA icons |
