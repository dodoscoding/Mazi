import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 600;

test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Sample", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
});

async function skipIntro(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem("mazi.intro", "seen"));
}

async function openAtlas(page: Page, url = "/?demo=1#/atlas") {
  await page.goto(url);
  await expect(page.getByText("Atlas hazırlanıyor…")).toHaveCount(0);
  await expect(page.locator(".featured .photo-frame")).toHaveClass(/is-loaded/);
}

const places = (page: Page) =>
  page.getByRole("navigation", { name: "Yerler ve anılar" });

async function showSheet(page: Page) {
  if (!isPhone(page)) return;
  await page
    .getByRole("button", { name: "Daha fazla yer ve anı göster" })
    .click();
}

test("choosing a place in the index selects its memory, year and URL", async ({
  page,
}) => {
  await skipIntro(page);
  await openAtlas(page);
  await expect(page.locator(".readout-year")).toHaveText("2024");
  await expect(
    places(page).getByRole("button", { name: /^Naxos/ }),
  ).toHaveAttribute("aria-current", "true");
  await showSheet(page);
  await places(page)
    .getByRole("button", { name: /^Bohinj/ })
    .click();
  await expect(page).toHaveURL(/selected=lake-days/);
  await expect(page.locator(".readout-year")).toHaveText("2023");
  await expect(
    page.getByRole("heading", { name: "Lake days", exact: true }),
  ).toBeVisible();
  await expect(
    places(page).getByRole("button", { name: /^Bohinj/ }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("button", { name: "Lake days anısını seç" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("arrow keys on the year scrubber step through the years", async ({
  page,
}) => {
  await skipIntro(page);
  await openAtlas(page);
  const year = page.getByRole("slider", { name: "Yıl" });
  await expect(year).toHaveAttribute("aria-valuenow", "2024");
  await year.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(year).toHaveAttribute("aria-valuenow", "2023");
  await expect(year).toHaveAttribute("aria-valuetext", "2023, 1 yer, 1 anı");
  await expect(page).toHaveURL(/selected=lake-days/);
  await page.keyboard.press("ArrowLeft");
  await expect(year).toHaveAttribute("aria-valuenow", "2022");
  await expect(page.locator(".readout-year")).toHaveText("2022");
  await page.keyboard.press("End");
  await expect(year).toHaveAttribute("aria-valuenow", "2024");
  await expect(year).toBeFocused();
});

test("Globe opens the shared viewer directly and Escape restores its opener", async ({
  page,
}) => {
  await skipIntro(page);
  await openAtlas(page);
  const open = page.getByRole("link", { name: "Anıyı aç", exact: true });
  await open.click();
  await expect(page).toHaveURL(/#\/memory\/last-ferry/);
  const title = page.getByRole("heading", {
    name: "The night we missed the last ferry",
    level: 1,
  });
  await expect(title).toBeFocused();
  await expect(
    page.getByRole("region", { name: "Ne zaman", exact: true }),
  ).toContainText("About Summer 2024");
  await expect(
    page.getByRole("region", { name: "Nerede", exact: true }),
  ).toContainText("Naxos, Greece");
  await page.keyboard.press("Escape");
  await expect(page.locator(".memory-detail")).toHaveCount(0);
  await expect(open).toBeFocused();
  await showSheet(page);
  const row = places(page).getByRole("button", { name: /^Naxos/ });
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(title).toBeVisible();
  await page.goBack();
  await expect(page.locator(".memory-detail")).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("a legacy dossier link retains access to the shared viewer", async ({
  page,
}) => {
  await skipIntro(page);
  await openAtlas(page, "/?demo=1#/?selected=last-ferry&view=portal");
  await page
    .locator(".dossier")
    .getByRole("link", { name: "Anıyı aç", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/memory\/last-ferry/);
  await expect(
    page.getByRole("heading", {
      name: "The night we missed the last ferry",
      level: 1,
    }),
  ).toBeVisible();
});

test("scene=off shows the flat map with the same selection", async ({
  page,
}) => {
  await skipIntro(page);
  await openAtlas(page, "/?demo=1&scene=off#/?selected=lake-days");
  await expect(
    page.getByText("Atlas düz haritada gösteriliyor."),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Flat map .* Bohinj 2023 selected/ }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  const view = page.getByRole("group", { name: "Görünüm" });
  await expect(
    view.getByRole("button", { name: "Düz harita" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".readout-year")).toHaveText("2023");
  await page.getByRole("button", { name: "3D görünümü yeniden dene" }).click();
  await expect(page.getByText("Atlas düz haritada gösteriliyor.")).toHaveCount(
    0,
  );
  await expect(view.getByRole("button", { name: "Küre" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the first visit plays the intro once; Esc skips it", async ({ page }) => {
  // The intro runs on a clock from mount, so look for it before waiting on the globe.
  await page.goto("/?demo=1#/atlas");
  const skip = page.getByRole("button", { name: "Tanıtımı atla" });
  await expect(skip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(skip).toHaveCount(0);
  await expect(page).not.toHaveURL(/view=portal/);
  await page.reload();
  await expect(page.locator(".featured .photo-frame")).toHaveClass(/is-loaded/);
  await expect(skip).toHaveCount(0);
});

test("leaving the atlas during the intro counts as seeing it", async ({
  page,
}) => {
  await page.goto("/?demo=1#/atlas");
  const home = page.locator(".atlas-home");
  await expect(home).toHaveAttribute("data-phase", "intro");
  await page.evaluate(() => {
    location.hash = "#/memory/lake-days";
  });
  await page.getByRole("link", { name: "Geri", exact: true }).click();
  await expect(home).toBeVisible();
  // A replayed intro would end in "done"; a returning visit opens in "return".
  await expect(home).toHaveAttribute("data-phase", "return");
});

test("reduced motion holds the title briefly instead of the cinematic intro", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1#/atlas");
  await expect(
    page.getByRole("button", { name: "Tanıtımı atla" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tanıtımı atla" })).toHaveCount(
    0,
    { timeout: 4000 },
  );
  await expect(page.locator(".atlas-readout")).toHaveCSS("opacity", "1");
});

test("the phone sheet opens to show the index and memories", async ({
  page,
}) => {
  test.skip(!isPhone(page), "The bottom sheet is the phone layout.");
  await page.setViewportSize({ width: 320, height: 740 });
  await skipIntro(page);
  await openAtlas(page, "/?demo=1&scene=off#/atlas");
  const sheet = page.getByRole("region", { name: "Yerler ve anılar" });
  await expect(sheet).toHaveAttribute("data-snap", "0");
  await expect(page.locator(".flat-note")).toBeVisible();
  await page
    .getByRole("button", { name: "Daha fazla yer ve anı göster" })
    .click();
  await expect(sheet).toHaveAttribute("data-snap", "1");
  await expect(page.locator(".flat-note")).toBeHidden();
  await expect(
    places(page).getByRole("button", { name: /^Nicosia/ }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "Daha fazla yer ve anı göster" })
    .click();
  await expect(sheet).toHaveAttribute("data-snap", "2");
  await expect(
    page.getByRole("button", { name: "Birthday weekend anısını seç" }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Paneli küçült" }).click();
  await expect(sheet).toHaveAttribute("data-snap", "0");
  await expect(page.locator(".flat-note")).toBeVisible();
});

test("slash opens search and arrow keys walk places from the page", async ({
  page,
}) => {
  test.skip(isPhone(page), "Keyboard shortcuts are exercised on desktop.");
  await skipIntro(page);
  await openAtlas(page);
  await page.locator("main").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/selected=lake-days/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/selected=last-ferry/);
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/#\/photos/);
});

test("the atlas, flat map and portal have no axe violations", async ({
  page,
}) => {
  const settleAnimations = () =>
    page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
  await skipIntro(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["night"] as const) {
    await page.addInitScript(
      (value) => localStorage.setItem("mazi.theme", value),
      theme,
    );
    await openAtlas(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await settleAnimations();
    expect(
      (await new AxeBuilder({ page }).analyze()).violations,
      `${theme} globe`,
    ).toEqual([]);
    await page.getByRole("button", { name: "Düz harita" }).click();
    await expect(page.getByRole("img", { name: /Flat map/ })).toBeVisible();
    await settleAnimations();
    expect(
      (await new AxeBuilder({ page }).analyze()).violations,
      `${theme} flat map`,
    ).toEqual([]);
    await page.getByRole("link", { name: "Anıyı aç", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "The night we missed the last ferry",
        level: 1,
      }),
    ).toBeFocused();
    await settleAnimations();
    expect(
      (await new AxeBuilder({ page }).analyze()).violations,
      `${theme} portal`,
    ).toEqual([]);
  }
});

test("legacy Timeline links reach Photos without rebuilding a second globe", async ({
  page,
}) => {
  await skipIntro(page);
  await page.goto("/?demo=1#/timeline");
  await expect(page).toHaveURL(/#\/photos/);
  await expect(
    page.getByRole("heading", { name: "Fotoğraflar", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile").first()).toBeVisible();
  await expect(page.locator(".timeline-globe, .atlas-stage")).toHaveCount(0);
  await page.goto("/?demo=1&scene=off#/");
  await expect(
    page.getByRole("img", { name: /Flat map .* Naxos 2024 selected/ }),
  ).toBeVisible();
});

test("reduced-motion Photos keeps sample chronology explicitly undated", async ({
  page,
}) => {
  await skipIntro(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1#/timeline");
  await expect(
    page.getByRole("region", { name: "Undated", exact: true }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".mem-tile").first()).toBeVisible();
});

test("sharing-only same-year memories replay independently with explicit date basis", async ({
  page,
}, testInfo) => {
  await skipIntro(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  const base = {
    kind: "photo",
    source: "whatsapp",
    date: "Date not recorded",
    year: null,
    approximate: false,
    by: "Circle",
    description: "Synthetic",
    place: null,
    people: { shared: [], conversation: [] },
    messages: [],
  };
  const memories = [1, 2, 3].map((i) => ({
    ...base,
    id: `shared-${i}`,
    shortTitle: `Shared ${i}`,
    title: `Shared ${i}`,
    photos: [
      {
        src: "/media/ferry.webp",
        alt: "Synthetic",
        caption: "",
        provenance: [
          {
            sender: "Ana",
            source: "whatsapp",
            sharedAt: {
              local: `2025-01-0${i}T12:00:00`,
              raw: null,
              precision: "second",
              ambiguous: false,
            },
          },
        ],
      },
    ],
  }));
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({ json: { memories } }),
  );
  await page.goto("/#/?selected=shared-3");
  await expect(page.locator(".readout-year")).toHaveText("2025");
  await expect(page.locator(".readout-summary")).toContainText("Shared on");
  await expect(page.getByText("Atlas hazırlanıyor…")).toHaveCount(0);
  await page.getByRole("button", { name: "Düz harita", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("sharing-chronology.png"),
  });
  const replay = page.getByRole("button", {
    name: "Yeniden oynat",
    exact: true,
  });
  await expect(replay).toBeEnabled();
  await replay.click();
  await expect(page).toHaveURL(/selected=shared-1/);
  await page.clock.runFor(1500);
  await expect(page).toHaveURL(/selected=shared-2/);
  await page.getByRole("button", { name: "Duraklat", exact: true }).click();
  await page.clock.runFor(1600);
  await expect(page).toHaveURL(/selected=shared-2/);
  await replay.click();
  await page.clock.runFor(1500);
  await expect(page).toHaveURL(/selected=shared-3/);
  await page.clock.runFor(1500);
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(page).toHaveURL(/selected=shared-1/);
});
