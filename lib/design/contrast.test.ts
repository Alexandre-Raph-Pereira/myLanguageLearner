import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { BASE_TOKENS, CONTRAST_PAIRS, THEMES } from "./tokens";

describe("contrastRatio", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
});

describe.each(THEMES)("%s theme contrast", (theme) => {
  const t = BASE_TOKENS[theme];
  it.each(CONTRAST_PAIRS)("$fg on $bg ≥ $min", ({ fg, bg, min }) => {
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
});
