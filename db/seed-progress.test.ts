import { describe, expect, it } from "vitest";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { ensureUserRows } from "@/lib/user-bootstrap";
import { getProgressSummary } from "@/lib/progress/summary";
import { seedPlan, seedProgress } from "./seed-progress";

describe("seedProgress", () => {
  it("plans 30 days", () => {
    expect(seedPlan()).toHaveLength(30);
  });

  it("gives streak 12, ≈ 18,700 points (Intermediate II), 85 % today, and is idempotent", async () => {
    const db = await createTestDb();
    await ensureUserRows(db, TEST_USER_ID);
    const now = new Date("2026-11-22T10:00:00Z");
    const r = await seedProgress(db, TEST_USER_ID, "ko", now);
    expect(r.streak).toBe(12);
    expect(r.pointsTotal).toBeGreaterThan(18_000);
    expect(r.pointsTotal).toBeLessThan(19_500);

    const again = await seedProgress(db, TEST_USER_ID, "ko", now);
    expect(again.pointsTotal).toBe(r.pointsTotal);

    const s = await getProgressSummary(db, TEST_USER_ID, "ko", now);
    expect(s.rank.name).toBe("Intermediate II");
    expect(Math.round(s.today.pct)).toBe(85);
    expect(s.streak).toMatchObject({ current: 12, best: 12, todayMet: false });
    expect(s.week.some((d) => d.status === "met")).toBe(true);
  });
});
