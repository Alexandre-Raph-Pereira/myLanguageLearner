import { expect, test } from "@playwright/test";

/**
 * Visual check against the Navy & Cream canvas (not an assertion suite).
 * Run: SCREENSHOTS=1 pnpm test:e2e e2e/screenshots.spec.ts → test-results/screenshots/
 */
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture design screenshots");

const PAGES = [
  { name: "home", path: "/" },
  { name: "tests", path: "/tests" },
  { name: "settings", path: "/settings" },
  { name: "words", path: "/words" },
  { name: "word-new", path: "/words/new" },
  { name: "word-test-params", path: "/tests/words" },
  { name: "login", path: "/login" },
  { name: "dev-design", path: "/dev/design" },
];
const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "1280", width: 1280, height: 860 },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });
    for (const vp of VIEWPORTS) {
      for (const p of PAGES) {
        test(`${p.name} @${vp.name}`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const res = await page.goto(p.path);
          expect(res?.status()).toBeLessThan(500);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: `test-results/screenshots/${p.name}-${vp.name}-${scheme}.png`,
            fullPage: true,
          });
        });
      }
    }
  });
}

// Word test runner (feedback) and results, mobile light + dark.
for (const scheme of ["light", "dark"] as const) {
  test(`word test feedback + results @375 ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/tests/words");
    const form = page.getByRole("form", { name: "Word test settings" });
    for (let i = 0; i < 4; i++) await form.getByRole("button", { name: "Fewer words" }).click();
    await form.getByRole("button", { name: "Start test" }).click();
    for (let i = 0; i < 5; i++) {
      await page.getByRole("textbox", { name: "Your answer" }).fill("틀린답");
      await page.getByRole("button", { name: "Check" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Not quite" })).toBeVisible();
      if (i === 0) {
        await page.screenshot({
          path: `test-results/screenshots/word-test-feedback-375-${scheme}.png`,
          fullPage: true,
        });
      }
      await page
        .getByRole("button", { name: i === 4 ? "See results" : "Next", exact: true })
        .click();
    }
    await expect(page.getByTestId("score-pct")).toBeVisible();
    await page.screenshot({
      path: `test-results/screenshots/word-test-results-375-${scheme}.png`,
      fullPage: true,
    });
  });
}
