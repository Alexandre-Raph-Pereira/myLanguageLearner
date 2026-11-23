import path from "node:path";
import { expect, test } from "@playwright/test";

test("import a 10-row TSV: duplicates, invalid, AI types, insert", async ({ page }) => {
  await page.goto("/words/import");
  await page
    .getByLabel("CSV or TSV file")
    .setInputFiles(path.resolve(__dirname, "../tests/fixtures/import/e2e-10.tsv"));
  await expect(page.getByLabel("Separator")).toContainText("Auto-detect (tab)");
  await expect(page.getByLabel("Column 1")).toHaveValue("term");
  await expect(page.getByLabel("Column 2")).toHaveValue("meaning");
  await page.getByRole("button", { name: "Preview" }).click();

  // 사과/apple is in the seeded bank, 노래 appears twice, one row has no term.
  await expect(page.getByTestId("import-counts")).toContainText(
    "7 new · 2 duplicate · 1 invalid · 9 missing example",
  );
  await expect(page.getByRole("textbox", { name: "Meanings row 1", exact: true })).toHaveValue(
    "cat; kitty",
  );

  // Inline edit.
  const t10 = page.getByRole("textbox", { name: "Translation row 10" });
  await page.getByRole("textbox", { name: "Example row 10" }).fill("의자에 앉아요.");
  await t10.fill("I sit on the chair.");
  await t10.blur();
  await expect(page.getByTestId("import-counts")).toContainText("8 missing example");

  // AI types (mock fixture): estimate first, then run.
  await page.getByRole("button", { name: "Suggest types with AI" }).click();
  await expect(page.getByTestId("ai-estimate")).toContainText("up to $");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("combobox", { name: "Type row 3", exact: true })).toHaveValue("verb");

  await page.getByRole("button", { name: "Import 7 words" }).click();
  await expect(page.getByTestId("import-result")).toHaveText("7 inserted · 0 updated · 0 skipped");

  await page.goto("/words?q=%EC%9D%98%EC%9E%90");
  const row = page.getByRole("list", { name: "Word list" }).getByRole("link", { name: /의자/ });
  await expect(row).toContainText("chair");
  await expect(row).not.toContainText("no example");
});
