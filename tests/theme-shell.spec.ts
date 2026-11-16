import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Sample", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 600;

async function openHome(page: Page) {
  await page.goto("/?demo=1");
  await expect(page.getByText("Drawing your atlas…")).toHaveCount(0);
  await expect(page.locator(".featured .photo-frame")).toHaveClass(/is-loaded/);
}

test("night is the only theme and an old day choice is cleared", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("mazi.theme", "day");
    }
  });
  await openHome(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  expect(await page.evaluate(() => localStorage.getItem("mazi.theme"))).toBe(
    null,
  );
  if (isPhone(page))
    await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Switch to/ })).toHaveCount(0);
  await page.goto("/?demo=1#/about");
  await expect(page.getByRole("radiogroup", { name: "Theme" })).toHaveCount(0);
});

test("the theme renders without storage", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openHome(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  expect(errors).toEqual([]);
});

test("the phone tab bar reaches Imports in one tap and About in two", async ({
  page,
}) => {
  test.skip(!isPhone(page), "The tab bar is the phone navigation.");
  await openHome(page);
  const tabs = page.getByRole("navigation", { name: "Main navigation" });
  await expect(tabs).toBeVisible();
  await tabs.getByRole("link", { name: "My Imports" }).click();
  await expect(page).toHaveURL(/#\/imports/);
  await expect(tabs.getByRole("link", { name: "My Imports" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const more = tabs.getByRole("button", { name: "More", exact: true });
  await more.click();
  const sheet = page.getByRole("dialog", { name: "More" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await sheet.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/#\/about/);
  await expect(sheet).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "A private atlas for one circle of friends",
    }),
  ).toBeVisible();
  await expect(tabs).toBeVisible();
});

test("Archive tools opens, is keyboard operable and closes on Escape", async ({
  page,
}) => {
  test.skip(isPhone(page), "Phones reach the archive tools through More.");
  await openHome(page);
  const button = page.getByRole("button", { name: "Archive tools" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const tools = page.getByRole("navigation", { name: "Archive tools" });
  await expect(tools.getByRole("link", { name: "Explore" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(tools.getByRole("link", { name: "Memories" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(tools.getByRole("link", { name: "Discover" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    tools.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(tools.getByRole("link", { name: "Explore" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(tools).toHaveCount(0);
  await expect(button).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/discover/);
  await expect(tools).toHaveCount(0);
});

test("Home has no axe violations", async ({ page }) => {
  // The first-visit Atlas intro fades the HUD in; this audit is of the settled Home.
  await page.addInitScript(() => sessionStorage.setItem("mazi.intro", "seen"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  for (const theme of ["night"] as const) {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${theme} theme`).toEqual([]);
  }
});

test("a mouse click on an Archive tools link lands even when clicks do not focus", async ({
  page,
}) => {
  test.skip(isPhone(page), "Phones reach the archive tools through More.");
  await openHome(page);
  await page.getByRole("button", { name: "Archive tools" }).click();
  const tools = page.getByRole("navigation", { name: "Archive tools" });
  const first = tools.getByRole("link", { name: "Explore" });
  await expect(first).toBeFocused();
  // Safari and macOS Firefox blur the focused item without focusing the target.
  await first.evaluate((link) =>
    link.addEventListener("mousedown", (event) => event.preventDefault()),
  );
  const places = tools.getByRole("link", { name: "Places & sources" });
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await places.click();
  await expect(page).toHaveURL(/#\/places/);
});

test("the open Archive tools menu has no axe violations", async ({ page }) => {
  test.skip(isPhone(page), "Phones reach the archive tools through More.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  await page.goto("/?demo=1#/memories");
  const button = page.getByRole("button", { name: "Archive tools" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .getByRole("navigation", { name: "Archive tools" })
      .getByRole("link", { name: "Explore" }),
  ).toBeFocused();
  const results = await new AxeBuilder({ page })
    .include(".menu-popover")
    .analyze();
  expect(results.violations).toEqual([]);
});
