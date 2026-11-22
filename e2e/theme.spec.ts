import { expect, test } from "@playwright/test";

test.describe("with a light system scheme", () => {
  test.use({ colorScheme: "light" });

  test("theme: Dark in Settings persists across reload; header toggle switches back", async ({
    page,
  }) => {
    await page.goto("/settings");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");

    await page.reload();
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Switch theme" }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect(page.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("with a dark system scheme", () => {
  test.use({ colorScheme: "dark" });

  test("theme: follows the system colour scheme by default", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
