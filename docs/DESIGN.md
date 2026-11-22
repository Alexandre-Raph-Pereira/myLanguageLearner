# DESIGN.md — Navy & Cream

The app's visual language and its motivation system. Chosen by the owner on 2026-11-22 from three proposals.
Mockups (all screens, light + dark, style sheet): **Claude Design canvas "myLanguageLearner redesign" → page "Navy & Cream — chosen"** (owner's private link; ask the owner if you need it). This file is the source of truth for implementation; the canvas is the picture.

Tone: grown-up and focused. Editorial "ledger" feel — cream paper, navy ink, brass accent. No confetti, no mascots, no emoji. Motivation comes from **honest numbers**: percentages, levels, streak, points, milestones.

---

## 1. Tokens

Defined once as CSS variables in `app/globals.css` (`:root` = light, `.dark` = dark), mapped to Tailwind via `@theme inline`. Components use the Tailwind names (`bg-card`, `text-muted-foreground`, `bg-level-2`…), never raw hex.

### Surfaces & text
| token | light (cream) | dark (navy) | use |
|---|---|---|---|
| `background` | `#F3EDE0` | `#0D1628` | page |
| `card` | `#FBF8F1` | `#15213A` | cards, bottom nav, sheets |
| `sidebar` | `#EDE5D4` | `#0A1222` | desktop sidebar |
| `foreground` | `#13213C` | `#F1E9D8` | body text |
| `muted-foreground` | `#596173` | `#A3ACBF` | secondary text (≥ 4.5:1 on card) |
| `border` | `#DDD3BF` | `#26345A` | hairlines |
| `border-strong` | `#C9BC9F` | `#3A4A72` | secondary buttons, dashed cards |
| `track` | `#E7DFCE` | `#22304F` | empty part of bars/rings, chips, active nav pill |
| `primary` / `primary-foreground` | `#13213C` / `#F3EDE0` | `#F1E9D8` / `#13213C` | primary buttons |
| `hero` / `on-hero` | `#13213C` / `#F3EDE0` | `#F1E9D8` / `#13213C` | the one inverted panel per screen |
| `brass` | `#A8782A` | `#D4A65A` | accent fills (points, streak, highlights) |
| `brass-text` | `#86601E` | `#E0B56A` | accent text (contrast-safe) |
| `hero-brass` / `hero-teal` | `#D4A65A` / `#7CC4C0` | `#9A6A1C` / `#2F6E74` | ring colours on the hero panel |
| `good-soft` | `#E2EEEC` | `#16302F` | correct-answer panel |
| `wrong-soft` / `wrong-text` | `#F6E4DC` / `#9E4430` | `#2A1E26` / `#F09A82` | wrong-answer panel |
| `destructive` | `#B4553C` | `#E07A5F` | delete actions |

### Progress scale (the core of the motivation system)
One 4-step scale everywhere: **word levels 0–3** and **any percentage**.

| step | meaning | % rule | fill light | text light | fill dark (= text) | on-fill |
|---|---|---|---|---|---|---|
| `level-0` | new / reset / weak | < 40 % | `#B4553C` rust | `#9E4430` | `#E07A5F` | light `#FBF8F1`, dark `#0D1628` |
| `level-1` | learning | 40–59 % | `#C8963E` ochre | `#86601E` | `#E0B15E` | light `#13213C`, dark `#0D1628` |
| `level-2` | known | 60–79 % | `#3E7F86` teal | `#2F6A70` | `#5FB3B8` | light `#FBF8F1`, dark `#0D1628` |
| `level-3` | mastered | ≥ 80 % | `#1F3A6E` navy | `#1F3A6E` | `#8FB0E8` | light `#FBF8F1`, dark `#0D1628` |

`lib/progress/scale.ts` (pure, unit-tested): `scaleStep(pct): 0|1|2|3`, `levelStep(level)`. Grammar mastery maps: `not_tested` → muted, `learning` → step from its %, `mastered` → 3.

**Rule: colour never carries meaning alone.** Every bar, ring, badge or pip shows its number or label next to it (colour-blind safe; the four steps also differ in lightness).

### Typography
| role | font | weights | where |
|---|---|---|---|
| display | **Fraunces** (opsz) | 500, 700 | page titles, big numbers (84%), section headings |
| UI | **Inter** | 400–700 | everything else |
| target language | **Noto Serif KR** for `ko` | 500, 700 | every Korean string (terms, passages, patterns) |

Loaded with `next/font/google` (Korean font: `preload: false`, `display: swap`). Target-language font is a **per-language slot**: `lib/languages.ts` exports `TARGET_FONT_CLASS[language]` (`ko` → `font-target-ko`; `fr`/`en` later → Fraunces). Wrap target-language text in `<T lang={language}>` (`components/ui/target-text.tsx`) which sets `lang` + the font class.
Scale: 12 · 13 · 15 · 16 · 20 · 24 · 30 · 40 · 88. Overline labels: 12 px, 600, `uppercase`, `tracking-[0.08em]`, muted.

### Shape & spacing
Radius: 6 badge · 12 control/button · 16 card · 18 hero · full for chips/pills. 4-pt spacing; screen gutter 16 px mobile, 32–40 px desktop; card padding 16–20; gaps 10–16. Touch targets ≥ 44 px. Mobile first at 375 px; desktop from `md` (768 px): left sidebar + `auto-fit` card grid.

---

## 2. Components (`components/progress/`, `components/shell/`)
| component | spec |
|---|---|
| `GoalRing` | two concentric CSS `conic-gradient` rings: outer = words goal (brass), inner = grammar goal (teal); centre = total % in Fraunces. `role="img"` + `aria-label` "Daily goal 85%: 14 of 20 words, 1 of 1 lesson". |
| `ProgressRing` | single ring, colour from the scale (results score, lesson mastery). |
| `ProgressBar` | 6–8 px rounded bar on `track`; colour from scale unless overridden. |
| `LevelBar` | stacked bar of word counts per level 0–3 (2 px gaps). |
| `LevelBadge` | "Lv 2" pill on the level fill; optional label ("Known"). `LevelTransition` = badge → arrow → badge. |
| `LevelPips` | 3 small bars filled up to the level, coloured by the level; "Lv n" under it. |
| `LedgerRow` | name + sub line + big % (Fraunces, scale text colour) + delta + bar. |
| `StatTile` | small card: overline, big number, sub line. |
| `WeekStrip` | 7 segments Mon–Sun: goal met = brass, not met / future = track; today = partial. |
| `MiniBars` | CSS bar chart (≤ 12 bars), each bar coloured by the scale (score history). Only the Stats line/history charts use recharts. |
| `HeroPanel` | inverted panel (`hero`/`on-hero`); **max one per screen**; holds the primary CTA. |
| `MilestoneBadge` | circle: earned = brass fill, locked = dashed `track` ring + progress %. |
| `PointsBreakdown` | ledger list of point lines + bold brass total. |
| `GoalMetBanner` | hero-style banner "Daily goal met · streak N days". |
| `FeedbackPanel` | correct (`good-soft`) / wrong (`wrong-soft`) panel: verdict, expected answer, `LevelTransition`, next review, example sentence + translation. |
| Shell | header: wordmark "LangLearner" + brass dot, language chip, theme toggle. Mobile bottom nav: 5 items, active item = `track` pill behind the icon. Desktop sidebar: same items, active = `track` background; footer card shows rank + bar. |

All components work in both themes and are rendered side by side on the dev page `/dev/design` (dev only).

---

## 3. Theme
- `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Preference is per device (localStorage).
- Toggle: icon button in the header (sun/moon) + **Settings → Appearance**: System / Light / Dark segmented control with two preview tiles.
- `<meta name="theme-color">` for both schemes (`#F3EDE0` light, `#0D1628` dark); manifest `background_color #F3EDE0`, `theme_color #13213C`.

---

## 4. Motivation system (data rules — implemented in plan 00c)
- **Daily goal** (per active language, editable in Settings): default **20 word answers + 1 grammar lesson**.
  - Words: every answered word-test item counts (any result).
  - Grammar lesson: a distinct lesson is credited for the day when it is (a) marked "Studied today" on its page, (b) saved (created) from review, or (c) the subject of ≥ 3 grammar-test/TOPIK questions answered that day.
  - Goal % = (min(words / goalWords, 1) + min(lessons / goalLessons, 1)) / 2.
- **Streak**: consecutive local days with the goal fully met; today does not break it until the day ends. Days use `user_settings.timezone` (IANA, auto-detected). No streak freezes. Best streak kept.
- **Points** (per language):
  | event | points |
  |---|---|
  | word answer correct / alternative / "I was right" | 10 |
  | word becomes known (level reaches 2) | 5 |
  | grammar lesson credited (once per lesson per day) | 10 |
  | grammar question correct (MCQ, conjugation, choose) | 10 |
  | grammar translation judged correct | 15 |
  | TOPIK question correct — blank mode / serious mode | 15 / 20 |
  | daily goal met (once per day) | 25 |
  Wrong answers give 0. Points are never removed except when an "I was right" override is undone.
- **Ranks** (cumulative points, per language — effort ranks, not CEFR claims): Novice 0 · Beginner I 1,000 · Beginner II 2,500 · Elementary I 4,500 · Elementary II 7,000 · Intermediate I 10,500 · Intermediate II 15,000 · Upper-intermediate 22,000 · Advanced I 30,000 · Advanced II 40,000 · Expert 55,000.
- **Milestones** (24): words known 50 / 100 / 250 / 450 / 700 / 1,000 / 1,500 / 2,000 · grammar mastered 5 / 10 / 25 / 50 / 100 · streak 7 / 30 / 100 / 365 · reference list fully covered for level 1…6 (plan 06) · first serious-mode TOPIK test ≥ 70 %. Locked milestones show progress %.
- Settings → Motivation: "Points & rank" (hide points UI when off; points still accrue) and "Milestone celebrations" (sonner toast + banner on results).

---

## 5. Screen map (canvas → route)
| canvas artboard | route | plan |
|---|---|---|
| Home (light / dark / desktop) | `/` | 00c (skeleton), 05 T11 (tests, resume) |
| Words library | `/words` | 01 T2 |
| Word test — feedback | `/tests/words/[id]` | 01 T4 |
| Session results | word/grammar/TOPIK results | 01 T4, 03 T5, 05 T9 |
| Grammar lesson | `/grammar/[id]` | 02 T2 (+ mastery 03 T2) |
| Tests hub | `/tests` | 00b (shell), 03/05 fill cards |
| TOPIK blank mode — lookup drawer | `/tests/topik/[id]` | 05 T2–T4 |
| Stats & milestones | `/stats` | 05 T10 |
| Settings — appearance & goals | `/settings` | 00b (appearance), 00c (goals, motivation) |
| Style sheet | `app/globals.css`, `components/progress/*` | 00b |

Screens not drawn (import flows, review queues, config pages) reuse the same cards, chips, buttons and `HeroPanel` patterns.
