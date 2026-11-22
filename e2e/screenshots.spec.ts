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
