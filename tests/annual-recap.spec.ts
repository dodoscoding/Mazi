import { test, expect } from "@playwright/test";

test("Annual recap opens from a Photos year card in capture order and restores its viewer origin", async ({
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
  await page.goto("/#/photos");
  await page
    .getByRole("combobox", { name: "Yıl", exact: true })
    .selectOption("2024");
  const card = page.getByRole("link", {
    name: "Annual recap 2024",
    exact: true,
  });
  await expect(card).toBeVisible();
  await card.click();
  await expect(
    page.getByRole("heading", {
      name: "Annual recap 2024",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.locator(".photo-month h2")).toHaveText(["Ocak 2024"]);
  expect(
    await page
      .locator(".mem-tile img")
      .evaluateAll((images) => images.map((img) => img.getAttribute("alt"))),
  ).toEqual([
    "Bicycle beside the sea",
    "Garden in the morning",
    "Dinner with friends",
  ]);
  const photo = page
    .locator(".mem-tile")
    .filter({
      has: page.getByRole("img", { name: "Dinner with friends", exact: true }),
    });
  await photo.scrollIntoViewIfNeeded();
  const origin = page.url();
  const position = await page.evaluate(() => scrollY);
  await photo.click();
  await expect(page.locator(".viewer-caption-text")).toContainText(
    "Dinner with friends",
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(origin);
  await expect(photo).toBeFocused();
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => scrollY)) - position))
    .toBeLessThan(3);
  await page.screenshot({
    path: `work/poteto/app-simplification/recap-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});
