import { test, expect } from "@playwright/test";

test("returning member uses Globe and Photos with retained old links", async ({
  page,
}, info) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.addInitScript(() => sessionStorage.setItem("mazi.intro", "seen"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".atlas-home")).toBeVisible();
  const nav = page
    .getByRole("navigation", { name: "Main navigation" })
    .filter({ visible: true })
    .first();
  for (const name of ["Globe", "Photos", "Add", "Settings"])
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(page.locator(".atlas-stage")).toBeVisible();
  await expect(page.locator(".scene-loading")).toHaveCount(0, {
    timeout: 30000,
  });
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
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
  await page.goto("/#/photos?q=bicycle");
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await page.screenshot({
    path: `work/poteto/app-simplification/screenshots/159-${info.project.name}-photos.png`,
    fullPage: true,
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

test("explicit sample Photos shares fictional photographs without live archive requests", async ({
  page,
}) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  const reads: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(atlas|discovery|archive|sources)/.test(request.url()))
      reads.push(request.url());
  });
  await page.goto("/?demo=1#/photos");
  await expect(page.locator(".mem-tile").first()).toBeVisible();
  await page.locator(".mem-tile").first().click();
  await expect(page.locator(".viewer-track img").first()).toHaveAttribute(
    "src",
    /\/media\//,
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/photos/);
  expect(reads).toEqual([]);
});

test("invalid explicit memory and photograph selections never open another photograph", async ({
  page,
}) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.goto("/#/atlas?selected=unknown-memory");
  await expect(
    page.getByRole("heading", { name: "Fotoğraf kullanılamıyor", exact: true }),
  ).toBeVisible();
  await page.goto("/?demo=1#/memory/last-ferry?photo=999");
  await expect(page.locator(".viewer-track")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /bulunamadı/i }),
  ).toBeVisible();
});
