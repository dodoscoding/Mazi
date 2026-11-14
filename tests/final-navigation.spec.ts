import { test, expect } from "@playwright/test";

test("returning member uses Globe and Photos with retained old links", async ({
  page,
}, info) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.goto("/");
  await expect(page.locator(".atlas-home")).toBeVisible();
  const nav = page
    .getByRole("navigation", { name: "Main navigation" })
    .filter({ visible: true })
    .first();
  for (const name of ["Globe", "Photos", "Add", "Settings"])
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(4);
  await page.screenshot({
    path: `work/poteto/app-simplification/screenshots/159-${info.project.name}-globe.png`,
  });
  await page.goto("/#/search?q=bicycle&years=2020&source=manual");
  await expect(page).toHaveURL(/#\/photos\?/);
  expect(
    new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("q"),
  ).toBe("bicycle");
  await expect(
    page.getByRole("searchbox", {
      name: "Fotoğraf ve konuşmalarda ara",
      exact: true,
    }),
  ).toHaveValue("bicycle");
  await page.screenshot({
    path: `work/poteto/app-simplification/screenshots/159-${info.project.name}-photos.png`,
  });
  await page.goto("/#/circle?section=plans&plan=unknown-plan");
  await expect(
    page.getByRole("heading", { name: "Bu bağlantı artık kullanılamıyor" }),
  ).toBeVisible();
  await expect(page.locator(".viewer")).toHaveCount(0);
  await page.goto("/#/memories?story=unknown-story");
  await expect(page).toHaveURL(/#\/past-creations\?story=unknown-story/);
  await expect(page.getByText(/unavailable/i).first()).toBeVisible();
});
