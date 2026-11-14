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

test("Photos searches photographs first and opens actual text-only Conversation context", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/photos?q=ferry");
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  const conversations = page.getByRole("region", {
    name: "Konuşma sonuçları",
    exact: true,
  });
  await expect(conversations).toBeVisible();
  const result = conversations.getByRole("button", {
    name: /The lanterns are ready/,
  });
  await expect(result).toBeVisible();
  expect((await page.locator("#grid").boundingBox())!.y).toBeLessThan(
    (await conversations.boundingBox())!.y,
  );
  await result.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await result.click();
  const context = page.getByRole("region", {
    name: "Kaynak konuşma bağlamı",
    exact: true,
  });
  await expect(context).toBeVisible();
  await expect(context).toContainText("Lena");
  await expect(context).toContainText("Bring the paper map to the ferry.");
  await expect(context).toContainText("lantern-chat.txt#line:1");
  await expect(context.locator("img, a[href*='/memory/']")).toHaveCount(0);
  await page.screenshot({
    path: `work/poteto/app-simplification/search-context-${info.project.name}.png`,
    fullPage: true,
  });
  await context
    .getByRole("button", { name: "Bağlamı kapat", exact: true })
    .click();
  await expect(context).toBeHidden();
  await expect(result).toBeFocused();
  await expect(
    page.getByRole("searchbox", {
      name: "Fotoğraf ve konuşmalarda ara",
      exact: true,
    }),
  ).toHaveValue("ferry");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
});
