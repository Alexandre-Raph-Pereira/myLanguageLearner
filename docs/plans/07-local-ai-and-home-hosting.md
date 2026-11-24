# Plan 07 — Local Claude Code AI + home hosting

**Goal:** stop paying for an AI API and stop depending on Vercel. The app runs on the owner's computer (Windows + WSL2 Ubuntu, where Claude Code is installed and logged in). AI calls go through the local `claude` CLI (the owner's Claude plan) instead of an API key. The owner's phone reaches the app from anywhere over **Tailscale** (private network, HTTPS, no router port opened).

**Depends on:** 02 (all current AI tasks exist). Independent of 03–06: those plans keep using `aiObject` / `aiText` and get the new backend for free.

**Related plan:** [08 — `langlearner-agents/` folder](08-langlearner-agents.md) (the tutoring instructions, skills and agents Claude Code uses at runtime). This plan only needs the folder to **exist** (T2 creates a minimal stub); plan 08 fills it. The two can be done in either order.

---

## Decisions taken for this plan (log them in `docs/DECISIONS.md` in T1)

- **AI backend = local Claude Code CLI**, new provider `claude-code` next to `anthropic | openai | google`. The API providers stay as an optional fallback (set `AI_PROVIDER` + key).
- **Hosting = owner's computer (WSL2)**, `next start` behind **Tailscale Serve** (`https://<machine>.<tailnet>.ts.net`). **No router port forwarding** (dynamic IP, CGNAT, HTTPS and exposure to the whole internet are avoided). Cloudflare Tunnel is the documented alternative if a public URL is ever needed.
- **Database stays on Supabase** (free tier, reachable from home, migrations unchanged). Default: no local Postgres.
- **Auth:** the app is only reachable from the owner's tailnet devices, so `NO_LOGIN_USER_ID` stays on by default. Magic-link login still works if turned back on (add the tailnet URL to Supabase redirect URLs).
- **Budgets:** with `claude-code` there is no per-call price. Dollar budgets don't apply; a **daily call cap** replaces them for that provider. Calls are still logged in `ai_usage` (tokens, cost 0).
- **Vercel is retired** once the home server is verified (T9). `vercel.json` stays until then.

---

## How a call works with `claude-code`

```
feature code → aiObject / aiText (lib/ai/run.ts)
  → providers.ts: provider "claude-code" → createClaudeCodeModel(modelId)   (AI SDK LanguageModel)
     → spawn `claude -p` in langlearner-agents/  (no tools, JSON in / JSON out)
  → zod validation + retry (unchanged) → ai_usage row (cost 0)
```

The adapter is an **AI SDK `LanguageModel`** (same spec version as `MockLanguageModelV4` in `lib/ai/mock.ts`), so `run.ts` keeps calling `generateText` with `Output.object`, the zod retry loop and the mock mode untouched.

