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

test("dev design page renders every primitive in both themes", async ({ page }) => {
  await page.goto("/dev/design");
  await expect(page.getByRole("heading", { name: "Design system" })).toBeAttached();
  await expect(page.getByRole("img", { name: /^Daily goal 85%/ })).toHaveCount(2);
  await expect(page.locator(".light .bg-hero")).not.toHaveCount(0);
  await expect(page.locator(".dark .bg-hero")).not.toHaveCount(0);
});

test("settings: Claude Code provider shows its status and the daily call cap", async ({ page }) => {
  await page.goto("/settings");
  const form = page.getByRole("form", { name: "AI" });
  await form.getByLabel("Provider").selectOption("claude-code");
  await form.getByLabel("Daily AI calls (Claude Code)").fill("40");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved")).toBeVisible();

  await page.reload();
  const ai = page.getByRole("form", { name: "AI" });
  await expect(ai.getByLabel("Daily AI calls (Claude Code)")).toHaveValue("40");
  // "Claude Code found (…)" where the CLI is installed, "not installed" elsewhere.
  await expect(page.getByTestId("claude-code-status")).toHaveText(/Claude Code/);
  await expect(ai.getByText(/Today:\s*0 of 40/)).toBeVisible();
  await expect(page.getByText("Verify prices.")).toHaveCount(0);

  // Back to the server default so other specs keep their priced provider.
  await ai.getByLabel("Provider").selectOption("");
  await ai.getByRole("button", { name: "Save" }).click();
  await expect(ai.getByText("Saved")).toBeVisible();
});
