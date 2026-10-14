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

async function openAtlas(page: Page, url = "/?demo=1") {
  await page.goto(url);
  await expect(page.getByText("Drawing your atlas…")).toHaveCount(0);
  await expect(page.locator(".featured .photo-frame")).toHaveClass(/is-loaded/);
}

const places = (page: Page) =>
  page.getByRole("navigation", { name: "Places and moments" });

async function showSheet(page: Page) {
  if (!isPhone(page)) return;
  await page
    .getByRole("button", { name: "Show more places and memories" })
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
    page.getByRole("button", { name: "Select Lake days" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("arrow keys on the year scrubber step through the years", async ({
  page,
}) => {
  await skipIntro(page);
  await openAtlas(page);
  const year = page.getByRole("slider", { name: "Year" });
  await expect(year).toHaveAttribute("aria-valuenow", "2024");
  await year.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(year).toHaveAttribute("aria-valuenow", "2023");
  await expect(year).toHaveAttribute(
    "aria-valuetext",
    "2023, 1 place, 1 memory",
  );
  await expect(page).toHaveURL(/selected=lake-days/);
  await page.keyboard.press("ArrowLeft");
  await expect(year).toHaveAttribute("aria-valuenow", "2022");
  await expect(page.locator(".readout-year")).toHaveText("2022");
  await page.keyboard.press("End");
  await expect(year).toHaveAttribute("aria-valuenow", "2024");
  await expect(year).toBeFocused();
});

test("the portal opens with the dossier, Esc closes it and focus returns", async ({
  page,
}) => {
  await skipIntro(page);
  await openAtlas(page);
  const open = page.getByRole("link", { name: "Open memory", exact: true });
  await open.click();
  await expect(page).toHaveURL(/selected=last-ferry&view=portal/);
  const title = page.getByRole("heading", {
    name: "The night we missed the last ferry",
    level: 2,
  });
  await expect(title).toBeFocused();
  const dossier = page.getByRole("region", {
    name: "The night we missed the last ferry",
  });
  await expect(dossier).toContainText("About Summer 2024");
  await expect(dossier).toContainText("Naxos, Greece");
  await expect(dossier).toContainText("37.10° N · 25.38° E");
  await expect(dossier).toContainText("Shared by Deniz");
  await expect(dossier).toContainText(
    "In the conversation: Alex, Deniz, and Maya",
  );
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/view=portal/);
  await expect(dossier).toHaveCount(0);
  await expect(open).toBeFocused();

  // Enter on the current index row dives too, and Back returns to that row.
  await showSheet(page);
  const row = places(page).getByRole("button", { name: /^Naxos/ });
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(title).toBeVisible();
  await page.goBack();
  await expect(dossier).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("Open memory in the dossier reaches the full memory", async ({ page }) => {
  await skipIntro(page);
  await openAtlas(page);
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await page
    .getByRole("region", { name: "The night we missed the last ferry" })
    .getByRole("link", { name: "Open memory", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/memory\/last-ferry/);
  await expect(
    page.getByRole("heading", { name: "The night we missed the last ferry" }),
  ).toBeVisible();
});

test("scene=off shows the flat map with the same selection", async ({
  page,
}) => {
  await skipIntro(page);
  await openAtlas(page, "/?demo=1&scene=off#/?selected=lake-days");
  await expect(page.getByText("The atlas is in flat view.")).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Flat map .* Bohinj 2023 selected/ }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  const view = page.getByRole("group", { name: "View" });
  await expect(view.getByRole("button", { name: "Flat map" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".readout-year")).toHaveText("2023");
  await page.getByRole("button", { name: "Retry 3D view" }).click();
  await expect(page.getByText("The atlas is in flat view.")).toHaveCount(0);
  await expect(view.getByRole("button", { name: "Globe" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the first visit plays the intro once; Esc skips it", async ({ page }) => {
  // The intro runs on a clock from mount, so look for it before waiting on the globe.
  await page.goto("/?demo=1");
  const skip = page.getByRole("button", { name: "Skip intro" });
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
  await page.goto("/?demo=1");
  const home = page.locator(".atlas-home");
  await expect(home).toHaveAttribute("data-phase", "intro");
  await page.goto("/?demo=1#/memory/lake-days");
  await page.getByRole("link", { name: "Back to atlas" }).click();
  await expect(home).toBeVisible();
  // A replayed intro would end in "done"; a returning visit opens in "return".
  await expect(home).toHaveAttribute("data-phase", "return");
});

test("reduced motion holds the title briefly instead of the cinematic intro", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1");
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip intro" })).toHaveCount(
    0,
    { timeout: 4000 },
  );
  await expect(page.locator(".atlas-readout")).toHaveCSS("opacity", "1");
});

test("the phone sheet opens to show the index and memories", async ({
  page,
}) => {
  test.skip(!isPhone(page), "The bottom sheet is the phone layout.");
  await skipIntro(page);
  await openAtlas(page);
  const sheet = page.getByRole("region", { name: "Places and memories" });
  await expect(sheet).toHaveAttribute("data-snap", "0");
  await page
    .getByRole("button", { name: "Show more places and memories" })
    .click();
  await expect(sheet).toHaveAttribute("data-snap", "1");
  await expect(
    places(page).getByRole("button", { name: /^Nicosia/ }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "Show more places and memories" })
    .click();
  await expect(sheet).toHaveAttribute("data-snap", "2");
  await expect(
    page.getByRole("button", { name: "Select Birthday weekend" }),
  ).toBeInViewport();
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
  await expect(page).toHaveURL(/#\/search/);
});

test("the atlas, flat map and portal have no axe violations in night or day", async ({
  page,
}) => {
  await skipIntro(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["night", "day"] as const) {
    await page.addInitScript(
      (value) => localStorage.setItem("mazi.theme", value),
      theme,
    );
    await openAtlas(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(
      (await new AxeBuilder({ page }).analyze()).violations,
      `${theme} globe`,
    ).toEqual([]);
    await page.getByRole("button", { name: "Flat map" }).click();
    await expect(page.getByRole("img", { name: /Flat map/ })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).analyze()).violations,
      `${theme} flat map`,
    ).toEqual([]);
    await page.getByRole("link", { name: "Open memory", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "The night we missed the last ferry",
        level: 2,
      }),
    ).toBeFocused();
    await page.waitForTimeout(400);
    expect(
      (await new AxeBuilder({ page }).analyze()).violations,
      `${theme} portal`,
    ).toEqual([]);
  }
});

test("the Timeline shows the globe for the year in view, flat when 3D is off", async ({
  page,
}) => {
  await skipIntro(page);
  await page.goto("/?demo=1#/timeline");
  const panel = page.locator(".timeline-globe");
  // Headless Firefox on CI has no WebGL2; there the panel must lay flat instead.
  const webgl2 = await page.evaluate(
    () => !!document.createElement("canvas").getContext("webgl2"),
  );
  const expectScene = async () => {
    if (webgl2) await expect(panel.locator("canvas")).toHaveCount(1);
    else
      await expect(
        panel.getByText("3D isn't available here; same timeline, flat map."),
      ).toBeVisible();
  };
  await expectScene();
  await expect(page.getByText("Drawing your atlas…")).toHaveCount(0);
  await expect(panel).toHaveAttribute("data-year", "2022");
  await expect(panel).toContainText("Nicosia, Cyprus");
  if (isPhone(page))
    await page.getByRole("button", { name: "Next year, 2023" }).click();
  else {
    await page.getByRole("slider", { name: "Year" }).focus();
    await page.keyboard.press("ArrowRight");
  }
  await expect(panel).toHaveAttribute("data-year", "2023");
  await expect(panel).toContainText("Nicosia → Bohinj");
  await expectScene();

  await page.goto("/?demo=1&scene=off#/timeline");
  await expect(
    page.getByRole("img", { name: /Flat map .* Nicosia 2022 selected/ }),
  ).toBeVisible();
  await expect(
    page.getByText("3D isn't available here; same timeline, flat map."),
  ).toBeVisible();
});

test("reduced motion keeps the still year card in the Timeline", async ({
  page,
}) => {
  await skipIntro(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1#/timeline");
  const panel = page.locator(".timeline-globe");
  await expect(panel).toContainText("Nicosia, Cyprus");
  await expect(panel.locator("canvas")).toHaveCount(0);
});
