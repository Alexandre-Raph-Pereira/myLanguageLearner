import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiUsage, userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { resetMockFixtures, setMockFixture, getMockCalls } from "@/lib/ai/mock";
import { createTestDb, TEST_USER_ID } from "@/tests/db";

let db: Db;
vi.mock("@/lib/words/context", () => ({
  getWordContext: async () => ({
    db,
    user: { id: TEST_USER_ID, email: "t@example.com" },
    scope: { userId: TEST_USER_ID, language: "ko" },
    settings: {},
  }),
}));

const { POST } = await import("./route");
const { entriesToRows } = await import("@/lib/words/import");

function request(blob?: Blob) {
  const fd = new FormData();
  if (blob) fd.append("image", blob, "page.jpg");
  return new Request("http://localhost/api/words/photo-extract", { method: "POST", body: fd });
}
const jpeg = () =>
  new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: "image/jpeg" });

beforeEach(async () => {
  resetMockFixtures();
  db = await createTestDb();
  await db.insert(userSettings).values({ userId: TEST_USER_ID });
});

describe("POST /api/words/photo-extract", () => {
  it("returns entries from the mock fixture and sends the image to the model", async () => {
    const res = await POST(request(jpeg()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(4);
    expect(body.entries[2]).toMatchObject({ term: "기다렸어요", confidence: "low" });
    const [call] = getMockCalls("words.photo_extract");
    expect(JSON.stringify(call.prompt)).toContain("image/jpeg");
    const usage = await db.select().from(aiUsage);
    expect(usage[0]).toMatchObject({ task: "words.photo_extract", status: "ok" });
  });

  it("rejects missing, non-image and too large files", async () => {
    expect((await POST(request())).status).toBe(400);
    expect((await POST(request(new Blob(["x"], { type: "text/plain" })))).status).toBe(415);
    const big = new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], { type: "image/jpeg" });
    expect((await POST(request(big))).status).toBe(413);
  });

  it("returns an AI error payload when the model answers garbage twice", async () => {
    setMockFixture("words.photo_extract", { responses: ["not json"] });
    const res = await POST(request(jpeg()));
    expect(res.status).toBe(502);
    expect((await res.json()).error.kind).toBe("ai");
  });
});

describe("entriesToRows", () => {
  it("cleans entries into preview rows with confidence", () => {
    const rows = entriesToRows(
      [{ term: " 우산 ".normalize("NFD"), meanings: ["umbrella", "Umbrella"], confidence: "low" }],
      5,
    );
    expect(rows).toEqual([
      {
        i: 5,
        term: "우산",
        meanings: ["umbrella"],
        exampleSentence: null,
        exampleTranslation: null,
        type: "other",
        confidence: "low",
      },
    ]);
  });
});
