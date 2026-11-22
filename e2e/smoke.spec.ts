import { expect, test } from "@playwright/test";

test("home renders inside the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/LangLearner/);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});

test("settings: change target level, reload, value kept", async ({ page }) => {
  await page.goto("/settings");
  const level = page.getByLabel("Target TOPIK level");
  await expect(level).toHaveValue("");
  await level.selectOption("4");
  const form = page.getByRole("form", { name: "Language profile" });
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Target TOPIK level")).toHaveValue("4");
});

test("settings: saving pricing removes the verify banner", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Verify prices.")).toBeVisible();
  const form = page.getByRole("form", { name: "Pricing claude-sonnet-5-5" });
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Verify prices.")).toHaveCount(0);
});
