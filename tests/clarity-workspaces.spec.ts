import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  expect(response.ok()).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("named feature links land on their actual section and survive refresh failure", async ({
  page,
}) => {
  await page.route("**/api/memories/recap?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic recap unavailable" }),
    }),
  );
  const sections = [
    ["Hikâyeler", "stories", "Stories we share"],
    ["Yıllık özet", "recap", "Annual recap"],
    ["Zaman kapsülleri", "capsules", "Time capsules"],
  ];
  for (const [label, section, heading] of sections) {
    await page.goto("/#/explore");
    await page
      .getByRole("navigation", { name: "Keşfet araçları" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`#/memories\\?section=${section}$`),
    );
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeFocused();
    await expect(page.locator("#notice")).toContainText(
      "Synthetic recap unavailable",
    );
    const title = page.getByRole("textbox", {
      name: "Capsule title",
      exact: true,
    });
    await title.fill("Unsent synthetic draft");
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pageshow"));
    });
    await expect(title).toBeFocused();
    await expect(title).toHaveValue("Unsent synthetic draft");
    await page
      .getByRole("button", { name: "Refresh stories", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Refresh stories", exact: true }),
    ).toBeFocused();
    await expect(page).toHaveURL(
      new RegExp(`#/memories\\?section=${section}$`),
    );
  }
});

test("People opens confirmed-association controls and retains its entry URL", async ({
  page,
}) => {
  await page.goto("/#/explore");
  await page
    .getByRole("navigation", { name: "Keşfet araçları" })
    .getByRole("link", { name: "Kişiler", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Fotoğraftaki kişiler",
      exact: true,
    }),
  ).toBeFocused();
  await expect(page).toHaveURL(/#\/discover\?section=people$/);
  await page.getByRole("textbox", { name: /^Person/ }).focus();
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.getByRole("textbox", { name: /^Person/ })).toBeFocused();
});

test("unknown section names keep the normal workspace available", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/memories?section=toString");
  await expect(
    page.getByRole("heading", { name: "Memories", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#grid")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("a group refresh does not repeat the requested section focus", async ({
  page,
}) => {
  await page.goto("/#/memories?section=capsules");
  const heading = page.getByRole("heading", {
    name: "Time capsules",
    exact: true,
  });
  await expect(heading).toBeFocused();
  await page.locator("#capsule-title").focus();
  await page
    .locator(".feature-content")
    .evaluate((root) => root.setAttribute("data-previous-mount", "true"));
  await page.evaluate(() => window.dispatchEvent(new Event("mazi:group")));
  await expect(page.locator('[data-previous-mount="true"]')).toHaveCount(0);
  await expect(page.locator("#grid")).not.toBeEmpty();
  await expect(heading).not.toBeFocused();
  await expect(page).toHaveURL(/#\/memories\?section=capsules$/);
});

for (const prefix of ["/", "/#/"]) {
  test(`${prefix}people opens the confirmed people heading without an extra history entry`, async ({
    page,
  }) => {
    await page.goto("/#/explore");
    await page.goto(`${prefix}people`);
    await expect(page).toHaveURL(/#\/discover\?section=people$/);
    await expect(
      page.getByRole("heading", { name: "Fotoğraftaki kişiler", exact: true }),
    ).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/#\/explore$/);
  });
  test(`${prefix}settings opens the visible group settings and keeps Back usable`, async ({
    page,
  }) => {
    await page.goto("/#/explore");
    await page.goto(`${prefix}settings`);
    await expect(page).toHaveURL(/#\/circle\?section=settings$/);
    await expect(
      page.getByRole("heading", { name: "Grup ayarları", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("link", {
        name: "Hesap, yardım ve gizlilik",
        exact: true,
      }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#\/explore$/);
  });
}

test("source management has its own section, focus and parent destination", async ({
  page,
}) => {
  await page.goto("/#/circle");
  await page
    .getByRole("navigation", { name: "Grup araçları" })
    .getByRole("link", { name: "Kaynak bağlantıları", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/places\?section=sources$/);
  await expect(
    page.getByRole("heading", { name: "Kaynak bağlantıları", exact: true }),
  ).toBeFocused();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Grubumuz", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .locator('#source-form input[name="label"]')
    .fill("Unsent source draft");
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.locator('#source-form input[name="label"]')).toHaveValue(
    "Unsent source draft",
  );
  await expect(
    page.getByRole("heading", { name: "Kaynak bağlantıları", exact: true }),
  ).not.toBeFocused();
});
