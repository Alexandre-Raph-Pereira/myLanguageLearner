import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { agentsPaths, manifestSchema, parseFrontmatter } from "@/lib/ai/claude-code/agents-prompt";
import { AI_TASKS } from "@/lib/ai/tasks";

const ROOT = path.resolve(__dirname, "..");
const AGENTS = path.join(ROOT, "langlearner-agents");
const read = (rel: string) => fs.readFileSync(path.join(AGENTS, rel), "utf8");
const manifest = manifestSchema.parse(JSON.parse(read(agentsPaths.manifest)));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Task names written in code: `task: "x.y"` and `*_TASK = "x.y"`. */
function tasksInCode(): Set<string> {
  const found = new Set<string>();
  for (const dir of ["lib", "app"]) {
    for (const file of sourceFiles(path.join(ROOT, dir))) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/(?:\btask:\s*|_TASK\s*=\s*)"([a-z0-9_.-]+)"/g))
        found.add(m[1]);
    }
  }
  return found;
}

function expectValidFrontmatter(rel: string, name: string) {
  expect(fs.existsSync(path.join(AGENTS, rel)), `${rel} exists`).toBe(true);
  const { data, body } = parseFrontmatter(read(rel));
  expect(data.name, `${rel} frontmatter name`).toBe(name);
  expect(data.description?.length ?? 0, `${rel} frontmatter description`).toBeGreaterThan(20);
  expect(body.trim().length, `${rel} body`).toBeGreaterThan(0);
}

describe("langlearner-agents folder", () => {
  it("has the runtime CLAUDE.md, profile example and tool-less settings", () => {
    expect(read(agentsPaths.claude).split("\n").length).toBeLessThanOrEqual(80);
    expect(read(agentsPaths.profileExample)).toContain("## Native language");
    const settings = JSON.parse(read(".claude/settings.json"));
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(["Bash", "Read", "Write", "WebFetch"]),
    );
    expect(settings.disableAllHooks).toBe(true);
  });

  it("every manifest task points to an existing skill and persona", () => {
    for (const [task, entry] of Object.entries(manifest.tasks)) {
      expectValidFrontmatter(agentsPaths.skill(entry.skill), entry.skill);
      expectValidFrontmatter(agentsPaths.agent(entry.agent), entry.agent);
      expect(read(agentsPaths.skill(entry.skill)), `${task} skill names its task`).toContain(task);
    }
    for (const skills of Object.values(manifest.shared)) {
      for (const skill of skills) expectValidFrontmatter(agentsPaths.skill(skill), skill);
    }
  });

  it("personas declare no tools", () => {
    for (const name of new Set(Object.values(manifest.tasks).map((t) => t.agent))) {
      expect(parseFrontmatter(read(agentsPaths.agent(name))).data.tools).toBe("[]");
    }
  });

  it("every AI task used in code is in AI_TASKS, the manifest and the mock fixtures", () => {
    const inCode = tasksInCode();
    expect(inCode.size).toBeGreaterThan(0);
    for (const task of inCode) expect(AI_TASKS, `task "${task}" in AI_TASKS`).toContain(task);
    for (const task of AI_TASKS) {
      expect(manifest.tasks[task], `manifest entry for "${task}"`).toBeDefined();
      expect(
        fs.existsSync(path.join(ROOT, "tests/fixtures/ai", `${task}.json`)),
        `fixture ${task}`,
      ).toBe(true);
    }
  });

  it("commits no personal profile or secrets", () => {
    const tracked = execFileSync("git", ["ls-files", "langlearner-agents"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
    expect(tracked.length).toBeGreaterThan(0);
    expect(tracked.filter((f) => /\.local\./.test(f))).toEqual([]);
    for (const file of tracked) {
      const text = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(text, file).not.toMatch(/sk-ant-|ANTHROPIC_API_KEY\s*=/);
    }
    const ignored = execFileSync(
      "git",
      [
        "check-ignore",
        "langlearner-agents/learner/profile.local.md",
        "langlearner-agents/evals/last-run.local.json",
      ],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(ignored.trim().split("\n")).toHaveLength(2);
  });
});
