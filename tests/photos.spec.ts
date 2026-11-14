import { test, expect } from "@playwright/test";

test("Photos opens from Globe as individual photographs grouped by newest month", async ({
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
  await page.goto("/#/atlas");
  const open = page.getByRole("link", {
    name: "Fotoğraflarda gezin",
    exact: true,
  });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page).toHaveURL(/#\/photos$/);
  await expect(
    page.getByRole("heading", { name: "Fotoğraflar", level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(3);
  await expect(page.locator(".photo-month h2")).toHaveText(["Ocak 2024"]);
  await expect(
    page.getByRole("group", { name: "Görünüm", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Etkin filtreler" }),
  ).toBeVisible();
  const selected = page.locator('.mem-tile[href*="photo=1"]').first();
  await selected.click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/photos$/);
  await expect(selected).toBeFocused();
});
