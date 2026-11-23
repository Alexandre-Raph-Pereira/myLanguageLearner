import { expect, test, type Page } from "@playwright/test";
import { SEED_WORDS } from "../db/seed-words-data";

// The e2e user has the ~40 seeded Korean words (e2e/prepare-db.ts).
const byPrompt = new Map(SEED_WORDS.map((w) => [w.meanings.join(", "), w]));

async function levelSection(page: Page, term: string, meaning: string) {
  await page.goto(`/words?q=${encodeURIComponent(meaning)}`);
  await page
    .getByRole("list", { name: "Word list" })
    .getByRole("link", { name: new RegExp(`^${term}`) })
    .first()
    .click();
  return page.getByRole("region", { name: "Level" });
}

test("5-word EN→KR test: fail one, pass the others, levels and due dates update", async ({
  page,
}) => {
  await page.goto("/tests/words");
  const form = page.getByRole("form", { name: "Word test settings" });
  for (let i = 0; i < 4; i++) await form.getByRole("button", { name: "Fewer words" }).click();
  await expect(form.getByLabel("Number of words")).toHaveValue("5");
  await form.getByRole("button", { name: "Start test" }).click();
  await expect(page).toHaveURL(/\/tests\/words\/[0-9a-f-]{36}$/);

  const answered: { term: string; meaning: string; level: number; failed: boolean }[] = [];
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId("position")).toHaveText(`${i + 1}/5`);
    const prompt = (await page.getByTestId("prompt").innerText()).trim();
    const word = byPrompt.get(prompt);
    expect(word, `unknown prompt ${prompt}`).toBeDefined();
    const input = page.getByRole("textbox", { name: "Your answer" });
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("lang", "ko");

    const failed = i === 1;
    await input.fill(failed ? "틀린답" : word!.term);
    if (i === 0) {
      // Enter while the IME is composing must not submit.
      await input.evaluate((el) =>
        el.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
        ),
      );
      await expect(page.getByRole("status").filter({ hasText: /Correct|Not quite/ })).toHaveCount(
        0,
      );
    }
    await input.press("Enter");
    const feedback = page.getByRole("status").filter({ hasText: failed ? "Not quite" : "Correct" });
    await expect(feedback).toBeVisible();
    if (failed) await expect(feedback).toContainText("Back in today's review");
    answered.push({ term: word!.term, meaning: word!.meanings[0], level: word!.level, failed });
    await page.getByRole("button", { name: i === 4 ? "See results" : "Next", exact: true }).click();
  }

  await expect(page.getByTestId("score-count")).toHaveText("4 of 5 correct");
  await expect(page.getByTestId("score-pct")).toHaveText("80%");
  const missed = page.getByRole("region", { name: "Missed words" });
  await expect(missed).toContainText(answered[1].term);
  await expect(page.getByRole("button", { name: "Retry the 1 missed word" })).toBeVisible();

  // Failed word → Lv 0, due now.
  const fail = await levelSection(page, answered[1].term, answered[1].meaning);
  await expect(fail.getByLabel(/^Level 0/)).toBeVisible();
  await expect(fail).toContainText("Due now");

  // Passed word → level + 1, next review in N days.
  const pass = answered[0];
  const expected = Math.min(pass.level + 1, 3);
  const ok = await levelSection(page, pass.term, pass.meaning);
  await expect(ok.getByLabel(new RegExp(`^Level ${expected}`))).toBeVisible();
  await expect(ok).toContainText(/Next review in \d+ days?/);

  // Home: the test tile shows the last score.
  await page.goto("/");
  await expect(page.getByText("80%").first()).toBeVisible();
});
