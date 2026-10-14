import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const CODE = "synthetic-shared-code";
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 600;
const beatTitles = [
  "Everywhere we went, kept where it happened",
  "What you add is shared straight away",
  "Turn the globe, travel the years",
  "Open a place to step into the memory",
];

async function useTheme(page: Page, theme: "night" | "day") {
  await page.addInitScript(
    (value) => localStorage.setItem("mazi.theme", value),
    theme,
  );
}

async function enterAsNewMember(page: Page, label: string) {
  await page.goto("/");
  await page
    .getByLabel("Your name")
    .fill(`${label} ${test.info().project.name} ${Date.now()}`);
  await page.getByLabel("Shared code").fill(CODE);
  await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
  await expectBeat(page, 0);
}

async function expectBeat(page: Page, index: number) {
  await expect(
    page.getByRole("heading", { level: 1, name: beatTitles[index] }),
  ).toBeVisible();
  await expect(page.getByText(`Step ${index + 1} of 4`).first()).toBeAttached();
}

async function swipe(page: Page, from: number, to: number) {
  const client = await page.context().newCDPSession(page);
  const y = 420;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from, y }],
  });
  for (const step of [0.25, 0.5, 0.75, 1])
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from + (to - from) * step, y: y + 4 * step }],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

test("a wrong code shows the designed alert and never shows a code", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Welcome back to everywhere we have been."),
  ).toBeVisible();
  await expect(
    page.getByText("No email. No password. Nobody outside the circle."),
  ).toBeVisible();
  await expect(page.getByLabel("Your name in the circle")).toBeVisible();
  await page.getByLabel("Your name").fill("Wrong code visitor");
  const code = page.getByLabel("Shared code");
  await code.fill("saltwater");
  await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("That code doesn't open a circle.");
  await expect(alert).toContainText("Check it with whoever invited you.");
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await expect(code).toHaveAccessibleDescription(/doesn't open a circle/);
  await expect(page.locator("body")).not.toContainText(/prototype only/i);
  await expect(page.locator("body")).not.toContainText(CODE);
  await code.fill(CODE);
  await expect(code).toHaveAttribute("aria-invalid", "false");
});

test("a removed member sees access removed and can try another code", async ({
  page,
}) => {
  await page.route("**/api/entry", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "Group access denied" }),
    }),
  );
  await page.goto("/");
  await page.getByLabel("Your name").fill("Removed member");
  await page.getByLabel("Shared code").fill(CODE);
  await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Access removed");
  await expect(alert).toContainText("You're no longer in this circle");
  await expect(page.getByLabel("Shared code")).toHaveCount(0);
  await page.getByRole("button", { name: "Enter a different code" }).click();
  await expect(page.getByLabel("Shared code")).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("the beats advance by button and keyboard and the last one opens the Atlas", async ({
  page,
}) => {
  await enterAsNewMember(page, "Beats");
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expectBeat(page, 1);
  await expect(page.getByRole("note")).toContainText(
    "There is no private draft.",
  );
  await page.keyboard.press("ArrowRight");
  await expectBeat(page, 2);
  await expect(page.getByText("change the year")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expectBeat(page, 1);
  await page.getByRole("button", { name: "Back" }).click();
  await expectBeat(page, 0);
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeFocused();
  for (const index of [1, 2, 3]) {
    await page.keyboard.press("ArrowRight");
    await expectBeat(page, index);
  }
  await page.keyboard.press("ArrowRight");
  await expectBeat(page, 3);
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toHaveCount(0);
  const open = page.getByRole("button", {
    name: "Open the Atlas",
    exact: true,
  });
  await expect(open).toHaveCount(1);
  await open.click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: beatTitles[0] })).toHaveCount(
    0,
  );
});

test("phone members swipe between beats", async ({ page }) => {
  test.skip(!isPhone(page), "Swipe is the phone gesture.");
  await enterAsNewMember(page, "Swipe");
  await swipe(page, 320, 80);
  await expectBeat(page, 1);
  await swipe(page, 320, 80);
  await expectBeat(page, 2);
  await swipe(page, 80, 320);
  await expectBeat(page, 1);
  await swipe(page, 200, 190);
  await expectBeat(page, 1);
});

test("beats slide in normal motion and crossfade under reduced motion", async ({
  page,
}) => {
  await enterAsNewMember(page, "Motion");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const current = page.locator(".intro-copy.is-current");
  const motion = () =>
    current.evaluate((node) => {
      const style = getComputedStyle(node);
      return `${style.animationName} ${style.animationDuration}`;
    });
  expect(await motion()).toBe("intro-arrive 0.48s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expectBeat(page, 2);
  expect(await motion()).toBe("intro-fade 0.2s");
  await expectBeat(page, 2);
});

for (const theme of ["night", "day"] as const)
  test(`entry and introduction have no axe violations in ${theme}`, async ({
    page,
  }) => {
    await useTheme(page, theme);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByLabel("Shared code")).toBeVisible();
    await axe(page);
    await page.getByLabel("Your name").fill("Axe visitor");
    await page.getByLabel("Shared code").fill("wrong");
    await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await axe(page);
    await page.getByLabel("Shared code").fill(CODE);
    await page.getByLabel("Your name").fill(`Axe ${theme} ${Date.now()}`);
    await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
    for (const index of [0, 1, 2, 3]) {
      await expectBeat(page, index);
      await page.waitForTimeout(520);
      await axe(page);
      if (index < 3) await page.keyboard.press("ArrowRight");
    }
  });

test("the entry theme toggle switches to day and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to day" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await page.getByRole("button", { name: "Switch to night" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
});

const evidence = "work/poteto/luminous-night/evidence/pr7";
test("captures evidence screenshots", async ({ page }) => {
  test.skip(!process.env.MAZI_EVIDENCE, "Set MAZI_EVIDENCE=1 to capture.");
  test.setTimeout(120000);
  const device = isPhone(page) ? "phone" : "desktop";
  await page.setViewportSize(
    device === "phone"
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
  );
  const shot = (name: string) =>
    page.screenshot({
      path: `${evidence}/${name}-${device}-${theme}.jpg`,
      type: "jpeg",
      quality: 80,
    });
  let theme: "night" | "day" = "night";
  for (theme of ["night", "day"] as const) {
    await page.goto("/");
    await page.evaluate((value) => {
      localStorage.setItem("mazi.theme", value);
    }, theme);
    await page.reload();
    await expect(page.getByLabel("Shared code")).toBeVisible();
    await page.getByLabel("Your name").fill("Eleni");
    await shot("entry");
    await page.getByLabel("Shared code").fill("saltwater");
    await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await shot("entry-wrong-code");
    await page.route("**/api/entry", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Group access denied" }),
      }),
    );
    await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
    await expect(page.getByText("Access removed")).toBeVisible();
    await shot("entry-access-removed");
    await page.unroute("**/api/entry");
    await page.getByRole("button", { name: "Enter a different code" }).click();
    await page.getByLabel("Your name").fill(`Evidence ${theme} ${Date.now()}`);
    await page.getByLabel("Shared code").fill(CODE);
    await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
    for (const index of [0, 1, 2, 3]) {
      await expectBeat(page, index);
      await page.waitForTimeout(700);
      await shot(`intro-beat-${index + 1}`);
      if (index < 3) await page.keyboard.press("ArrowRight");
    }
    await page
      .getByRole("button", { name: "Open the Atlas", exact: true })
      .click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await page.context().clearCookies();
  }
});
