import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/work", (r) =>
    r.fulfill({ json: { pending: false } }),
  );
  await page.route("**/api/session", (r) =>
    r.fulfill({
      json: {
        user_id: "parallel-test",
        group_id: "circle",
        display_name: "Sample",
        introduced: true,
      },
    }),
  );
  await page.route("**/api/groups", (r) =>
    r.fulfill({
      json: [{ id: "circle", name: "Synthetic circle", role: "member" }],
    }),
  );
  await page.route("**/api/parallel/config", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        provider: "fake",
        noticeVersion: "sample-v1",
        accepted: false,
      },
    }),
  );
});
test("branches persist, map matches list, endings compare and delete", async ({
  page,
}, testInfo) => {
  const atlas: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/atlas")) atlas.push(r.url());
  });
  await page.goto("/parallel?demo=1");
  await expect(
    page.getByRole("heading", { name: "What if you chose differently?" }),
  ).toBeVisible();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Begin a universe" }).click();
  await page.getByRole("button", { name: "Study somewhere new" }).click();
  await page.getByRole("button", { name: "Begin story" }).click();
  await expect(
    page.getByRole("heading", { name: "The door left open", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Follow the opportunity/ }).click();
  await page
    .getByRole("button", { name: "Multiverse map", exact: true })
    .click();
  await page.getByRole("button", { name: "List view" }).click();
  await page.getByRole("button", { name: "Open The door left open" }).click();
  await page.getByRole("button", { name: /Build a quieter life/ }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open universe" }).click();
  await page
    .getByRole("button", { name: "Multiverse map", exact: true })
    .click();
  await page.getByRole("button", { name: "List view" }).click();
  await expect(
    page.getByRole("button", { name: "Open A different rhythm" }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Open A different rhythm" })
    .first()
    .click();
  await page.getByRole("button", { name: /Follow the opportunity/ }).click();
  await expect(page.getByText("Unexpected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Follow the opportunity/ }).click();
  await expect(page.getByText("Endings found: 1 of 12")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Follow the opportunity/ }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: testInfo.outputPath("ending.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Multiverse map", exact: true })
    .click();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: testInfo.outputPath("map-320.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "List view" }).click();
  await page
    .getByRole("button", { name: "Open The unexpected invitation" })
    .click();
  await page.getByRole("button", { name: /Build a quieter life/ }).click();
  await page.getByRole("button", { name: "Compare endings" }).click();
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await expect(page.locator(".py-compare article")).toHaveCount(2);
  await page.getByRole("button", { name: "Your universes" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete universe" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Open universe" })).toHaveCount(
    0,
  );
  expect(atlas).toEqual([]);
});
test("feature off is hidden and never generates", async ({ page }) => {
  await page.route("**/api/parallel/config", (r) =>
    r.fulfill({ status: 404, json: { error: "Not found" } }),
  );
  await page.goto("/parallel");
  await expect(
    page.getByRole("heading", { name: "Parallel You is not enabled" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Begin a universe" }),
  ).toHaveCount(0);
});
test("notice, timeout retry and access loss do not create chapters", async ({
  page,
}) => {
  await page.route("**/api/parallel/notice", (r) =>
    r.fulfill({ json: { ok: true } }),
  );
  await page.route("**/api/parallel/chapter", (r) =>
    r.fulfill({
      status: 503,
      json: {
        error: "Story service unavailable",
        code: "parallel_unavailable",
      },
    }),
  );
  await page.goto("/parallel");
  await page.getByRole("button", { name: "Begin a universe" }).click();
  await page.getByRole("button", { name: "Study somewhere new" }).click();
  await page.getByRole("button", { name: "Begin story" }).click();
  await page.getByRole("button", { name: "Accept and continue" }).click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("mazi.parallel.v1.parallel-test") ||
            '{"universes":[]}',
        ).universes,
    ),
  ).toEqual([]);
  await page.route("**/api/parallel/chapter", (r) =>
    r.fulfill({ status: 403, json: { error: "Access lost" } }),
  );
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByText("Your access changed. Enter again to check your circle."),
  ).toBeVisible();
});

test("leaving during notice acceptance cannot generate or save a story", async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  let chapters = 0;
  await page.route("**/api/parallel/notice", async (r) => {
    requested = true;
    await waiting;
    await r.fulfill({ json: { ok: true } }).catch(() => {});
  });
  await page.route("**/api/parallel/chapter", (r) => {
    chapters++;
    return r.fulfill({ status: 503, json: { error: "Unexpected generation" } });
  });
  await page.goto("/parallel");
  await page.getByRole("button", { name: "Begin a universe" }).click();
  await page.getByRole("button", { name: "Study somewhere new" }).click();
  await page.getByRole("button", { name: "Begin story" }).click();
  await page.getByRole("button", { name: "Accept and continue" }).click();
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("mazi:access-lost")),
  );
  await expect(
    page.getByText("Your access changed. Enter again to check your circle."),
  ).toBeVisible();
  release();
  await page.waitForTimeout(200);
  expect(chapters).toBe(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("mazi.parallel.v1.parallel-test"),
    ),
  ).toBeNull();
});

