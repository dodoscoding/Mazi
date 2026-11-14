import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/entry", {
    data: { name: "Sample", code: "synthetic-shared-code" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("mazi.intro", "seen"));
});

test("four destinations put Globe and Photos first without competing inventories", async ({
  page,
}) => {
  await page.goto("/?demo=1#/");
  const navigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(navigation.getByRole("link")).toHaveText([
    "Globe",
    "Photos",
    "Add",
    "Settings",
  ]);
  await expect(page.locator(".atlas-stage")).toHaveCount(1);
  await expect(
    navigation.getByRole("link", { name: "Globe", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("link", { name: "Photos", exact: true }).click();
  await expect(page).toHaveURL(/#\/photos$/);
  await expect(
    page.getByRole("heading", { name: "Fotoğraflar", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile").first()).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Photos", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  for (const name of ["Keşfet", "Zaman çizelgesi", "Arşive sor", "Grubumuz"])
    await expect(
      navigation.getByRole("link", { name, exact: true }),
    ).toHaveCount(0);
});

test("Globe returns focus and scroll to the photograph opener", async ({
  page,
}) => {
  await page.goto("/?demo=1#/");
  const opener = page.getByRole("link", { name: "Anıyı aç", exact: true });
  await opener.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await opener.click();
  await expect(page.locator(".memory-detail")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Photos", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.locator(".back-pill").click();
  await expect(page).toHaveURL(/\?demo=1#\/$/);
  await expect(opener).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - scroll)).toBeLessThan(
    3,
  );
  await expect(page.locator(".atlas-stage")).toHaveCount(1);
});

test("legacy portal links retain their selection and return to canonical Globe", async ({
  page,
}) => {
  await page.goto("/?demo=1#/?selected=last-ferry&view=portal");
  await expect(page.locator(".dossier")).toBeVisible();
  await page
    .locator(".dossier")
    .getByRole("link", { name: "Anıyı aç", exact: true })
    .click();
  await page.getByRole("link", { name: "Kürede göster", exact: true }).click();
  await expect(page).toHaveURL(/#\/\?selected=last-ferry&photo=0$/);
  await expect(page.locator(".atlas-stage")).toHaveCount(1);
});

test("four destinations and account controls fit a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/?demo=1#/");
  const navigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  for (const name of ["Globe", "Photos", "Add", "Settings"]) {
    const link = navigation.getByRole("link", { name, exact: true });
    await link.click();
    await expect(link).toBeVisible();
    const bounds = await link.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
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

test("entering Globe from Photos starts at its heading", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto("/?demo=1#/photos");
  await page.locator(".mem-tile").last().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Globe", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Atlas", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("Globe distinguishes loading, retryable failure and an empty shared archive", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/atlas?*", async (route) => {
    requests++;
    if (requests === 1) {
      await gate;
      await route.fulfill({
        status: 503,
        json: { error: "Synthetic archive unavailable" },
      });
    } else await route.fulfill({ json: { memories: [] } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  try {
    await expect(
      page.getByText("Atlas yükleniyor", { exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: "Atlas yüklenemedi", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Atlas ilk anısını bekliyor",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Yeniden dene", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".atlas-stage")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Fotoğraf ekle", exact: true }),
  ).toHaveAttribute("href", "#/add");
  expect(requests).toBe(2);
});

test("sample Add and Settings never expose live archive controls", async ({
  page,
}) => {
  const privateReads: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(sources|imports|review|discovery)/.test(request.url()))
      privateReads.push(request.url());
  });
  await page.goto("/?demo=1#/");
  const nav = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  for (const name of ["Add", "Settings"]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Sample Atlas", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Canlı arşiv işlemleri örnek modunda açılmaz.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.locator("#upload, #source-form, #members")).toHaveCount(
      0,
    );
  }
  expect(privateReads).toEqual([]);
});
