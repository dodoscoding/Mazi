import { test, expect } from "@playwright/test";
import { followShellLink, signOut } from "./helpers/shell";

test("every signed-out route is gated and named profiles resume across browsers", async ({
  page,
  browser,
}, info) => {
  for (const route of [
    "/login",
    "/welcome",
    "/about",
    "/circle",
    "/settings",
    "/search",
    "/imports",
    "/review",
    "/timeline",
    "/atlas",
    "/explore",
    "/places",
    "/discover",
    "/ask",
    "/memories",
    "/?demo=1",
    "/#/memory/last-ferry",
  ]) {
    await page.goto(route);
    await expect(page.getByLabel("Shared code")).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(
      page.locator(".featured, .home-featured, .feature-page"),
    ).toHaveCount(0);
  }
  await page.screenshot({
    path: `work/poteto/shared-code-entry/screenshots/login-${info.project.name}.png`,
    fullPage: true,
  });
  const name = `New visitor ${info.project.name} ${Date.now()}`;
  await page.getByLabel("Your name").fill(` ${name} `);
  await page.getByLabel("Shared code").fill("wrong");
  await page.getByRole("button", { name: "Enter Mazi" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "That code doesn’t open a circle.",
  );
  await page.getByLabel("Shared code").fill("synthetic-shared-code");
  await page.getByRole("button", { name: "Enter Mazi" }).click();
  await expect(
    page.getByRole("button", { name: "Open the Atlas" }),
  ).toBeVisible();
  await page.screenshot({
    path: `work/poteto/shared-code-entry/screenshots/welcome-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open the Atlas" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  const original = await (await page.request.get("/api/session")).json();
  await followShellLink(page, "About");
  await page
    .getByRole("main")
    .getByRole("link", { name: "Replay introduction" })
    .click();
  await expect(page).toHaveURL(/#\/introduction/);
  await expect(
    page.getByRole("button", { name: "Open the Atlas" }),
  ).toBeVisible();
  await page.screenshot({
    path: `work/poteto/shared-code-entry/screenshots/about-${info.project.name}.png`,
    fullPage: true,
  });
  const fresh = await browser.newContext();
  try {
    const response = await fresh.request.post(
      `${info.project.use.baseURL}/api/entry`,
      { data: { name: name.toUpperCase(), code: "synthetic-shared-code" } },
    );
    const resumed = await response.json();
    expect(resumed.user_id).toBe(original.user_id);
    expect(resumed.introduced).toBe(true);
    const second = await fresh.newPage();
    await second.goto(`${info.project.use.baseURL}/`);
    await expect(
      second.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await expect(
      second.getByRole("button", { name: "Open the Atlas" }),
    ).toHaveCount(0);
  } finally {
    await fresh.close();
  }
  await signOut(page);
  await expect(page.getByLabel("Shared code")).toBeVisible();
  expect((await page.request.get("/api/groups")).status()).toBe(403);
});

test("session checks stay neutral and introduction failures remain retryable", async ({
  page,
}, info) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic outage" }),
    }),
  );
  await page.goto("/login");
  await expect(page.getByRole("alert")).toContainText("Synthetic outage");
  await page.unroute("**/api/session");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await page
    .getByLabel("Your name")
    .fill(`Retry visitor ${info.project.name} ${Date.now()}`);
  await page.getByLabel("Shared code").fill("synthetic-shared-code");
  await page.getByRole("button", { name: "Enter Mazi" }).click();
  await page.route("**/api/introduction/complete", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Try the introduction again" }),
    }),
  );
  await page.getByRole("button", { name: "Open the Atlas" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Try the introduction again",
  );
  await expect(page.getByLabel("Shared code")).toHaveCount(0);
  await page.unroute("**/api/introduction/complete");
  await page.getByRole("button", { name: "Open the Atlas" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/session", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/welcome");
  await expect(page.getByRole("status")).toContainText("Mazi açılıyor");
  await expect(page.getByLabel("Shared code")).toHaveCount(0);
  release();
  await expect(
    page.getByRole("heading", { name: "Birlikte hatırlayalım" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
});

test("archive access denial clears the authenticated shell", async ({
  page,
}) => {
  for (const [endpoint, path] of [
    ["**/api/groups", "/"],
    ["**/api/atlas?*", "/#/atlas"],
  ]) {
    expect(
      (
        await page.request.post("/api/entry", {
          data: { name: "Ben", code: "synthetic-shared-code" },
        })
      ).ok(),
    ).toBe(true);
    await page.route(endpoint, (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Access withdrawn" }),
      }),
    );
    await page.goto(path);
    await expect(page.getByLabel("Shared code")).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /sample Atlas/i })).toHaveCount(
      0,
    );
    await page.unroute(endpoint);
  }
});

test("a denied Home read removes scoped content without ending a valid session", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/");
  await expect(page.locator(".home-featured h2")).toBeVisible();
  const privateTitle = await page.locator(".home-featured h2").innerText();
  await page.route("**/api/social/home?*", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "Access withdrawn" },
    }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("mazi:archive-changed")),
  );
  await expect(
    page.getByText("Bu grup şu anda açılamıyor. Erişimin değişmiş olabilir.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(".home-featured, .home-plan, .activity-list"),
  ).toHaveCount(0);
  await expect(page.getByText(privateTitle, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  expect((await page.request.get("/api/session")).ok()).toBe(true);
});

test("an old Atlas denial cannot clear a newer authorized load", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  let captured!: () => void;
  const held = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delivered!: () => void;
  const delivery = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  let first = true;
  await page.route("**/api/atlas?*", async (route) => {
    if (!first) return route.continue();
    first = false;
    captured();
    await gate;
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "Old access denial" }),
    });
    delivered();
  });
  await page.goto("/#/atlas");
  await held;
  await page.evaluate(() => window.dispatchEvent(new Event("mazi:group")));
  await expect(
    page.getByRole("button", { name: "Our summer anısını seç", exact: true }),
  ).toBeVisible();
  release();
  await delivery;
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Our summer anısını seç", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Shared code")).toHaveCount(0);
});

test("Settings retains membership, account, About and introduction replay", async ({
  page,
}, info) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Hesap", exact: true }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Members" })).toContainText(
    "Alice",
  );
  await expect(page.getByRole("list", { name: "Members" })).toContainText(
    "Ben",
  );
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Account", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "About", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Replay introduction" })
    .click();
  await page.getByRole("button", { name: "Open the Atlas" }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.screenshot({
    path: `work/poteto/app-simplification/screenshots/settings-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("main")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.getByRole("list", { name: "Members" })).toHaveCount(0);
  expect((await page.request.get("/api/groups")).status()).toBe(403);
});

test("Settings keeps administrator controls and clears members after session loss", async ({
  page,
  browser,
}, info) => {
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/settings");
  await expect(
    page.getByRole("button", { name: "Remove Ben", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Ben", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Remove Ben from Our small circle?",
  );
  await page.getByRole("button", { name: "Keep them" }).click();
  await expect(page.getByRole("list", { name: "Members" })).toContainText(
    "Ben",
  );
  const visitor = await browser.newContext({
    baseURL: String(info.project.use.baseURL),
  });
  try {
    const name = `Settings visitor ${info.project.name}`;
    const entry = await visitor.request.post("/api/entry", {
      data: { name, code: "synthetic-shared-code" },
    });
    expect(entry.ok()).toBe(true);
    const profile = await entry.json();
    const session = await (await page.request.get("/api/session")).json();
    expect(
      (
        await visitor.request.post("/api/member/remove", {
          data: { group: profile.group_id, user: session.user_id },
        })
      ).status(),
    ).toBe(403);
    await page.reload();
    await page
      .getByRole("button", { name: `Remove ${name}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove member", exact: true })
      .click();
    await expect(page.getByRole("list", { name: "Members" })).not.toContainText(
      name,
    );
    expect((await visitor.request.get("/api/groups")).status()).toBe(403);
  } finally {
    await visitor.close();
  }
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.getByRole("list", { name: "Members" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Account", exact: true }),
  ).toHaveCount(0);
});

test("Settings explicitly exports the current circle and recovers failed exports", async ({
  page,
}) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/settings");
  await expect(
    page.getByRole("heading", {
      name: "Archive and contributions",
      exact: true,
    }),
  ).toBeVisible();
  await page.route("**/api/review/export?*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Synthetic export unavailable" },
    }),
  );
  await page
    .getByRole("button", { name: "Download archive", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Synthetic export unavailable",
  );
  await page.unroute("**/api/review/export?*");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download archive", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("mazi-archive.zip");
  await expect(
    page.getByText("You have no active source records in this group.", {
      exact: true,
    }),
  ).toBeVisible();
});
