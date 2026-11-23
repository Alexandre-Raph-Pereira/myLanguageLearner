import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { wordKey } from "./input";
import {
  buildRows,
  classifyRows,
  columnCount,
  countByStatus,
  DEFAULT_SPLIT,
  defaultMapping,
  detectSeparator,
  mapType,
  parseTable,
  rowsToImport,
  splitMeanings,
} from "./import";

const quizlet = fs.readFileSync(
  path.resolve(__dirname, "../../tests/fixtures/import/quizlet-10.tsv"),
  "utf8",
);

describe("parsing", () => {
  it("detects tab, comma and semicolon", () => {
    expect(detectSeparator(quizlet)).toBe("\t");
    expect(detectSeparator("a,b\nc,d")).toBe(",");
    expect(detectSeparator("a;b,c\nd;e")).toBe(";");
    expect(detectSeparator("")).toBe("\t");
  });

  it("parses a Quizlet tab export", () => {
    const t = parseTable(quizlet, "\t");
    expect(t).toHaveLength(10);
    expect(columnCount(t)).toBe(2);
    expect(t[2]).toEqual(["먹다", "to eat; to have (a meal)"]);
  });

  it("keeps quoted commas in one cell", () => {
    const t = parseTable('배,"boat, ship",배를 타요\n', ",");
    expect(t).toEqual([["배", "boat, ship", "배를 타요"]]);
  });

  it("normalizes Korean to NFC and strips a BOM", () => {
    const t = parseTable(`﻿${"사과".normalize("NFD")}\tapple`, "\t");
    expect(t[0][0]).toBe("사과");
    expect(t[0][0]).toBe("사과".normalize("NFC"));
  });
});

describe("mapping", () => {
  it("defaults by column count", () => {
    expect(defaultMapping(2)).toEqual({
      term: 0,
      meaning: 1,
      example_sentence: null,
      example_translation: null,
      type: null,
    });
    expect(defaultMapping(3).example_sentence).toBe(2);
    expect(defaultMapping(5)).toMatchObject({ example_translation: 3, type: 4 });
  });

  it("maps type names", () => {
    expect(mapType("Noun")).toBe("noun");
    expect(mapType("verbs")).toBe("verb");
    expect(mapType("동사")).toBe("verb");
    expect(mapType("형용사")).toBe("adjective");
    expect(mapType("감탄사")).toBe("interjection");
    expect(mapType("표현")).toBe("expression");
    expect(mapType("adj.")).toBe("adjective");
    expect(mapType("???")).toBe("other");
    expect(mapType(undefined)).toBe("other");
  });

  it("splits meanings by the chosen separators", () => {
    expect(splitMeanings("to eat; to have", DEFAULT_SPLIT)).toEqual(["to eat", "to have"]);
    expect(splitMeanings("boat, ship", DEFAULT_SPLIT)).toEqual(["boat, ship"]);
    expect(
      splitMeanings("boat, ship/vessel", { semicolon: true, comma: true, slash: true }),
    ).toEqual(["boat", "ship", "vessel"]);
    expect(splitMeanings(" ; ", DEFAULT_SPLIT)).toEqual([]);
  });

  it("builds rows with header and custom mapping", () => {
    const table = [
      ["type", "word", "meaning", "example"],
      ["명사", "사과", "apple", "사과 주세요"],
    ];
    const rows = buildRows(
      table,
      { term: 1, meaning: 2, example_sentence: 3, example_translation: null, type: 0 },
      { header: true, split: DEFAULT_SPLIT },
    );
    expect(rows).toEqual([
      {
        i: 0,
        term: "사과",
        meanings: ["apple"],
        exampleSentence: "사과 주세요",
        exampleTranslation: null,
        type: "noun",
      },
    ]);
  });
});

describe("classification", () => {
  const table = parseTable(quizlet, "\t");
  const rows = buildRows(table, defaultMapping(2), { header: false, split: DEFAULT_SPLIT });

  it("flags invalid, duplicates (bank + file) and missing examples", () => {
    const withDup = [...rows, { ...rows[0], i: 99 }];
    const classified = classifyRows(withDup, new Set([wordKey("학교", "school")]));
    expect(classified.find((r) => r.term === "학교")?.status).toBe("duplicate");
    expect(classified.find((r) => r.term === "학교")?.inBank).toBe(true);
    expect(classified.at(-1)).toMatchObject({ status: "duplicate", inBank: false });
    expect(classified.find((r) => r.meanings[0] === "missing term")?.status).toBe("invalid");
    // Homonyms are both new.
    expect(classified.filter((r) => r.term === "배").map((r) => r.status)).toEqual(["new", "new"]);
    expect(countByStatus(classified)).toEqual({
      new: 8,
      duplicate: 2,
      invalid: 1,
      missingExample: 10,
    });
    expect(rowsToImport(classified, false)).toHaveLength(8);
    expect(rowsToImport(classified, true)).toHaveLength(9);
  });

  it("rows without meaning are invalid", () => {
    const [r] = classifyRows([{ ...rows[0], meanings: [] }], new Set());
    expect(r.status).toBe("invalid");
  });
});
