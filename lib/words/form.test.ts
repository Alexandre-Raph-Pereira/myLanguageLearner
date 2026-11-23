import { describe, expect, it } from "vitest";
import { parseWordForm } from "./form";

const fd = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

describe("parseWordForm", () => {
  it("collects tags + draft meaning and cleans values", () => {
    const r = parseWordForm(
      fd([
        ["term", " 사과 "],
        ["meanings", "apple"],
        ["meaningDraft", "apology; Apple"],
        ["type", "noun"],
        ["exampleSentence", ""],
      ]),
    );
    expect(r).toEqual({
      ok: true,
      data: {
        term: "사과",
        meanings: ["apple", "apology"],
        type: "noun",
        exampleSentence: null,
        exampleTranslation: null,
        notes: null,
      },
    });
  });

  it("returns field messages", () => {
    const r = parseWordForm(
      fd([
        ["term", ""],
        ["type", "other"],
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok && r.state.status === "error") {
      expect(r.state.fields.term).toBe("Term is required");
      expect(r.state.fields.meanings).toBe("At least one meaning is required");
    }
  });
});
