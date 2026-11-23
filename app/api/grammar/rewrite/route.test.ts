import { beforeEach, describe, expect, it, vi } from "vitest";
import { userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { resetMockFixtures } from "@/lib/ai/mock";
import { emptyDraft } from "@/lib/grammar/schema";
import { createTestDb, TEST_USER_ID } from "@/tests/db";

let db: Db;
vi.mock("@/lib/grammar/context", () => ({
  getGrammarContext: async () => ({
    db,
    user: { id: TEST_USER_ID, email: "t@example.com" },
    scope: { userId: TEST_USER_ID, language: "ko" },
    settings: {},
  }),
}));

const { POST } = await import("./route");

const req = (body: unknown) =>
  new Request("http://localhost/api/grammar/rewrite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(async () => {
  resetMockFixtures();
  db = await createTestDb();
  await db.insert(userSettings).values({ userId: TEST_USER_ID });
});

describe("POST /api/grammar/rewrite", () => {
  it("rewrites a draft", async () => {
    const res = await POST(
      req({ draft: { ...emptyDraft(), title: "-지만" }, instruction: "shorter" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).draft.title).toBe("-지만");
  });

  it("rejects invalid bodies", async () => {
    expect((await POST(req("not json"))).status).toBe(400);
    expect((await POST(req({ draft: { title: 1 } }))).status).toBe(400);
    expect((await POST(req({ draft: emptyDraft(), instruction: "x".repeat(501) }))).status).toBe(
      400,
    );
    expect((await POST(req("x".repeat(60_001)))).status).toBe(413);
  });
});
