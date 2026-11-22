/**
 * Navy & Cream design tokens — single source of truth (docs/DESIGN.md §1).
 * `app/globals.css` must declare exactly these values (checked by tokens.test.ts);
 * the contrast test and the /dev/design page read them from here.
 */

export const THEMES = ["light", "dark"] as const;
export type ThemeName = (typeof THEMES)[number];

const light = {
  // surfaces & text
  background: "#F3EDE0",
  card: "#FBF8F1",
  sidebar: "#EDE5D4",
  foreground: "#13213C",
  "muted-foreground": "#596173",
  border: "#DDD3BF",
  "border-strong": "#C9BC9F",
  track: "#E7DFCE",
  primary: "#13213C",
  "primary-foreground": "#F3EDE0",
  hero: "#13213C",
  "on-hero": "#F3EDE0",
  brass: "#A8782A",
  "brass-text": "#86601E",
  "hero-brass": "#D4A65A",
  "hero-teal": "#7CC4C0",
  "good-soft": "#E2EEEC",
  "wrong-soft": "#F6E4DC",
  "wrong-text": "#9E4430",
  destructive: "#B4553C",
  // progress scale
  "level-0": "#B4553C",
  "level-1": "#C8963E",
  "level-2": "#3E7F86",
  "level-3": "#1F3A6E",
  "level-0-text": "#9E4430",
  "level-1-text": "#86601E",
  "level-2-text": "#2F6A70",
  "level-3-text": "#1F3A6E",
  "on-level-0": "#FBF8F1",
  "on-level-1": "#13213C",
  "on-level-2": "#FBF8F1",
  "on-level-3": "#FBF8F1",
} as const;

export type BaseToken = keyof typeof light;

const dark: Record<BaseToken, string> = {
  background: "#0D1628",
  card: "#15213A",
  sidebar: "#0A1222",
  foreground: "#F1E9D8",
  "muted-foreground": "#A3ACBF",
  border: "#26345A",
  "border-strong": "#3A4A72",
  track: "#22304F",
  primary: "#F1E9D8",
  "primary-foreground": "#13213C",
  hero: "#F1E9D8",
  "on-hero": "#13213C",
  brass: "#D4A65A",
  "brass-text": "#E0B56A",
  "hero-brass": "#9A6A1C",
  "hero-teal": "#2F6E74",
  "good-soft": "#16302F",
  "wrong-soft": "#2A1E26",
  "wrong-text": "#F09A82",
  destructive: "#E07A5F",
  "level-0": "#E07A5F",
  "level-1": "#E0B15E",
  "level-2": "#5FB3B8",
  "level-3": "#8FB0E8",
  "level-0-text": "#E07A5F",
  "level-1-text": "#E0B15E",
  "level-2-text": "#5FB3B8",
  "level-3-text": "#8FB0E8",
  "on-level-0": "#0D1628",
  "on-level-1": "#0D1628",
  "on-level-2": "#0D1628",
  "on-level-3": "#0D1628",
};

export const BASE_TOKENS: Record<ThemeName, Record<BaseToken, string>> = { light, dark };

/** shadcn variable names derived from the base tokens (same in both themes). */
export const ALIASES: Record<string, BaseToken> = {
  "card-foreground": "foreground",
  popover: "card",
  "popover-foreground": "foreground",
  secondary: "track",
  "secondary-foreground": "foreground",
  muted: "track",
  accent: "track",
  "accent-foreground": "foreground",
  input: "border-strong",
  ring: "brass",
  "chart-1": "level-3",
  "chart-2": "level-2",
  "chart-3": "brass",
  "chart-4": "level-0",
  "chart-5": "level-1",
  "sidebar-foreground": "foreground",
  "sidebar-primary": "primary",
  "sidebar-primary-foreground": "primary-foreground",
  "sidebar-accent": "track",
  "sidebar-accent-foreground": "foreground",
  "sidebar-border": "border",
  "sidebar-ring": "brass",
};

/** Every colour variable with its resolved value for a theme. */
export function themeVars(theme: ThemeName): Record<string, string> {
  const base = BASE_TOKENS[theme];
  const out: Record<string, string> = { ...base };
  for (const [alias, src] of Object.entries(ALIASES)) out[alias] = base[src];
  return out;
}

/** The theme-color meta / manifest values (DESIGN.md §3). */
export const THEME_META = {
  light: light.background,
  dark: dark.background,
  manifestBackground: light.background,
  manifestTheme: light.foreground,
} as const;

/** Text/background pairs that must stay readable, with their minimum WCAG ratio. */
export const CONTRAST_PAIRS: { fg: BaseToken; bg: BaseToken; min: number }[] = [
  ...(["background", "card"] as const).flatMap((bg) =>
    (
      [
        "foreground",
        "muted-foreground",
        "brass-text",
        "level-0-text",
        "level-1-text",
        "level-2-text",
        "level-3-text",
      ] as const
    ).map((fg) => ({ fg, bg, min: 4.5 })),
  ),
  // Bold 12 px+ badges: aim 4.5, assert 3.
  ...([0, 1, 2, 3] as const).map((n) => ({
    fg: `on-level-${n}` as BaseToken,
    bg: `level-${n}` as BaseToken,
    min: 3,
  })),
  { fg: "on-hero", bg: "hero", min: 4.5 },
  { fg: "primary-foreground", bg: "primary", min: 4.5 },
  { fg: "foreground", bg: "good-soft", min: 4.5 },
  { fg: "foreground", bg: "wrong-soft", min: 4.5 },
  { fg: "wrong-text", bg: "wrong-soft", min: 4.5 },
  { fg: "foreground", bg: "sidebar", min: 4.5 },
  { fg: "foreground", bg: "track", min: 4.5 },
];
