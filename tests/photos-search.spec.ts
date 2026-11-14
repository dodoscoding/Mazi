import { test, expect } from "@playwright/test";

test("Globe search opens Photos and preserves keyword filters and the selected photograph", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const answers: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/answers/ask")) answers.push(request.url());
  });
  await page.goto("/#/atlas");
  await page.getByRole("link", { name: "Anı ara", exact: true }).click();
  await expect(page).toHaveURL(/#\/photos/);
  const query = page.getByRole("searchbox", {
    name: "Fotoğraf ve konuşmalarda ara",
    exact: true,
  });
  await expect(query).toBeFocused();
  await page
    .getByRole("combobox", { name: "Yıl", exact: true })
    .selectOption("2024");
  await query.fill("Dinner");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await expect(page).toHaveURL(/q=Dinner/);
  const origin = page.url();
  await page.locator(".mem-tile").click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(origin);
  await expect(query).toHaveValue("Dinner");
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toHaveValue("2024");
  await expect(page.locator(".mem-tile")).toBeFocused();
  expect(answers).toEqual([]);
  await expect(
    page.getByRole("link", { name: /Ask your archive|Arşivine sor/ }),
  ).toHaveCount(0);
});