test("loading, refusal, invalid output and quota errors preserve the branch", async ({
  page,
}) => {
  await page.route("**/api/parallel/config", (r) =>
    r.fulfill({ json: { enabled: true, accepted: true } }),
  );
  for (const [status, code] of [
    [422, "parallel_declined"],
    [502, "parallel_bad_output"],
    [400, "parallel_quota"],
  ] as const) {
    await page.route("**/api/parallel/chapter", async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await r.fulfill({ status, json: { error: `Example ${code}`, code } });
    });
    await page.goto("/parallel");
    await page.getByRole("button", { name: "Begin a universe" }).click();
    await page.getByRole("button", { name: "Study somewhere new" }).click();
    await page.getByRole("button", { name: "Begin story" }).click();
    await expect(page.getByText("Writing the next possibility…")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(`Example ${code}`);
    if (code === "parallel_declined") {
      await expect(
        page.getByRole("button", { name: "Begin story" }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Retry", exact: true }),
      ).toHaveCount(0);
    }
    expect(
      await page.evaluate(() =>
        localStorage.getItem("mazi.parallel.v1.parallel-test"),
      ),
    ).toBeNull();
  }
});

async function seedStory(page: import("@playwright/test").Page) {
  await page.goto("/parallel?demo=1");
  await page.getByRole("button", { name: "Begin a universe" }).click();
  await page.getByRole("button", { name: "Study somewhere new" }).click();
  await page.getByRole("button", { name: "Begin story" }).click();
  await expect(
    page.getByRole("heading", { name: "The door left open", exact: true }),
  ).toBeVisible();
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("mazi.parallel.v1.parallel-test")!),
  );
}

test("deleting a chapter while regeneration waits cannot restore it", async ({
  page,
}) => {
  const saved = await seedStory(page);
  const root = saved.nodes[saved.universes[0].rootNodeId];
  await page.route("**/api/parallel/config", (r) =>
    r.fulfill({ json: { enabled: true, accepted: true } }),
  );
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route("**/api/parallel/chapter", async (r) => {
    requested = true;
    await wait;
    await r.fulfill({ json: { ...root, state: root.meters } });
  });
  await page.goto("/parallel");
  await page.getByRole("button", { name: "Open universe" }).click();
  await page.getByRole("button", { name: "This chapter feels wrong" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Regenerate chapter" }).click();
  await expect.poll(() => requested).toBe(true);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete chapter" }).click();
  release();
  await expect(page.getByText("Writing the next possibility…")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Open universe" })).toHaveCount(
    0,
  );
  const final = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mazi.parallel.v1.parallel-test")!),
  );
  expect(final.nodes).toEqual({});
  expect(final.universes).toEqual([]);
});

test("refusal pauses all chapter generation controls", async ({ page }) => {
  await seedStory(page);
  await page.route("**/api/parallel/config", (r) =>
    r.fulfill({ json: { enabled: true, accepted: true } }),
  );
  await page.route("**/api/parallel/chapter", (r) =>
    r.fulfill({
      status: 422,
      json: { error: "Paused story", code: "parallel_declined" },
    }),
  );
  await page.goto("/parallel");
  await page.getByRole("button", { name: "Open universe" }).click();
  await page.getByRole("button", { name: /Follow the opportunity/ }).click();
  await expect(page.getByRole("alert")).toContainText("Paused story");
  for (const button of await page.locator(".py-choices button").all())
    await expect(button).toBeDisabled();
  await page.getByRole("button", { name: "This chapter feels wrong" }).click();
  await expect(
    page.getByRole("button", { name: "Regenerate chapter" }),
  ).toBeDisabled();
});

for (const failed of [false, true]) {
  test(`member can erase local stories when config ${failed ? "fails" : "is off"}`, async ({
    page,
  }) => {
    const saved = await seedStory(page);
    await page.evaluate(
      (value) =>
        localStorage.setItem(
          "mazi.parallel.v1.another-member",
          JSON.stringify(value),
        ),
      saved,
    );
    await page.route("**/api/parallel/config", (r) =>
      r.fulfill({ status: failed ? 503 : 200, json: { enabled: false } }),
    );
    await page.goto("/parallel");
    await expect(
      page.getByRole("heading", { name: "Parallel You is not enabled" }),
    ).toBeVisible();
    page.once("dialog", async (d) => {
      expect(d.message()).toContain("other members will remain");
      await d.accept();
    });
    await page.getByRole("button", { name: "Delete your stories" }).click();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("mazi.parallel.v1.parallel-test"),
      ),
    ).toBeNull();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("mazi.parallel.v1.another-member"),
      ),
    ).not.toBeNull();
  });
}

for (const enabled of [true, false]) {
  test(`standalone Parallel You focuses deferred availability ${enabled}`, async ({
    page,
  }) => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/parallel/config", async (r) => {
      await waiting;
      await r.fulfill({ json: { enabled, accepted: true } });
    });
    await page.goto("/parallel");
    await expect(
      page.getByRole("heading", { name: "Checking availability…" }),
    ).toBeFocused();
    release();
    await expect(
      page.getByRole("heading", {
        name: enabled
          ? "What if you chose differently?"
          : "Parallel You is not enabled",
      }),
    ).toBeFocused();
  });
}
