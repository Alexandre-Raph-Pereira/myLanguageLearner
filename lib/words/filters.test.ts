import { describe, expect, it } from "vitest";
import { libraryHref, parseLibraryParams, toFilters } from "./filters";

describe("library params", () => {
  it("parses valid params and ignores invalid ones", () => {
    expect(
      parseLibraryParams({ q: " 사과 ", level: "2", type: "noun", noex: "1", page: "3" }),
    ).toEqual({ q: "사과", level: 2, type: "noun", noExample: true, page: 3 });
    expect(parseLibraryParams({ level: "7", type: "bogus", page: "-1" })).toEqual({
      q: "",
      level: null,
      type: null,
      noExample: false,
      page: 1,
    });
    expect(parseLibraryParams({ level: ["0", "1"] }).level).toBe(0);
  });

  it("maps to query filters", () => {
    expect(toFilters(parseLibraryParams({}))).toEqual({
      q: undefined,
      levels: undefined,
      types: undefined,
      needsExample: undefined,
    });
    expect(toFilters(parseLibraryParams({ level: "0", noex: "1" }))).toMatchObject({
      levels: [0],
      needsExample: true,
    });
  });

  it("builds hrefs and resets the page", () => {
    const p = parseLibraryParams({ q: "a b", level: "1", page: "4" });
    expect(libraryHref(p)).toBe("/words?q=a+b&level=1");
    expect(libraryHref(p, { page: 5 })).toBe("/words?q=a+b&level=1&page=5");
    expect(libraryHref(p, { level: null, q: "", type: "verb", noExample: true })).toBe(
      "/words?type=verb&noex=1",
    );
    expect(libraryHref(parseLibraryParams({}))).toBe("/words");
  });
});
