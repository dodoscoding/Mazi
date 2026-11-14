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
  await expect(page.locator(".mem-tile")).toHaveCount(8);
  await expect(page.locator(".photo-month h2")).toHaveText([
    "Nisan 2026",
    "Şubat 2025",
    "Ocak 2024",
    "Mart 2023",
    "Undated",
  ]);
  await expect(
    page.getByRole("group", { name: "Görünüm", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Diğer filtreler|Filtreler/,
      exact: false,
    }),
  ).toBeVisible();
  const selected = page.locator('.mem-tile[href*="photo=1"]').first();
  await selected.click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/photos$/);
  await expect(selected).toBeFocused();
});

test("Photos preserves year and compact filters across the viewer and keeps uncertain dates explicit", async ({
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
  await expect(
    page
      .getByRole("region", { name: "Undated", exact: true })
      .locator(".mem-tile"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("region", { name: "Nisan 2026", exact: true }),
  ).toContainText("Paylaşıldı · Çekim tarihi bilinmiyor");
  await expect(
    page.getByRole("region", { name: "Undated", exact: true }),
  ).toContainText("Çekim tarihi çelişkili");
  const year = page.getByRole("combobox", { name: "Yıl", exact: true });
  await year.selectOption("2024");
  await expect(page.locator(".mem-tile")).toHaveCount(3);
  await page.locator("#filters-open").click();
  const filters = page.getByRole("dialog", { name: "Filtreler", exact: true });
  await filters.getByLabel(/stanbul/).check();
  await filters
    .getByRole("button", { name: "1 fotoğrafı göster", exact: true })
    .click();
  await expect(filters).toHaveCount(0);
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  const origin = page.url();
  await page.locator(".mem-tile").click();
  await expect(page.locator(".viewer")).toBeVisible();
  await page
    .getByRole("link", { name: "Fotoğrafı kapat", exact: true })
    .click();
  await expect(page).toHaveURL(origin);
  await expect(year).toHaveValue("2024");
  await expect(page.locator(".mem-tile")).toBeFocused();
  await page
    .getByRole("button", { name: /Filtreyi kaldır: .*stanbul/ })
    .click();
  await year.selectOption("undated");
  await expect(page.locator(".mem-tile")).toHaveCount(2);
  await expect(page.locator(".photo-month h2")).toHaveText(["Undated"]);
  await expect(page.locator("#grid-summary")).toHaveText(
    "2 eşleşen fotoğraf · 8 görünür fotoğraf",
  );
  await page.screenshot({
    path: `work/poteto/app-simplification/photos-undated-${info.project.name}.png`,
    fullPage: true,
  });
});
