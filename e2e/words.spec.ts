import { expect, test } from "@playwright/test";

test("create, edit and delete a word on mobile", async ({ page }) => {
  await page.goto("/words/new");
  const form = page.getByRole("form", { name: "Word" });

  // Validation messages.
  await form.getByRole("button", { name: "Save word" }).click();
  await expect(form.getByText("Term is required")).toBeVisible();
  await expect(form.getByText("At least one meaning is required")).toBeVisible();

  await form.getByLabel("Term (dictionary form)").fill("고양이");
  const meanings = form.getByLabel("Meanings (first = primary)");
  await meanings.fill("cat");
  await meanings.press("Enter");
  await meanings.fill("kitty");
  await form.getByLabel("Type").selectOption("noun");
  await form.getByRole("button", { name: "Save word" }).click();

  await expect(page).toHaveURL(/\/words$/);
  await page.getByRole("searchbox", { name: "Search words" }).fill("고양이");
  await page.getByRole("searchbox", { name: "Search words" }).press("Enter");
  const row = page.getByRole("list", { name: "Word list" }).getByRole("link", { name: /고양이/ });
  await expect(row).toContainText("cat, kitty");
  await expect(row).toContainText("no example");

  await row.click();
  await page.getByLabel("Example sentence").fill("고양이가 자요.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/words$/);

  await page.goto("/words?q=%EA%B3%A0%EC%96%91%EC%9D%B4");
  const updated = page
    .getByRole("list", { name: "Word list" })
    .getByRole("link", { name: /고양이/ });
  await expect(updated).not.toContainText("no example");
  await updated.click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete word" }).click();
  await expect(page).toHaveURL(/\/words$/);
  await page.goto("/words?q=%EA%B3%A0%EC%96%91%EC%9D%B4");
  await expect(page.getByText("No words match these filters")).toBeVisible();
});
