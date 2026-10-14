import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

const evidence = "work/poteto/luminous-night/evidence/pr4";

const photo = (name: string, caption: string) => ({
  src: `/media/${name}.webp`,
  alt: `Synthetic ${name} photograph`,
  caption,
});
const place = (
  name: string,
  country: string,
  latitude: number,
  longitude: number,
) => ({
  name,
  country,
  latitude,
  longitude,
});

/** A synthetic shared archive, served in place of /api/atlas. */
const archive = [
  {
    id: "harbour-night",
    kind: "memory",
    source: "whatsapp",
    dateBasis: "source capture evidence, undated",
    shortTitle: "Harbour night",
    title: "The harbour after the last ferry",
    date: "2024-07-12",
    year: 2024,
    approximate: true,
    by: "Your circle",
    description: "An approved shared memory.",
    photos: [
      photo("ferry", "Dinner on the terrace"),
      photo("harbor", "The ferry leaving"),
      photo("table", "The table afterwards"),
    ],
    messages: [
      {
        name: "Maya",
        time: "2024-07-12 21:14",
        text: "Anyone checked the ferry time?",
      },
      {
        name: "Alex",
        time: "2024-07-12 21:18",
        text: "Worth missing the ferry for.",
      },
    ],
    place: place("Naxos", "GR", 37.1036, 25.3766),
    people: { shared: ["Maya"], conversation: ["Alex", "Maya"] },
  },
  {
    id: "city-spring",
    kind: "memory",
    source: "manual",
    dateBasis: "source capture evidence",
    shortTitle: "City spring",
    title: "A spring evening in the old town",
    date: "2024-03-01",
    year: 2024,
    approximate: false,
    by: "Your circle",
    description: "An approved shared memory.",
    photos: [photo("birthday", "Everyone in the kitchen")],
    messages: [],
    place: place("Nicosia", "CY", 35.1856, 33.3823),
    people: { shared: ["Deniz"], conversation: [] },
  },
  {
    id: "naxos-morning",
    kind: "memory",
    source: "discord, manual",
    dateBasis: "reviewed correction",
    shortTitle: "Naxos morning",
    title: "Morning swim below the old port",
    date: "2023-06-02",
    year: 2023,
    approximate: false,
    by: "Your circle",
    description: "An approved shared memory.",
    photos: [photo("lake", "Cold water, warm stones")],
    messages: [],
    place: place("Naxos", "GR", 37.1036, 25.3766),
    people: { shared: ["Alex", "Maya"], conversation: [] },
  },
  {
    id: "photo-broken",
    kind: "photo",
    source: "manual",
    dateBasis: "undated",
    shortTitle: "Missing rendition",
    title: "Missing rendition",
    date: "Date not recorded",
    year: null,
    approximate: true,
    by: "Your circle",
    description: "A photograph from your shared archive.",
    photos: [photo("does-not-exist", "Untitled photograph")],
    messages: [],
    place: null,
    people: { shared: ["Alex"], conversation: [] },
  },
];

const isPhone = (testInfo: TestInfo) => testInfo.project.name === "phone";

async function enter(page: Page) {
  const login = await page.request.post("/api/entry", {
    data: { name: "Sample", code: "synthetic-shared-code" },
  });
  expect(login.ok()).toBe(true);
  const { group_id: group } = await login.json();
  await page.route("**/api/groups", (route) =>
    route.fulfill({
      json: [{ id: group, name: "Synthetic circle", role: "member" }],
    }),
  );
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({ json: { memories: archive } }),
  );
}

async function open(page: Page, path: string) {
  await page.goto(`/#${path}`);
  await expect(page.locator("h1")).toBeVisible();
}

/** Waits until no animation runs, so axe and screenshots see final colours. */
async function settled(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.waitForFunction(() =>
    document.getAnimations().every((item) => item.playState !== "running"),
  );
}

const counter = (page: Page) => page.locator(".viewer-count");

test.beforeEach(async ({ page }) => enter(page));

