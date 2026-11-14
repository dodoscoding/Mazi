import { test, expect } from "@playwright/test";

test("old Ask links retain their query in Photos with an honest retirement notice", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/answers/ask"))
      requests.push(request.url());
  });
  await page.goto("/#/ask?question=Dinner&years=2024");
  await expect(page).toHaveURL(/#\/photos\?/);
  await expect(
    page.getByRole("searchbox", {
      name: "Fotoğraf ve konuşmalarda ara",
      exact: true,
    }),
  ).toHaveValue("Dinner");
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toHaveValue("2024");
  await expect(
    page.getByRole("status").filter({ hasText: "AI yanıtları kaldırıldı" }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await expect(page.locator("#answer, #ask-card, #question")).toHaveCount(0);
  await page.goto("/#/explore");
  await expect(
    page.getByRole("link", { name: "Arşive sor", exact: true }),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
});
