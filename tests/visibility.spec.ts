import { test, expect, type Page } from "@playwright/test";
import { memories } from "../src/memories";

const profile = {
  user_id: "synthetic-member",
  display_name: "Sample",
  group_id: "synthetic-circle",
  introduced: true,
};
const groups = [
  { id: profile.group_id, name: "Synthetic circle", role: "admin" },
];

async function visibility(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, "hidden", { configurable: true, value });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const value =
      path === "/api/session"
        ? profile
        : path === "/api/groups"
          ? groups
          : path === "/api/atlas"
            ? { memories }
            : path === "/api/discovery/search"
              ? { items: [], total: 0, next_offset: null, mode: "keyword" }
              : path === "/api/answers/state"
                ? {
                    group_enabled: true,
                    contribution_enabled: true,
                    local_processing_enabled: true,
                    usage: { requests: 0, daily_limit: 50 },
                  }
                : path === "/api/answers/ask"
                  ? {
                      status: "abstained",
                      message: "Synthetic answer to discard",
                      uncertainty: [],
                      coverage: "Synthetic archive",
                      usage: { requests: 1, daily_limit: 50 },
                    }
                  : {};
    return route.fulfill({ json: value });
  });
});

test("timeline retains its order and mounted view during foreground access checks", async ({
  page,
}, info) => {
  await page.goto("/?scene=off#/timeline");
  const phone = (page.viewportSize()?.width ?? 1440) <= 600;
  if (phone)
    await page.getByRole("button", { name: "Next year, 2023" }).click();
  else await page.getByRole("button", { name: "Newest first" }).click();
  const expectedYears = phone
    ? ["2022", "2023", "2024"]
    : ["2024", "2023", "2022"];
  const years = page
    .getByRole("list", { name: "Moments by year" })
    .getByRole("heading", { level: 2 });
  await expect(years).toHaveText(expectedYears);
  if (phone)
    await expect(page.locator(".timeline-globe")).toHaveAttribute(
      "data-year",
      "2023",
    );
  const view = await page.locator(".timeline-globe").elementHandle();
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.screenshot({ path: info.outputPath("before-hide.png") });
  await visibility(page, true);
  await page.screenshot({ path: info.outputPath("hidden.png") });
  await expect(years).toHaveText(expectedYears);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/session", async (route) => {
    await gate;
    await route.fulfill({ json: profile });
  });
  const checked = page.waitForRequest("**/api/session");
  try {
    await visibility(page, false);
    await checked;
    await expect(years).toHaveText(expectedYears);
    expect(await view!.evaluate((node) => node.isConnected)).toBe(true);
    const response = page.waitForResponse("**/api/session");
    release();
    await response;
    await expect(years).toHaveText(expectedYears);
    if (phone)
      await expect(page.locator(".timeline-globe")).toHaveAttribute(
        "data-year",
        "2023",
      );
    expect(await view!.evaluate((node) => node.isConnected)).toBe(true);
    expect(navigations).toBe(0);
    await page.screenshot({ path: info.outputPath("after-return.png") });
  } finally {
    release();
  }
});

test("search retains its draft and controls when the desktop is hidden", async ({
  page,
}) => {
  await page.goto("/?scene=off#/search");
  const query = page.locator("#query");
  await expect(query).toBeVisible();
  await query.fill("Lake photograph");
  const input = await query.elementHandle();
  await visibility(page, true);
  await expect(query).toHaveValue("Lake photograph");
  const response = page.waitForResponse("**/api/session");
  await visibility(page, false);
  await response;
  await expect(query).toHaveValue("Lake photograph");
  expect(await input!.evaluate((node) => node.isConnected)).toBe(true);
});

test("Memory answers discard delivered output when hidden", async ({
  page,
}) => {
  await page.goto("/?scene=off#/ask");
  await expect(page.locator("#ask")).toBeEnabled();
  await page.locator("#question").fill("When was this photograph?");
  await page.locator("#ask").click();
  await expect(page.locator("#answer")).toContainText(
    "Synthetic answer to discard",
  );
  await visibility(page, true);
  await expect(page.getByText("Synthetic answer to discard")).toHaveCount(0);
  await visibility(page, false);
  await expect(page.locator("#ask")).toBeEnabled();
  await expect(page.locator("#answer")).toBeEmpty();
});

test("foreground access denial clears a retained private feature", async ({
  page,
}) => {
  await page.goto("/?scene=off#/search");
  await page.locator("#query").fill("Private draft");
  await visibility(page, true);
  await page.route("**/api/session", (route) =>
    route.fulfill({ status: 403, json: { error: "Access revoked" } }),
  );
  await visibility(page, false);
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator("#query")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("entry keeps a partially completed form across desktop changes", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({ status: 403, json: { error: "Sign in required" } }),
  );
  await page.goto("/#/login");
  await page.getByLabel("Your name").fill("Synthetic visitor");
  await page.getByLabel("Shared code").fill("Unsubmitted draft");
  const input = await page.getByLabel("Your name").elementHandle();
  await visibility(page, true);
  const checked = page.waitForResponse("**/api/session");
  await visibility(page, false);
  await checked;
  await expect(page.getByLabel("Your name")).toHaveValue("Synthetic visitor");
  await expect(page.getByLabel("Shared code")).toHaveValue("Unsubmitted draft");
  expect(await input!.evaluate((node) => node.isConnected)).toBe(true);
});

test("returning during sign-in allows the pending entry to finish", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({ status: 403, json: { error: "Sign in required" } }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/entry", async (route) => {
    await gate;
    await route.fulfill({ json: profile });
  });
  try {
    await page.goto("/#/login");
    await page.getByLabel("Your name").fill("Synthetic visitor");
    await page.getByLabel("Shared code").fill("Synthetic code");
    const submitted = page.waitForRequest("**/api/entry");
    await page.getByRole("button", { name: "Enter Mazi" }).click();
    await submitted;
    await visibility(page, true);
    await visibility(page, false);
    release();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await expect(page.getByLabel("Shared code")).toHaveCount(0);
  } finally {
    release();
  }
});
