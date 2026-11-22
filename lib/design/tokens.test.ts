import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES, themeVars, type ThemeName } from "./tokens";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

/** Custom properties declared in the first top-level block matching this selector regex. */
function block(selector: string): Record<string, string> {
  const re = new RegExp(`(^|\\n)${selector}\\s*\\{([^}]*)\\}`);
  const m = re.exec(css);
  if (!m) throw new Error(`No ${selector} block in globals.css`);
  const vars: Record<string, string> = {};
  for (const [, name, value] of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[name] = value.trim();
  return vars;
}

const SELECTOR: Record<ThemeName, string> = { light: ":root,\\s*\\.light", dark: "\\.dark" };

describe.each(THEMES)("globals.css %s values match lib/design/tokens.ts", (theme) => {
  const declared = block(SELECTOR[theme]);
  it.each(Object.entries(themeVars(theme)))("--%s = %s", (name, value) => {
    expect(declared[name]?.toUpperCase()).toBe(value.toUpperCase());
  });
});

it("every colour token is exposed to Tailwind", () => {
  for (const name of Object.keys(themeVars("light"))) {
    expect(css).toContain(`--color-${name}: var(--${name});`);
  }
});
