import { beforeEach, describe, expect, it, vi } from "vitest";
import { userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { resetMockFixtures, setMockFixture } from "@/lib/ai/mock";
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

const json = (body: unknown) =>
  new Request("http://localhost/api/grammar/structure", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
function multipart(blob?: Blob) {
  const fd = new FormData();
  if (blob) fd.append("image", blob, "page.jpg");
  return new Request("http://localhost/api/grammar/structure", { method: "POST", body: fd });
}

beforeEach(async () => {
  resetMockFixtures();
  db = await createTestDb();
  await db.insert(userSettings).values({ userId: TEST_USER_ID });
});

describe("POST /api/grammar/structure", () => {
  it("structures notes into drafts", async () => {
    const res = await POST(json({ notes: "-고 싶다, -지만" }));
    expect(res.status).toBe(200);
    expect((await res.json()).drafts).toHaveLength(2);
  });

  it("accepts one image", async () => {
    const res = await POST(
      multipart(new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" })),
    );
    expect(res.status).toBe(200);
  });

  it("validates input", async () => {
    expect((await POST(json({ notes: "  " }))).status).toBe(400);
    expect((await POST(json({ notes: "x".repeat(20_001) }))).status).toBe(413);
    expect((await POST(multipart())).status).toBe(400);
    expect((await POST(multipart(new Blob(["x"], { type: "text/plain" })))).status).toBe(415);
  });

  it("returns AI errors as payloads", async () => {
    setMockFixture("grammar.structure", { responses: ["nope"] });
    const res = await POST(json({ notes: "-지만" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error.kind).toBe("ai");
  });
});
