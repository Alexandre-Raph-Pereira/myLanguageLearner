import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentsPromptTooLargeError,
  buildAppendedPrompt,
  manifestSchema,
  parseFrontmatter,
  resolveTask,
  stripFrontmatter,
} from "./agents-prompt";
import { loadAgentsContext, readManifest } from "./agents";

describe("frontmatter", () => {
  it("parses flat key: value lines and returns the body", () => {
    const f = parseFrontmatter(
      '---\nname: tutor\ndescription: "Warm, clear"\ntools: []\n---\nBody\n',
    );
    expect(f.data).toEqual({ name: "tutor", description: "Warm, clear", tools: "[]" });
    expect(f.body).toBe("Body\n");
  });

  it("leaves text without frontmatter as is", () => {
    expect(stripFrontmatter("# Title\n---\nnot frontmatter")).toBe("# Title\n---\nnot frontmatter");
  });
});

describe("buildAppendedPrompt", () => {
  it("strips frontmatter, drops empty parts, joins with separators", () => {
    const out = buildAppendedPrompt([
      { label: "a", text: "---\nname: a\n---\nA body\n" },
      { label: "b", text: "  " },
      { label: "c", text: "C" },
    ]);
    expect(out).toBe("A body\n\n---\n\nC");
  });

  it("throws a clear error above the cap, naming the biggest files", () => {
    const parts = [
      { label: "small.md", text: "x".repeat(10) },
      { label: "big.md", text: "가".repeat(100) }, // 300 bytes in UTF-8
    ];
    expect(() => buildAppendedPrompt(parts, 200)).toThrow(AgentsPromptTooLargeError);
    expect(() => buildAppendedPrompt(parts, 200)).toThrow(
      /limit 200\)\. Shorten the biggest files: big\.md 300 B/,
    );
    expect(buildAppendedPrompt(parts, 1000)).toContain("가");
  });
});

describe("manifest", () => {
  const manifest = manifestSchema.parse({
    version: 1,
    shared: { ko: ["korean-teaching"] },
    tasks: {
      "a.task": { skill: "a-skill", agent: "tutor" },
      "b.task": { skill: "b-skill", agent: "extractor", shared: false },
    },
  });

  it("resolves shared skills by language, honours shared: false", () => {
    expect(resolveTask(manifest, "a.task", "ko")?.shared).toEqual(["korean-teaching"]);
    expect(resolveTask(manifest, "a.task", "fr")?.shared).toEqual([]);
    expect(resolveTask(manifest, "b.task", "ko")?.shared).toEqual([]);
    expect(resolveTask(manifest, "missing", "ko")).toBeNull();
  });

  it("rejects bad names and versions", () => {
    expect(manifestSchema.safeParse({ version: 2, shared: {}, tasks: {} }).success).toBe(false);
    expect(
      manifestSchema.safeParse({
        version: 1,
        shared: {},
        tasks: { t: { skill: "../etc", agent: "tutor" } },
      }).success,
    ).toBe(false);
  });
});

describe("loadAgentsContext (temp folder)", () => {
  let dir: string;
  const write = (rel: string, text: string) => {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mll-agents-"));
    write("CLAUDE.md", "ROLE");
    write(
      "manifest.json",
      JSON.stringify({
        version: 1,
        shared: { ko: ["korean-teaching"] },
        tasks: { "grammar.structure": { skill: "grammar-structure", agent: "tutor" } },
      }),
    );
    write(".claude/agents/tutor.md", "---\nname: tutor\ntools: []\n---\nPERSONA");
    write("learner/profile.example.md", "EXAMPLE PROFILE");
    write("learner/profile.local.md", "LOCAL PROFILE");
    write(".claude/skills/korean-teaching/SKILL.md", "---\nname: korean-teaching\n---\nSHARED");
    write(
      ".claude/skills/grammar-structure/SKILL.md",
      "---\nname: grammar-structure\n---\nTASK SKILL",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("builds the full prompt in order for a listed task", () => {
    const ctx = loadAgentsContext(dir, "grammar.structure", "ko");
    expect(ctx.appendedPrompt).toBe(
      ["ROLE", "PERSONA", "LOCAL PROFILE", "SHARED", "TASK SKILL"].join("\n\n---\n\n"),
    );
    expect(ctx.warnings).toEqual([]);
  });

  it("uses only CLAUDE.md for a task missing from the manifest, and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = loadAgentsContext(dir, "exam.unknown", "ko");
    loadAgentsContext(dir, "exam.unknown", "ko");
    expect(ctx.appendedPrompt).toBe("ROLE");
    expect(ctx.warnings[0]).toMatch(/not in langlearner-agents\/manifest\.json/);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the example profile when profile.local.md is missing", () => {
    fs.rmSync(path.join(dir, "learner/profile.local.md"));
    const ctx = loadAgentsContext(dir, "grammar.structure", "ko");
    expect(ctx.appendedPrompt).toContain("EXAMPLE PROFILE");
    expect(ctx.appendedPrompt).not.toContain("LOCAL PROFILE");
    expect(ctx.warnings).toContain("learner/profile.local.md not found: using profile.example.md.");
  });

  it("throws when the instructions exceed the size cap", () => {
    write(".claude/skills/grammar-structure/SKILL.md", "x".repeat(30 * 1024));
    expect(() => loadAgentsContext(dir, "grammar.structure", "ko")).toThrow(
      AgentsPromptTooLargeError,
    );
    expect(() =>
      loadAgentsContext(dir, "grammar.structure", "ko", { maxBytes: 64 * 1024 }),
    ).not.toThrow();
  });

  it("tool mode: task skill not inlined, a hint instead", () => {
    const ctx = loadAgentsContext(dir, "grammar.structure", "ko", { mode: "tool" });
    expect(ctx.appendedPrompt).not.toContain("TASK SKILL");
    expect(ctx.appendedPrompt).toContain("load the skill `grammar-structure` with the Skill tool");
    expect(ctx.appendedPrompt).toContain("PERSONA");
    expect(ctx.toolSkills).toEqual(["grammar-structure"]);
  });

  it("picks up edits without restarting (mtime cache)", () => {
    loadAgentsContext(dir, "grammar.structure", "ko");
    const file = path.join(dir, ".claude/agents/tutor.md");
    fs.writeFileSync(file, "NEW PERSONA");
    const later = new Date(Date.now() + 5_000);
    fs.utimesSync(file, later, later);
    expect(loadAgentsContext(dir, "grammar.structure", "ko").appendedPrompt).toContain(
      "NEW PERSONA",
    );
  });

  it("reports missing files and rejects an invalid manifest", () => {
    fs.rmSync(path.join(dir, ".claude/agents/tutor.md"));
    expect(loadAgentsContext(dir, "grammar.structure", "ko").warnings).toContain(
      'Persona "tutor" not found (.claude/agents/tutor.md).',
    );
    write(
      "manifest.json",
      '{"version":1,"shared":{},"tasks":{"x":{"skill":"Bad Name","agent":"t"}}}',
    );
    expect(() => readManifest(dir)).toThrow(/manifest\.json is invalid/);
  });
});
