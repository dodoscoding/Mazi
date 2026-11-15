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

test("search retains its draft and controls when the desktop is hidden", async ({
  page,
}) => {
  await page.goto("/?scene=off#/photos");
  const query = page.locator("#photos-query");
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

test("foreground access denial clears a retained private feature", async ({
  page,
}) => {
  await page.goto("/?scene=off#/photos");
  await page.locator("#photos-query").fill("Private draft");
  await visibility(page, true);
  await page.route("**/api/session", (route) =>
    route.fulfill({ status: 403, json: { error: "Access revoked" } }),
  );
  await visibility(page, false);
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator("#photos-query")).toHaveCount(0);
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
