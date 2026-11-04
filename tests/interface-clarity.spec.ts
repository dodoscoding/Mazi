import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/entry", {
    data: { name: "Sample", code: "synthetic-shared-code" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("three primary destinations and a quiet Home make the archive findable", async ({
  page,
}, testInfo) => {
  await page.goto("/?demo=1");
  const navigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(navigation.getByRole("link")).toHaveText([
    "Ana sayfa",
    "Keşfet",
    "Grubumuz",
  ]);
  await expect(
    page.getByRole("button", { name: "Ekle", exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".atlas-stage")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".home-featured")).toHaveCount(1);
  await expect(page.locator(".home-memory, .home-contribute")).toHaveCount(0);
  const detailLinks = await page
    .locator(".home-featured a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(detailLinks).size).toBe(1);
  await page.screenshot({
    path: `work/poteto/social-navigation/home-${testInfo.project.name}.png`,
    fullPage: true,
    scale: "css",
  });
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
    await expect(
      page
        .getByRole("navigation", { name: "Keşfet araçları" })
        .getByRole("link", { name, exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: `work/poteto/social-navigation/explore-${testInfo.project.name}.png`,
    fullPage: true,
    scale: "css",
  });
  for (const name of ["Bul", "Gez", "Birlikte hatırla"])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Keşfet", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("Home returns focus and scroll to the archive link that opened a memory", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  const opener = page.locator("#home-featured-title");
  await opener.scrollIntoViewIfNeeded();
  const openerId = await opener.getAttribute("id");
  const scroll = await page.evaluate(() => scrollY);
  await opener.click();
  await expect(page.locator(".memory-detail")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Keşfet", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.locator(".back-pill").click();
  await expect(page).toHaveURL(/\/\?demo=1$/);
  await expect(page.locator(`[id="${openerId}"]`)).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - scroll)).toBeLessThan(
    3,
  );
  await expect(page.locator(".atlas-stage")).toHaveCount(0);
});

test("legacy portal links remain Atlas entries and globe links use the canonical route", async ({
  page,
}) => {
  await page.goto("/?demo=1#/?selected=last-ferry&view=portal");
  await expect(page.locator(".dossier")).toBeVisible();
  await page
    .locator(".dossier")
    .getByRole("link", { name: "Open memory", exact: true })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Keşfet", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("link", { name: "Show on the globe", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/atlas\?selected=last-ferry$/);
  await expect(page.locator(".atlas-stage")).toHaveCount(1);
});

test("the three destinations and contribution action fit a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/?demo=1");
  for (const path of ["/", "/explore"]) {
    if (path === "/explore")
      await page
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("link", { name: "Keşfet", exact: true })
        .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const add = page
      .locator(".site-header")
      .getByRole("button", { name: "Ekle", exact: true });
    await expect(add).toBeVisible();
    const bounds = await add.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Hesap", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Hesap araçları" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("entering Home from another section starts at its heading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto("/?demo=1#/explore");
  await page
    .getByRole("navigation", { name: "Keşfet araçları" })
    .getByRole("link")
    .last()
    .scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Ana sayfa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Birlikte hatırlayalım", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("Home distinguishes loading, retryable failure and an empty shared archive", async ({
  page,
}) => {
  let release!: () => void;
  const firstResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/atlas?*", async (route) => {
    requests++;
    if (requests === 1) {
      await firstResponse;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic archive unavailable" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ memories: [] }),
      });
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Anılar yükleniyor…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "İlk anımızı ekleyelim", exact: true }),
  ).toHaveCount(0);
  release();
  await expect(
    page.getByRole("heading", { name: "Arşiv şu anda açılamadı", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "İlk anımızı ekleyelim", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fotoğraf veya arşiv ekle", exact: true }),
  ).toHaveAttribute("href", "#/imports");
  await expect(
    page.getByRole("button", { name: "Yeniden dene", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".atlas-stage")).toHaveCount(0);
  expect(requests).toBe(2);
});

test("main Home from a memory starts at the top instead of restoring an old card", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  const opener = page.locator("#home-featured-title");
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  await expect(page.locator(".memory-detail")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Ana sayfa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Birlikte hatırlayalım", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
