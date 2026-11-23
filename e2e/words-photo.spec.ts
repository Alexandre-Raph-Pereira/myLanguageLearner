import path from "node:path";
import { expect, test } from "@playwright/test";

test("photo import produces an editable preview (AI_MOCK)", async ({ page }) => {
  await page.goto("/words/import/photo");
  await page
    .getByLabel("Choose notebook photos")
    .setInputFiles(path.resolve(__dirname, "../public/icons/icon-192.png"));
  await expect(page.getByRole("list", { name: "Selected photos" })).toContainText("icon-192.png");
  await page.getByRole("button", { name: "Read 1 photo" }).click();

  // Fixture tests/fixtures/ai/words.photo_extract.json: 4 entries, one low confidence.
  await expect(page.getByTestId("import-counts")).toContainText("4 new");
  const rows = page.getByTestId("import-row");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(2)).toContainText("check handwriting");

  // Fix the conjugated form before saving.
  const term = page.getByRole("textbox", { name: "Term row 3", exact: true });
  await expect(term).toHaveValue("기다렸어요");
  await term.fill("기다리다");
  await term.blur();
  await page.getByRole("button", { name: "Import 4 words" }).click();
  await expect(page.getByTestId("import-result")).toHaveText("4 inserted · 0 updated · 0 skipped");

  await page.goto("/words?q=%EA%B8%B0%EB%8B%A4%EB%A6%AC%EB%8B%A4");
  await expect(
    page.getByRole("list", { name: "Word list" }).getByRole("link", { name: /기다리다/ }),
  ).toContainText("waited");
});