test("buttons and arrow keys move between photos and keep ?photo=n", async ({
  page,
}) => {
  await open(page, "/memory/harbour-night");
  await expect(counter(page)).toHaveText("1 / 3");
  await expect(
    page.getByRole("button", { name: "Previous photo" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next photo" }).click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/memory\/harbour-night\?photo=1$/);
  await expect(page.locator(".viewer-caption-title")).toHaveText(
    "The ferry leaving",
  );
  await page.getByRole("button", { name: "Previous photo" }).click();
  await expect(counter(page)).toHaveText("1 / 3");
  await expect(page).toHaveURL(/photo=0$/);

  await page.getByRole("region", { name: "Memory photographs" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("3 / 3");
  await expect(page).toHaveURL(/photo=2$/);
  await page.keyboard.press("ArrowRight");
  await expect(counter(page)).toHaveText("3 / 3");
  await page.keyboard.press("ArrowLeft");
  await expect(counter(page)).toHaveText("2 / 3");
  await expect(page).toHaveURL(/photo=1$/);

  await page.reload();
  await expect(counter(page)).toHaveText("2 / 3");
});

test("the filmstrip chooses a photo on wider screens", async ({
  page,
}, testInfo) => {
  test.skip(
    isPhone(testInfo),
    "The phone viewer swipes instead of a filmstrip.",
  );
  await open(page, "/memory/harbour-night");
  await page
    .getByRole("button", { name: "Photo 3: The table afterwards" })
    .click();
  await expect(counter(page)).toHaveText("3 / 3");
  await expect(
    page.getByRole("button", { name: "Photo 3: The table afterwards" }),
  ).toHaveAttribute("aria-pressed", "true");
});

async function swipe(
  page: Page,
  from: number,
  to: number,
  check?: () => Promise<void>,
) {
  const box = (await page.locator(".viewer-surface").boundingBox())!;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: point(from),
  });
  const steps = 8;
  for (let step = 1; step <= steps; step++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(from + ((to - from) * step) / steps),
    });
  await check?.();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

test("touch swipe tracks the finger and changes photo, also with reduced motion", async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo), "Swipe is a touch gesture.");
  await open(page, "/memory/harbour-night");
  await expect(page.locator(".viewer .photo-frame")).toHaveClass(/is-loaded/);
  await swipe(page, 300, 100, async () => {
    await expect(page.locator(".viewer-track")).toHaveAttribute(
      "style",
      /translateX\(-200px\)/,
    );
  });
  await expect(counter(page)).toHaveText("2 / 3");
  await expect(page).toHaveURL(/photo=1$/);
  await swipe(page, 100, 330);
  await expect(counter(page)).toHaveText("1 / 3");
  await expect(page).toHaveURL(/photo=0$/);

  // A short drag springs back without changing photo.
  await swipe(page, 200, 170);
  await expect(counter(page)).toHaveText("1 / 3");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await swipe(page, 300, 80);
  await expect(counter(page)).toHaveText("2 / 3");
});

test("an approximate date reads About with the uncertainty chip and basis", async ({
  page,
}) => {
  await open(page, "/memory/harbour-night");
  const chip = page.locator(".date-chip");
  await expect(chip).toHaveText(/^About /);
  await expect(chip).toHaveClass(/is-uncertain/);
  const when = page.getByRole("region", { name: "When" });
  await expect(when).toContainText("About");
  await expect(when.getByRole("note")).toContainText("Date uncertain.");
  await expect(when.getByRole("note")).toContainText(
    "Some photos have no capture date.",
  );
  await expect(
    when.getByRole("link", { name: "Fix the date in Archive review" }),
  ).toBeVisible();

  await open(page, "/memory/naxos-morning");
  await expect(page.locator(".date-chip")).not.toHaveText(/About/);
  await expect(page.locator(".date-chip")).not.toHaveClass(/is-uncertain/);
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "When" })).toContainText(
    "Someone in the circle corrected the date in review.",
  );
});

test("place, people and sources show evidence in plain words", async ({
  page,
}) => {
  await open(page, "/memory/harbour-night");
  const where = page.getByRole("region", { name: "Where" });
  await expect(where).toContainText("Naxos, Greece");
  await expect(where).not.toContainText("GR");
  const people = page.getByRole("region", { name: "People in the evidence" });
  await expect(people).toContainText("Shared by");
  await expect(people).toContainText("Maya");
  await expect(people).toContainText("In the conversation");
  await expect(people).toContainText("Alex");
  await expect(page.locator("body")).not.toContainText(/were there|was there/i);
  const sources = page.getByRole("region", { name: "Source evidence" });
  await expect(sources).toContainText("WhatsApp export");
  await expect(sources).toContainText("3 photos");
  await expect(sources).toContainText(
    "Dates: source capture evidence, undated",
  );

  await page.getByRole("button", { name: "Show conversation" }).click();
  await expect(
    page.getByText("Worth missing the ferry for.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hide conversation" }).click();
  await expect(
    page.getByText("Worth missing the ferry for.", { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Review this archive" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Write a shared story" }),
  ).toBeVisible();
});

