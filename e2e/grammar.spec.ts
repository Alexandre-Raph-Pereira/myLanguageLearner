import path from "node:path";
import { expect, test } from "@playwright/test";

// AI_MOCK fixtures: tests/fixtures/ai/grammar.structure.json (-고 싶다 linked to G1, -지만)
// and grammar.rewrite.json (shorter -지만). Seeded lessons: -아/어서, -(으)니까, -(으)ㄹ 수 있다.

test("paste notes → 2 drafts → rewrite one → save both → library with links", async ({ page }) => {
  await page.goto("/grammar/new");
  await page.getByRole("tab", { name: "From text" }).click();
  await page.getByLabel("Your notes").fill("-고 싶다 = want to\n-지만 = but");
  await expect(page.getByTestId("structure-cost")).toContainText("$");
  await page.getByRole("button", { name: "Structure with AI" }).click();

  const drafts = page.getByTestId("grammar-draft");
  await expect(drafts).toHaveCount(2);
  const first = drafts.nth(0);
  const second = drafts.nth(1);
  await expect(first.getByLabel("Title")).toHaveValue("-고 싶다");
  await expect(first.getByRole("list", { name: "Related lessons" })).toHaveCount(1);

  // Drafts survive a reload (sessionStorage).
  await page.reload();
  await expect(drafts).toHaveCount(2);

  // Rewrite the second draft, check Undo, then rewrite again.
  await expect(second.getByLabel("Title")).toHaveValue("-지만");
  await second.getByRole("button", { name: "Rewrite", exact: true }).click();
  await second.getByLabel("What should change? (optional)").fill("shorter description");
  await expect(second.getByTestId("rewrite-cost")).toContainText("$");
  await second.getByRole("button", { name: "Rewrite with AI" }).click();
  await expect(second.getByRole("textbox", { name: "Explanation" })).toHaveValue(
    'Contrasts two clauses ("A, but B").',
  );
  await second.getByRole("button", { name: "Undo rewrite" }).click();
  await expect(second.getByRole("textbox", { name: "Explanation" })).toContainText("contrast");
  await second.getByRole("button", { name: "Rewrite", exact: true }).click();
  await second.getByRole("button", { name: "Rewrite with AI" }).click();
  await expect(second.getByRole("textbox", { name: "Explanation" })).toHaveValue(
    'Contrasts two clauses ("A, but B").',
  );

  // Save both.
  await first.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("list", { name: "Saved lessons" })).toContainText("-고 싶다");
  await expect(drafts).toHaveCount(1);
  await drafts.first().getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("list", { name: "Saved lessons" })).toContainText("-지만");
  await expect(drafts).toHaveCount(0);

  await page.goto("/grammar");
  const list = page.getByRole("list", { name: "Grammar lessons" });
  await expect(list).toContainText("-고 싶다");
  await expect(list).toContainText("-지만");
  await expect(page.getByTestId("grammar-summary")).toContainText("2 studied today");

  await list.getByRole("link", { name: /-고 싶다/ }).click();
  await expect(page.getByTestId("studied-today")).toBeVisible();
  const related = page.getByRole("list", { name: "Related lessons" });
  await expect(related.getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Examples" })).toContainText("한국에 가고 싶어요.");
});

test("manual draft shows a duplicate warning and can be discarded", async ({ page }) => {
  await page.goto("/grammar/new");
  await page.getByRole("tab", { name: "Write" }).click();
  await page.getByRole("button", { name: /empty lesson/ }).click();
  const draft = page.getByTestId("grammar-draft").last();
  await draft.getByLabel("Title").fill("-을 수 있다");
  await expect(draft.getByTestId("duplicate-warning")).toContainText("-(으)ㄹ 수 있다");
  await draft.getByRole("button", { name: "Discard" }).last().click();
  await expect(page.getByTestId("grammar-draft")).toHaveCount(0);
});

test("lesson page: mark as studied today, edit", async ({ page }) => {
  await page.goto("/grammar");
  await page.getByRole("link", { name: /-\(으\)니까/ }).click();
  await expect(page.getByTestId("mastery-card")).toContainText("Not tested yet");
  await page.getByRole("button", { name: "Mark as studied today" }).click();
  await expect(page.getByTestId("studied-today")).toContainText("Studied today");

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Meaning").fill("because (reason, before commands too)");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("because (reason, before commands too)")).toBeVisible();
});

test("photo import adds drafts (AI_MOCK)", async ({ page }) => {
  await page.goto("/grammar/new");
  await page.getByRole("tab", { name: "From photo" }).click();
  await page
    .getByLabel("Choose notebook photos")
    .setInputFiles(path.resolve(__dirname, "../public/icons/icon-192.png"));
  await page.getByRole("button", { name: "Read 1 photo" }).click();
  await expect(page.getByTestId("grammar-draft")).toHaveCount(2);
});
