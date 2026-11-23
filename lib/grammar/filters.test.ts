import { describe, expect, it } from "vitest";
import { grammarHref, parseGrammarParams } from "./filters";

describe("grammar params", () => {
  it("parses and validates", () => {
    expect(parseGrammarParams({ q: " 수 있다 ", level: "3" })).toEqual({ q: "수 있다", level: 3 });
    expect(parseGrammarParams({ level: "9" })).toEqual({ q: "", level: null });
    expect(parseGrammarParams({ q: ["a", "b"], level: "x" })).toEqual({ q: "a", level: null });
  });

  it("builds hrefs", () => {
    expect(grammarHref({ q: "", level: null })).toBe("/grammar");
    expect(grammarHref({ q: "서", level: null }, { level: 2 })).toBe(
      "/grammar?q=%EC%84%9C&level=2",
    );
  });
});
