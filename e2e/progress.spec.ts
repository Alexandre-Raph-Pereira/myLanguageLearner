import { expect, test } from "@playwright/test";

// The e2e user is seeded by e2e/prepare-db.ts: streak 12, ≈ 18,700 pts, today 14/20 words + 1/1 lesson.

test("home shows the seeded goal %, streak and rank", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: /^Daily goal 85%: 14 of 20 words/ })).toBeVisible();
  await expect(page.getByTestId("streak")).toContainText("Streak 12 days");
  await expect(page.getByTestId("rank-name")).toHaveText("Intermediate II");
  await expect(page.getByRole("list", { name: "This week" })).toBeVisible();
});

test("changing the words goal in Settings updates Home %", async ({ page }) => {
  await page.goto("/settings");
  const form = page.getByRole("form", { name: "Daily goal" });
  await expect(form.getByRole("status", { name: "Words to review" })).toHaveText("20");
  await form.getByRole("button", { name: "Increase words to review" }).click();
  await expect(form.getByRole("status", { name: "Words to review" })).toHaveText("25");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved")).toBeVisible();

  await page.goto("/");
  // (14/25 + 1/1) / 2 = 78 %
  await expect(page.getByRole("img", { name: /^Daily goal 78%: 14 of 25 words/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review 11 more words" })).toBeVisible();
});

test("turning off Points & rank hides the rank card", async ({ page }) => {
  await page.goto("/settings");
  const form = page.getByRole("form", { name: "Motivation" });
  const points = form.getByRole("checkbox", { name: /Points & rank/ });
  await expect(points).toBeChecked();
  await points.click();
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("img", { name: /^Daily goal/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Rank" })).toHaveCount(0);

  // restore for the other specs
  await page.goto("/settings");
  await page.getByRole("checkbox", { name: /Points & rank/ }).click();
  await page
    .getByRole("form", { name: "Motivation" })
    .getByRole("button", { name: "Save" })
    .click();
  await expect(page.getByRole("form", { name: "Motivation" }).getByText("Saved")).toBeVisible();
});
