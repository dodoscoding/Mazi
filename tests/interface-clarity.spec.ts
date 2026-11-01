import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/entry", {
    data: { name: "Sample", code: "synthetic-shared-code" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("three primary destinations and a quiet Home make the archive findable", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  const navigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(navigation.getByRole("link")).toHaveText([
    "Home",
    "Keşfet",
    "Grubumuz",
  ]);
  await expect(
    page.getByRole("link", { name: "Ekle", exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".atlas-stage")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Arşivden anılar", exact: true }),
  ).toBeVisible();
  await navigation.getByRole("link", { name: "Keşfet", exact: true }).click();
  await expect(page).toHaveURL(/#\/explore$/);
  for (const name of [
    "Anı ara",
    "Atlas",
    "Zaman çizelgesi",
    "Kişiler",
    "Hikâyeler",
    "Yıllık özet",
    "Zaman kapsülleri",
  ]) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(
    navigation.getByRole("link", { name: "Keşfet", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