test("related memories put the same place first and open that memory", async ({
  page,
}) => {
  await open(page, "/memory/harbour-night");
  const related = page.getByRole("region", { name: "Related memories" });
  const links = related.getByRole("link");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toContainText("Same place");
  await expect(links.nth(0)).toContainText("Morning swim below the old port");
  await expect(links.nth(1)).toContainText("Same year");
  await expect(links.nth(1)).toContainText("A spring evening in the old town");
  await links.nth(0).click();
  await expect(page).toHaveURL(/#\/memory\/naxos-morning$/);
  await expect(
    page.getByRole("heading", { name: "Morning swim below the old port" }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Back to atlas" }).click();
  await expect(page).toHaveURL(/selected=naxos-morning/);
});

test("Escape goes back to the atlas with the memory selected", async ({
  page,
}) => {
  await open(page, "/memory/city-spring");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/\?selected=city-spring$/);
});

test("a broken photo URL shows the retry state", async ({ page }) => {
  await open(page, "/memory/photo-broken");
  await expect(page.getByText("This photo could not load.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry photo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Where" })).toContainText(
    "No place recorded",
  );
  await expect(page.locator(".date-chip")).toHaveText("Date not recorded");
  await page.getByRole("button", { name: "Retry photo" }).click();
  await expect(page.getByText("This photo could not load.")).toBeVisible();
});

for (const theme of ["night", "day"] as const)
  test(`memory screens pass axe in ${theme}`, async ({ page }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("mazi.theme", value),
      theme,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of [
      "/memory/harbour-night",
      "/memory/naxos-morning",
      "/memory/photo-broken",
      "/memory/missing",
    ]) {
      await open(page, path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await settled(page);
      expect(
        (await new AxeBuilder({ page }).analyze()).violations,
        `${path} in ${theme}`,
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });

test("capture memory evidence screenshots", async ({ page }, testInfo) => {
  test.skip(!process.env.MAZI_EVIDENCE, "Set MAZI_EVIDENCE=1 to capture.");
  const phone = isPhone(testInfo);
  await page.setViewportSize(
    phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  mkdirSync(evidence, { recursive: true });
  const size = phone ? "390" : "1440";
  const states: [string, string][] = [
    ["default", "/memory/naxos-morning"],
    ["uncertain", "/memory/harbour-night?photo=1"],
    ["error", "/memory/photo-broken"],
    ["not-found", "/memory/missing"],
  ];
  for (const theme of ["night", "day"]) {
    await page.goto("/");
    await page.evaluate(
      (value) => localStorage.setItem("mazi.theme", value),
      theme,
    );
    for (const [state, path] of states) {
      // A new query string forces a full load, so the stored theme applies.
      await page.goto(`/?evidence=${theme}#${path}`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await settled(page);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${evidence}/${state}-${theme}-${size}.jpg`,
        type: "jpeg",
        quality: 80,
      });
      if (state === "uncertain")
        await page.screenshot({
          path: `${evidence}/${state}-${theme}-${size}-full.jpg`,
          type: "jpeg",
          quality: 80,
          fullPage: true,
        });
    }
  }
});

test("capture memory evidence at the responsive widths", async ({
  page,
}, testInfo) => {
  test.skip(!process.env.MAZI_EVIDENCE, "Set MAZI_EVIDENCE=1 to capture.");
  test.skip(isPhone(testInfo), "Responsive widths are desktop captures.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  mkdirSync(evidence, { recursive: true });
  for (const width of [1680, 1150, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/?width=${width}#/memory/harbour-night?photo=1`);
    await expect(page.locator("h1")).toBeVisible();
    await settled(page);
    await page.screenshot({
      path: `${evidence}/uncertain-night-${width}-full.jpg`,
      type: "jpeg",
      quality: 80,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
