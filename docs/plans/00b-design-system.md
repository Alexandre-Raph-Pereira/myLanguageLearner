# Plan 00b — Design system & themes (Navy & Cream)

**Goal:** replace the default greyscale shadcn look with the chosen **Navy & Cream** design: light + dark themes with a toggle, fonts, the progress colour scale, the shared progress components and the restyled shell — so every later plan builds screens from the same parts.

**Depends on:** 00. **Read first:** `docs/DESIGN.md` (tokens, components, screen map). No data-model changes in this plan.

---

## Tasks

### [x] T1 — Tokens & fonts
- Rewrite the colour variables in `app/globals.css` with the values of DESIGN.md §1 (`:root` light, `.dark` dark). Keep shadcn variable names (`--background`, `--card`, `--primary`, `--muted-foreground`, `--border`, `--ring`, `--destructive`, `--sidebar*`, `--chart-1..5`) and add: `--border-strong`, `--track`, `--hero`, `--on-hero`, `--hero-brass`, `--hero-teal`, `--brass`, `--brass-text`, `--good-soft`, `--wrong-soft`, `--wrong-text`, `--level-{0..3}`, `--level-{0..3}-text`, `--on-level-{0..3}`. Map them all in `@theme inline` (`--color-level-2: var(--level-2)` …). Charts: `--chart-1..4` = level-3, level-2, brass, level-0.
- `--radius: 0.75rem` (12 px controls); cards use `rounded-2xl` (16 px).
- Fonts via `next/font/google` in `app/layout.tsx`: Fraunces (variable, opsz), Inter, Noto Serif KR (500/700, `preload: false`). CSS vars `--font-display`, `--font-sans`, `--font-target-ko`; Tailwind utilities `font-display`, `font-target-ko`.
- `lib/languages.ts`: `TARGET_FONT_CLASS: Record<Language, string>` (`ko` → `font-target-ko`, `fr`/`en` → `font-display`). Component `components/ui/target-text.tsx`: `<T lang="ko">…</T>` sets `lang` and the class.
- **Accept:** build passes; a unit test (`lib/design/contrast.test.ts`) computes WCAG contrast for every text/background pair listed in DESIGN.md (foreground, muted, brass-text, level-n-text on background and card; on-level-n on level-n; on-hero on hero) in both themes and asserts ≥ 4.5 (≥ 3 for `on-level-*` badges, which are bold 12 px+ — default: still aim 4.5, assert 3). Tokens live in `lib/design/tokens.ts` (single source, also used by the test and the dev page); `globals.css` values must match (a test reads the CSS file and compares).

### [x] T2 — Theme switching
- Add `next-themes`; `ThemeProvider` in `components/providers.tsx` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`); `suppressHydrationWarning` on `<html>`.
- `components/shell/theme-toggle.tsx`: icon button (sun/moon, `aria-label="Switch theme"`, 44 px) cycling light/dark from the resolved theme.
- Settings → new first section **Appearance**: segmented control System / Light / Dark (radiogroup) + two preview tiles (cream, navy), as in the canvas.
- `viewport.themeColor` per scheme (`#F3EDE0` / `#0D1628`); manifest `background_color: #F3EDE0`, `theme_color: #13213C`. Regenerate placeholder icons in navy/cream/brass (`pnpm icons`).
- **Accept:** e2e: choose Dark in Settings → `html.dark` present, survives reload; header toggle switches back.

### [x] T3 — Shell restyle
- Header: wordmark "LangLearner" in Fraunces 700 + brass dot, language chip (`한국어`, from `LANGUAGE_LABELS`), theme toggle, sign-out icon. Safe-area padding kept.
- Mobile bottom nav: `bg-card`, 5 items unchanged (Home, Words, Grammar, Tests, Settings); active item = `bg-track` pill (44×28) behind the icon + 600 weight; inactive muted.
- Desktop sidebar: `bg-sidebar`, wordmark, items with `bg-track` active row (radius 10); footer slot `SidebarFooter` (empty now; plan 00c puts rank + bar there).
- Page titles: Fraunces 30 px mobile / 36 px desktop.
- **Accept:** existing e2e still pass; screenshots at 375 px and 1280 px in both themes look like the canvas (owner check → HUMAN_TODO "compare with canvas").

### [x] T4 — Progress primitives
- `lib/progress/scale.ts` (pure): `scaleStep(pct)` (< 40 → 0, < 60 → 1, < 80 → 2, else 3), `levelStep(level)`, `masteryStep(state, pct)`, `stepClasses(step)` → `{ fill, text, onFill, soft }` Tailwind class names. Unit tests for every boundary (39.9, 40, 59, 60, 79, 80, 100, NaN → 0).
- Components in `components/progress/` exactly as specified in DESIGN.md §2: `GoalRing`, `ProgressRing`, `ProgressBar`, `LevelBar`, `LevelBadge`, `LevelTransition`, `LevelPips`, `LedgerRow`, `StatTile`, `WeekStrip`, `MiniBars`, `HeroPanel`, `MilestoneBadge`, `PointsBreakdown`, `GoalMetBanner`, `FeedbackPanel` (presentational only — props in, no data fetching). Rings use CSS `conic-gradient` (no SVG dependency). Every visual has a text equivalent (`aria-label` or visible number).
- Component tests (vitest + jsdom): labels/aria present, scale class chosen from %.
- Dev page `/dev/design` (only when `NODE_ENV !== 'production'`): every component with sample props, rendered in a light and a `.dark` column side by side.
- **Accept:** tests green; dev page renders.

### [x] T5 — Restyle existing pages
- Home: replace the placeholder with the **Home skeleton** of the canvas built from the primitives, fed by a static "empty state" object (no data yet): hero `GoalRing` at 0 % with "Your daily goal: 20 words · 1 grammar lesson", rank/ledger/tests cards showing "Available after plan 01/02/03/05" muted states. Plan 00c wires real data.
- Tests hub `/tests`: three test cards in the canvas layout (disabled state until each plan ships), resume slot.
- Settings: sections as cards with overline headings; native selects/inputs restyled with tokens.
- Login: cream page, wordmark, single card.
- `AiErrorMessage`: uses `wrong-soft` / `wrong-text`.
- **Accept:** lint/typecheck/test/build/e2e green.

### [x] T6 — Docs
- Append decisions to `docs/DECISIONS.md` (fonts, next-themes, token source file).
- HUMAN_TODO: "Open the deployed app on the phone in light and dark mode and compare with the Navy & Cream canvas."

## Definition of Done
The app shell, Home skeleton, Tests hub, Settings and Login match the Navy & Cream canvas in light and dark at 375 px and 1280 px; theme follows the system by default and can be forced in Settings or the header; all progress primitives exist with tests; contrast test green; lint/typecheck/test/build/e2e green.
