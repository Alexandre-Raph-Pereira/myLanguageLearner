import { describe, expect, it } from "vitest";
import { formatEstimate, rewriteEstimate, structureEstimate, type GrammarCostInfo } from "./cost";

const info: GrammarCostInfo = {
  model: "m",
  included: false,
  rates: { inputPerMtok: 2, outputPerMtok: 10 },
  structureBaseTokens: 1000,
  rewriteBaseTokens: 500,
  structureMaxOutput: 8000,
  rewriteMaxOutput: 4000,
};

describe("grammar cost estimates", () => {
  it("adds the variable part to the fixed prompt and assumes max output", () => {
    expect(structureEstimate(info, {})).toBeCloseTo((1000 * 2 + 8000 * 10) / 1e6);
    expect(structureEstimate(info, { images: 1 })).toBeCloseTo((2600 * 2 + 8000 * 10) / 1e6);
    expect(structureEstimate(info, { notes: "가나다" })).toBeCloseTo((1003 * 2 + 8000 * 10) / 1e6);
    expect(rewriteEstimate(info, "", "")).toBeCloseTo((501 * 2 + 4000 * 10) / 1e6);
  });

  it("returns null without a price and formats", () => {
    expect(structureEstimate({ ...info, rates: null }, {})).toBeNull();
    expect(formatEstimate(null)).toBe("no price set for the model");
    expect(formatEstimate(0.004)).toBe("≈ < $0.01");
    expect(formatEstimate(0.0823)).toBe("≈ $0.08");
  });

  it("says included in the Claude plan for Claude Code", () => {
    expect(formatEstimate(0, true)).toBe("included in your Claude plan");
    expect(formatEstimate(null, true)).toBe("included in your Claude plan");
  });
});
