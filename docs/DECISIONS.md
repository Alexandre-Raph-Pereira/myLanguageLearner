# Decisions log (append-only)

Format: `YYYY-MM-DD — plan NN — decision — reason`

- 2026-11-21 — all — Stack: Next.js + Supabase (Postgres + Auth) + Drizzle + Vercel AI SDK — owner approved in planning.
- 2026-11-21 — all — Default model `claude-sonnet-5-5` for both tiers, configurable — owner asked for Sonnet 5.
- 2026-11-21 — plan 00 — Next.js 16.4 scaffolded with `cacheComponents` and `partialPrefetching` **disabled** — every page is per-user, request-time data behind auth; Cache Components would force Suspense around every session read for no benefit in a single-user app. Can be revisited later.
- 2026-11-21 — plan 00 — shadcn/ui (radix base, "nova" preset): `form` no longer exists in the registry, the `field` component is used instead (forms are plain server actions + zod) — closest current equivalent.
- 2026-11-21 — plan 00 — `@playwright/test` pinned to 1.63.0 to match the Chromium preinstalled in cloud sessions; `PW_CHROMIUM_PATH` env can point to another browser binary.
- 2026-11-21 — plan 00 — `pnpm typecheck` runs `next typegen` before `tsc` so the generated route types (`LayoutProps`, `PageProps`) exist on a fresh checkout.
- 2026-11-21 — plan 00 — Work happens on the session branch `claude/charming-gauss-y43prx` (the cloud session may only push there) instead of `plan/00-fondation`.