CLI invocation (verify every flag against `claude --help` of the installed version, adapt, and log what changed in DECISIONS):
- `claude -p --output-format json --input-format stream-json`
- `--model <modelId>` (from `AI_MODEL_SMART` / `AI_MODEL_FAST` or Settings, e.g. `sonnet` or a full model id)
- `--append-system-prompt <system>` (the task's system prompt from `lib/ai/prompts/*`)
- `--json-schema <schema>` when the call has a structured output (AI SDK passes `responseFormat: { type: "json", schema }` to the model); read `structured_output` from the result. **Fallback** if the flag does not exist: add "Answer with only JSON matching this schema: …" to the prompt and return the result text (zod still validates).
- No tools: `--tools ""` (or `--disallowedTools` for every tool) and `--strict-mcp-config` with no MCP config; no session saved (`--no-session-persistence` if available).
- `cwd` = `CLAUDE_AGENTS_DIR` (default `<repo>/langlearner-agents`), so Claude Code loads **that** folder's `CLAUDE.md` and `.claude/` (skills, agents, settings), never the repo's coding `CLAUDE.md`. Use `--setting-sources project` (or the equivalent) so user-level settings don't leak in.
- Images (photo imports): sent as base64 `image` content blocks in the stream-json user message. Fallback: write them to a temp folder under the agents dir, allow only the `Read` tool on that folder, delete after the call.
- **Child env:** copy `process.env` but **remove `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`** — otherwise Claude Code bills the API key instead of the owner's plan. Never log the env.
- Usage: map the result's `usage` (input / output / cache read tokens) to the AI SDK usage; finish reason `stop`; `is_error` or non-zero exit → throw (run.ts turns it into `AiError`).

---

## Data model

`user_settings` (additive migration):
- `ai_calls_daily_cap` int not null default `150` — max `claude-code` calls per local day (user timezone, same day logic as progress).

No other table changes. `ai_usage.provider = 'claude-code'`, `cost_usd = 0`, `estimated_cost_usd = 0`.

---

## Tasks

### [x] T1 — Decisions & env
- Append the decisions above to `docs/DECISIONS.md`.
- `lib/env.ts`: `AI_PROVIDER` accepts `claude-code`; new optional `CLAUDE_CODE_BIN` (default `claude`), `CLAUDE_AGENTS_DIR` (default `path.join(process.cwd(), "langlearner-agents")`), `CLAUDE_CODE_TIMEOUT_MS` (default `180000`), `CLAUDE_CODE_MAX_CONCURRENT` (default `2`).
- `.env.example`: document them, with a note that `ANTHROPIC_API_KEY` must stay empty for `claude-code`.
- **Accept:** env tests cover the new values and defaults.

### [x] T2 — Claude Code model adapter (`lib/ai/claude-code/`)
- `args.ts` (pure): builds the CLI argument list and the stream-json input from the AI SDK call options (system, messages, text + image parts, responseFormat, model id). Unit-tested.
- `parse.ts` (pure): parses the CLI JSON result → `{ text, usage, isError, error }`. Unit-tested with recorded samples in `tests/fixtures/claude-code/*.json` (record real outputs once on the owner's machine; until then, write them from the CLI docs and note it in HUMAN_TODO).
- `model.ts` (`server-only`): `createClaudeCodeModel(modelId, task, language)` (`getModel` already receives `task`; pass the call's language too, default `ko`, so plan 08 can pick the task's skill and persona from `langlearner-agents/manifest.json`) returning a `LanguageModel` whose `doGenerate` spawns the CLI (`child_process.spawn`, no shell), writes the input on stdin, enforces the timeout (kill the process), honours `abortSignal`, and a module-level semaphore (`CLAUDE_CODE_MAX_CONCURRENT`). `doStream` throws "not supported" (no streaming used today).
- Clear errors: binary not found → `AiError("Claude Code is not installed on this server…")`; not logged in → "Run `claude` once in WSL and log in"; usage limit reached → "Your Claude plan limit is reached, try again later".
- Create `langlearner-agents/` with a **minimal stub** only if plan 08 has not been done yet: `CLAUDE.md` ("You answer requests from the myLanguageLearner app. Follow the system instructions and answer only in the requested format.") and `.claude/settings.json` denying all tools. Plan 08 replaces it.
- **Tests:** a fake CLI `tests/fixtures/claude-code/fake-claude.mjs` (prints a canned result, can simulate error / timeout / bad JSON) used through `CLAUDE_CODE_BIN`. Test: structured call returns the object; invalid JSON goes through run.ts's retry; timeout kills the process; `ANTHROPIC_API_KEY` is not in the child env; cwd is the agents dir.

### [x] T3 — Wire the provider into `lib/ai`
- `providers.ts`: `AI_PROVIDERS` gains `"claude-code"`; `providerModel` returns `createClaudeCodeModel(modelId)`. Mock mode unchanged (`AI_MOCK=1` wins over every provider).
- `run.ts` `prepare()`: for `claude-code`, skip `getPricing` (use zero rates) and replace the dollar `guard` with `assertCallCap(db, userId, settings)` (count of today's `ai_usage` rows with provider `claude-code` and status `ok`/`error`, user timezone) → `BudgetError("Daily AI call limit reached (150). Raise it in Settings.")`. Logging unchanged (cost 0). `cacheSystem` is ignored (Claude Code caches on its own).
- `lib/ai/budget.ts`: add the pure day-window helper + `assertCallCap`; unit tests on PGlite.
- **Accept:** existing `lib/ai/ai.test.ts` passes untouched; new tests for the cap and for "no pricing row needed".

### [x] T4 — Settings & cost UI
- Settings → AI: provider select gains **"Claude Code (this computer)"**; when selected, show the daily call cap input (instead of the dollar budgets, which stay for API providers), and a status line from a server check (`claude --version` run once, cached 60 s): "Claude Code found (v…)" or the error message from T2. Never show env values.
- Cost estimates (`lib/grammar/cost.ts`, `lib/words/suggest-types.ts`, the AI buttons): with `claude-code`, show "Included in your Claude plan · N calls" instead of "≈ $…", and never disable AI buttons for a missing price. Keep the "verify prices" banner only for API providers.
- Follow `docs/DESIGN.md` (tokens, light + dark, 375 px).
- **Accept:** component/unit tests for both provider modes; e2e still passes with `AI_MOCK=1`.

### [x] T5 — Health endpoint
- `GET /api/health` (public path in `lib/auth-rules.ts`): `{ ok, version: <git sha from env or package.json>, db: "ok" | "error", ai: { provider, ready } }`. No secrets, no user data. Used by the deploy script and to check the server from the phone.
- **Accept:** route test with PGlite + fake CLI.

### [x] T6 — Home server scripts (`scripts/home/`)
All bash, idempotent, commented, run inside WSL as the owner (no root except where stated).
- `deploy.sh`: `git fetch` + `git checkout main` + `git pull --ff-only` → `pnpm install --frozen-lockfile` → `pnpm db:migrate` → `pnpm build` → `systemctl --user restart mylanguagelearner` → poll `http://127.0.0.1:3000/api/health` for 60 s, exit non-zero (and print the last 50 log lines) if it never gets `ok`. Default: build in place (a few seconds of downtime during restart is acceptable).
- `mylanguagelearner.service` (systemd **user** unit): `WorkingDirectory=<repo>`, `EnvironmentFile=<repo>/.env.production.local`, `ExecStart=pnpm start -H 127.0.0.1 -p 3000`, `Restart=always`. Binding to `127.0.0.1` means only Tailscale Serve reaches it.
- `mylanguagelearner-update.service` + `.timer` (optional auto-deploy): every 10 min, run `deploy.sh` only if `origin/main` moved.
- `install.sh`: copies the units to `~/.config/systemd/user/`, `systemctl --user daemon-reload`, enables the app (and the timer if `--auto-update`), runs `loginctl enable-linger $USER` (sudo) so it runs without an open terminal.
- `.gitignore`: make sure `.env.production.local` is covered.
- `package.json`: `"home:deploy": "bash scripts/home/deploy.sh"`.
- **Accept:** `bash -n` on every script; `shellcheck` if available; the unit files reference no absolute path other than through a `%h`/placeholder replaced by `install.sh`.

### [x] T7 — Runbook `docs/HOME_HOSTING.md`
Step-by-step for the owner, mobile-friendly Markdown, every command copy-pastable:
1. **WSL:** enable systemd (`/etc/wsl.conf` → `[boot] systemd=true`, then `wsl --shutdown` from PowerShell); keep WSL running (`%UserProfile%\.wslconfig` → `[wsl2] vmIdleTimeout=-1`); start it at Windows logon with a Task Scheduler task running `wsl.exe -d Ubuntu --exec /bin/true`.
2. **Windows power:** never sleep on AC power (Settings → System → Power); optional: auto-login after reboot or accept that a reboot needs a login.
3. **Node + pnpm** in WSL (versions from `package.json`), clone the repo **inside the WSL filesystem** (`~/myLanguageLearner`, not `/mnt/c` — much faster builds).
4. **Claude Code:** check `claude --version` and that `claude -p "hi"` answers **without** `ANTHROPIC_API_KEY` set (plan login, not API billing).
5. `.env.production.local`: `DATABASE_URL`, Supabase vars, `NO_LOGIN_USER_ID`, `AI_PROVIDER=claude-code`, `AI_MODEL_SMART` / `AI_MODEL_FAST`; **no** `ANTHROPIC_API_KEY`, **no** `AI_MOCK`.
6. `bash scripts/home/install.sh` then `pnpm home:deploy`.
7. **Tailscale:** install in WSL (`curl -fsSL https://tailscale.com/install.sh | sh`, `sudo tailscale up`), enable HTTPS certificates + MagicDNS in the Tailscale admin console, then `sudo tailscale serve --bg 3000` → note the `https://<machine>.<tailnet>.ts.net` URL. Install the Tailscale app on the phone, same account, turn on "always on".
8. **Phone:** open the URL, install the PWA (Add to Home Screen), remove the old Vercel PWA.
9. **Troubleshooting:** `journalctl --user -u mylanguagelearner -f`, `curl localhost:3000/api/health`, `tailscale status`, Claude Code logged out, Windows rebooted, plan usage limit reached.
10. **Fallback:** switch Settings → AI provider to `anthropic` and set `ANTHROPIC_API_KEY` in `.env.production.local` if Claude Code is unavailable.

### [x] T8 — HUMAN_TODO
Add a **Plan 07** section to `docs/HUMAN_TODO.md`: do the runbook (T7), record real CLI outputs for `tests/fixtures/claude-code/` (`claude -p --output-format json …` with and without `--json-schema`, an error case) if T2 used doc-based samples, first real checks (grammar from text, words photo import) with `AI_PROVIDER=claude-code`, and the Vercel retirement steps (T9).

### [ ] T9 — Retire Vercel (after the owner confirms the home server works)
Default while not confirmed: leave Vercel running, put the steps in HUMAN_TODO and finish the plan without this task.
- Owner: Vercel → Project → Settings → disconnect the Git repo (or delete the project). Supabase → Auth → URL configuration: set Site URL to the tailnet URL (only matters if magic link is turned back on).
- Code: delete `vercel.json`; update `CLAUDE.md` (Stack + Layout: home hosting, `claude-code` provider, `langlearner-agents/`), `docs/VISION.md` ("Hosting" and "AI provider" bullets), `README.md`, and the "Migrations run on every Vercel deployment" note (now: `deploy.sh` runs them). Add a DECISIONS entry.

---

## Tests (summary)
- Pure: CLI args builder, result parser, day window for the call cap.
- Integration (PGlite + fake CLI): `aiObject` / `aiText` through `claude-code`, call cap blocks and logs `blocked`, mock mode still wins.
- e2e: unchanged (`AI_MOCK=1`); Settings shows the Claude Code option.
- Manual (owner): runbook end to end, one real call per existing AI task.

## Out of scope
- Streaming responses, live chat.
- Running Postgres at home, backups (Supabase keeps handling it).
- Exposing the app to the public internet / other users (would need login on and a review of Anthropic's terms for using a personal plan).
- The content of `langlearner-agents/` (plan 08).

## Definition of Done
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass; `pnpm test:e2e` passes with `AI_MOCK=1`.
- With the fake CLI, every existing AI task (`words.suggest_types`, `words.photo_extract`, `grammar.structure`, `grammar.rewrite`) runs end to end through the `claude-code` provider in tests.
- Scripts and runbook committed; HUMAN_TODO has the Plan 07 section; DECISIONS updated.
- Owner check (HUMAN_TODO): the phone, on mobile data with Tailscale on, opens the tailnet URL, installs the PWA, and a grammar import from text returns a draft through Claude Code.
