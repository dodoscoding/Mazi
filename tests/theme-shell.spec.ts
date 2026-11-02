import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settled } from "./helpers/atlas";

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
  await expect(page.locator(".home-featured .photo-frame")).toHaveClass(
    /is-loaded/,
  );
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
  await page.getByRole("button", { name: "Hesap", exact: true }).click();
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

test("the phone has three tabs, one-tap Add and reachable account help", async ({
  page,
}) => {
  test.skip(!isPhone(page), "The tab bar is the phone navigation.");
  await openHome(page);
  const tabs = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(tabs.getByRole("link")).toHaveText([
    "Home",
    "Keşfet",
    "Grubumuz",
  ]);
  await page
    .locator(".site-header")
    .getByRole("link", { name: "Ekle", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/imports/);
  await expect(
    tabs.getByRole("link", { name: "Grubumuz", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const account = page.getByRole("button", { name: "Hesap", exact: true });
  await account.click();
  await expect(account).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(account).toHaveAttribute("aria-expanded", "false");
  await expect(account).toBeFocused();
  await account.click();
  await page
    .locator(".menu-popover")
    .getByRole("link", { name: "About", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/about/);
  await expect(
    page.getByRole("heading", {
      name: "A private atlas for one circle of friends",
    }),
  ).toBeVisible();
  await expect(tabs).toBeVisible();
});

test("account controls are keyboard operable and Escape returns focus", async ({
  page,
}) => {
  await openHome(page);
  const button = page.getByRole("button", { name: "Hesap", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator(".menu-popover");
  const about = menu.getByRole("link", { name: "About", exact: true });
  await expect(about).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("link", { name: "Replay introduction", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    menu.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(about).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/about/);
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("Home and Explore have no axe violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Keşfet", exact: true })
    .click();
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("a mouse click on account help lands even when clicks do not focus", async ({
  page,
}) => {
  await openHome(page);
  await page.getByRole("button", { name: "Hesap", exact: true }).click();
  const about = page
    .locator(".menu-popover")
    .getByRole("link", { name: "About", exact: true });
  await expect(about).toBeFocused();
  await about.evaluate((link) =>
    link.addEventListener("mousedown", (event) => event.preventDefault()),
  );
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await about.click();
  await expect(page).toHaveURL(/#\/about/);
});

test("the open account menu has no axe violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  await page.getByRole("button", { name: "Hesap", exact: true }).click();
  await settled(page);
  expect(
    (await new AxeBuilder({ page }).include(".menu-popover").analyze())
      .violations,
  ).toEqual([]);
});
