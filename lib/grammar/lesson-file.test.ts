import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LessonFileError, parseLessonFile } from "./lesson-file";

const CONTENT = join(process.cwd(), "content/grammar");

const minimal = (over: { header?: string; body?: string } = {}) => `---
title: -도록
pattern: -도록
variants: -도록, -지 않도록
meaning: so that
level: ${over.header ?? "3"}
---

## Description

Purpose.

## Formation

Stem + 도록.

## Examples

| Use | Korean | English |
|---|---|---|
| Purpose | 잊지 않**도록** 메모했어요. | I took notes so that I wouldn't forget. |
|  | 일찍 자도록 하세요. | Make sure to go to bed early. |
${over.body ?? ""}`;

describe("parseLessonFile", () => {
  it("parses header, sections and examples (bold removed, empty use omitted)", () => {
    const l = parseLessonFile(minimal());
    expect(l.title).toBe("-도록");
    expect(l.variants).toEqual(["-도록", "-지 않도록"]);
    expect(l.level).toBe(3);
    expect(l.descriptionMd).toBe("Purpose.");
    expect(l.similarMd).toBe("");
    expect(l.related).toEqual([]);
    expect(l.examples).toEqual([
      {
        use: "Purpose",
        ko: "잊지 않도록 메모했어요.",
        en: "I took notes so that I wouldn't forget.",
      },
      { ko: "일찍 자도록 하세요.", en: "Make sure to go to bed early." },
    ]);
  });

  it("NFC-normalizes NFD input", () => {
    const l = parseLessonFile(minimal().normalize("NFD"));
    expect(l.pattern).toBe("-도록".normalize("NFC"));
    expect(l.examples[0].ko).toBe("잊지 않도록 메모했어요.".normalize("NFC"));
  });

  it("empty level = null; out of range fails", () => {
    expect(parseLessonFile(minimal({ header: "" })).level).toBeNull();
    expect(() => parseLessonFile(minimal({ header: "7" }))).toThrow();
  });

  it("parses related lines, keeping parentheses that belong to the pattern", () => {
    const l = parseLessonFile(
      minimal({
        body: "\n## Related\n\n- similar: -(으)려고 (intention)\n- contrast: -(으)ㄹ 수 있다\n",
      }),
    );
    expect(l.related).toEqual([
      { kind: "similar", pattern: "-(으)려고", note: "intention" },
      { kind: "contrast", pattern: "-(으)ㄹ 수 있다" },
    ]);
  });

  it("rejects unknown sections, unknown link kinds and too few examples", () => {
    expect(() => parseLessonFile(minimal({ body: "\n## Notes\n\nx\n" }))).toThrow(LessonFileError);
    expect(() => parseLessonFile(minimal({ body: "\n## Related\n\n- friend: -게\n" }))).toThrow(
      LessonFileError,
    );
    const oneExample = minimal().replace(/\|  \| 일찍.*\n/, "");
    expect(() => parseLessonFile(oneExample)).toThrow();
  });

  it("ignores HTML comments (the template's instructions)", () => {
    const l = parseLessonFile(readFileSync(join(CONTENT, "TEMPLATE.md"), "utf8"));
    expect(l.related).toEqual([
      { kind: "contrast", pattern: "-(으)ㄹ 줄 알다", note: "skill vs possibility" },
    ]);
  });
});

describe("content/grammar lesson files", () => {
  const langs = readdirSync(CONTENT, { withFileTypes: true }).filter((d) => d.isDirectory());
  const files = langs.flatMap((d) =>
    readdirSync(join(CONTENT, d.name))
      .filter((f) => f.endsWith(".md"))
      .map((f) => join(d.name, f)),
  );

  it("has at least one lesson", () => expect(files.length).toBeGreaterThan(0));

  it.each(files)("%s is valid", (f) => {
    expect(() => parseLessonFile(readFileSync(join(CONTENT, f), "utf8"))).not.toThrow();
  });
});
