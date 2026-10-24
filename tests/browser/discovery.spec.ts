import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("People, combined retrieval, hiding and consent work without recognition", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  await page.goto("/#/discover");
  await expect(page.locator("#results article")).toHaveCount(3);
  const groupAlreadyOn = await page
    .getByLabel("Enable optional local processing")
    .isChecked();
  await page.getByLabel("Search mode").selectOption("semantic");
  const searched = page.waitForResponse(
    (response) =>
      response.url().includes("/api/discovery/search") &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Search archive" }).click();
  await searched;
  await expect(
    page.getByRole("button", { name: "Find similar colors" }),
  ).toHaveCount(groupAlreadyOn ? 3 : 0);
  await page.getByLabel("Search mode").selectOption("keyword");
  await page
    .getByText("My visibility & processing choices", { exact: true })
    .click();
  await page.getByLabel("Enable optional local processing").check();
  await expect(page.locator("#processing-status")).toContainText(
    "Group processing on",
  );
  await page.getByLabel("Allow local related-search processing").check();
  await expect(page.locator("#notice")).toHaveText("Changes saved.");
  await page.getByLabel("Search mode").selectOption("semantic");
  await page.getByLabel("Search", { exact: true }).fill("bike");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await expect(page.locator("#results")).toContainText(
    "Bicycle beside the sea",
  );
  await expect(
    page.getByRole("button", { name: "Find similar colors" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Hide from my discovery" }).click();
  await expect(page.locator("#results article")).toHaveCount(0);
  await page.getByRole("button", { name: "Restore hidden photograph" }).click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await page.getByLabel("Allow local related-search processing").uncheck();
  await expect(page.locator("#results article")).toHaveCount(0);
  await page.getByLabel("Search", { exact: true }).fill("bicycle");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await page.getByLabel("Person’s name").fill("<img src=x onerror=alert(1)>");
  await page
    .getByRole("button", { name: "Create person", exact: true })
    .click();
  await expect(page.locator("#people")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("#people img")).toHaveCount(0);
  await page.getByLabel("Search", { exact: true }).fill("");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#results article")).toHaveCount(3);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("discovery.png"),
    fullPage: true,
  });
  const group = await page.locator("#groups").inputValue();
  expect(
    (
      await page.request.post("/api/discovery/person", {
        headers: { Origin: "https://elsewhere.test" },
        data: { group, name: "No" },
      })
    ).status(),
  ).toBe(403);
  await page.request.post("/api/logout", { data: {} });
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.reload();
  await page
    .locator("#results article")
    .first()
    .getByRole("button", { name: "Remove my association" })
    .click();
  await page
    .getByText("My visibility & processing choices", { exact: true })
    .click();
  await expect(page.locator("#suppressed")).toContainText(
    "Restore my Ben association",
  );
  await page
    .getByRole("button", { name: "Restore my Ben association" })
    .click();
  await expect(page.locator("#suppressed")).toBeEmpty();
  await page.request.post("/api/logout", { data: {} });
  await page.context().addCookies([
    {
      name: "mazi_session",
      value: "synthetic-unmapped-session",
      url: new URL(page.url()).origin,
    },
  ]);
  const denied = await page.request.get("/api/discovery/search?group=" + group);
  expect(denied.status()).toBe(403);
  expect(await denied.text()).not.toContain("Amsterdam");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#results article")).toHaveCount(0);
  await expect(page.locator("#private")).toBeHidden();
  expect(errors).toEqual([]);
});

test("HTTP-boundary fixture supports explicit keyword recovery, 1,001 results and budget failure", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  await page.goto("/#/search");
  await expect(page.locator("#results article")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Include memories, chats, places and people" })
    .click();
  await expect(page.locator("#person")).toBeEnabled();
  const requests: Record<string, string>[] = [];
  let budgetExceeded = false;
  await page.route("**/api/archive/keyword-fixture-*/preview", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }),
  );
  await page.route("**/api/discovery/search?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(params));
    if (params.get("mode") === "semantic" || budgetExceeded) {
      await route.fulfill({
        status: 400,
        json: {
          code: "capacity_exceeded",
          error: budgetExceeded
            ? "Keyword search exceeded its metadata-work budget"
            : "Local search limit is 10,000 items",
        },
      });
      return;
    }
    const offset = Number(params.get("offset"));
    const end = Math.min(offset + 30, 1001);
    await route.fulfill({
      json: {
        items: Array.from({ length: end - offset }, (_, index) => ({
          id: `keyword-fixture-${offset + index}`,
          title: `Keyword photograph ${offset + index + 1}`,
          date: "2024-06-01",
          place: "Amsterdam",
          people: [],
          basis: "keyword",
          score: 1,
        })),
        total: 1001,
        next_offset: end < 1001 ? end : null,
        mode: "keyword",
        unindexed: 0,
      },
    });
  });
  await page
    .getByLabel("Search", { exact: true })
    .fill("scaling-keyword-fixture");
  await page.getByLabel("Search mode").selectOption("semantic");
  await page.getByText("Refine by place, person or date").click();
  await page.locator("#person").selectOption({ label: "Ben" });
  await page.getByLabel("Place", { exact: true }).fill("Amsterdam");
  await page.getByLabel("Country code").fill("NL");
  await page.getByLabel("Object or concept in text").fill("bicycle");
  await page.getByLabel("From", { exact: true }).fill("2024-01-01");
  await page.getByLabel("Through", { exact: true }).fill("2024-12-31");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#search-recovery")).toBeVisible();
  await expect(page.locator("#search-recovery")).toContainText(
    "10,000 visible photographs",
  );
  await expect(page.locator("#mode")).toHaveValue("semantic");
  expect(requests.map((request) => request.mode)).toEqual(["semantic"]);
  const failedSearch = requests[0];
  await page.getByRole("button", { name: "Use Words & filters" }).click();
  await expect(page.locator("#query")).toBeFocused();
  await expect(page.locator("#count")).toHaveText("1001 photographs · keyword");
  await expect(page.locator("#result-total")).toHaveText("1001 results");
  await expect(page.locator("#search-recovery")).toBeHidden();
  await expect(page.locator("#mode")).toHaveValue("keyword");
  expect(requests.at(-1)).toEqual({ ...failedSearch, mode: "keyword" });
  for (let offset = 30; offset < 1001; offset += 30) {
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.locator("#results h3").first()).toHaveText(
      `Keyword photograph ${offset + 1}`,
    );
    await expect(page.locator("#count")).toHaveText(
      "1001 photographs · keyword",
    );
  }
  await expect(page.locator("#results article")).toHaveCount(11);
  await expect(page.locator("#results h3").last()).toHaveText(
    "Keyword photograph 1001",
  );
  await expect(page.getByRole("button", { name: "Next page" })).toBeHidden();
  await expect(page.locator("#result-total")).toHaveText("1001 results");
  expect(requests.at(-1)).toEqual({
    ...failedSearch,
    mode: "keyword",
    offset: "990",
  });
  budgetExceeded = true;
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#search-recovery")).toBeVisible();
  await expect(page.locator("#search-recovery")).toContainText(
    "Complete results are unavailable",
  );
  await expect(page.locator("#search-recovery")).toContainText(
    "metadata-work budget",
  );
  await expect(page.locator("#search-recovery")).toContainText(
    "No partial results",
  );
  await expect(
    page.getByRole("button", { name: "Use Words & filters" }),
  ).toBeHidden();
  await expect(page.locator("#results article")).toHaveCount(0);
  await expect(page.locator("#result-total")).toBeEmpty();
  await expect(page.locator("#result-types")).toBeHidden();
  await expect(page.locator("#search-none")).toBeHidden();
  await expect(page.locator("#mode")).toHaveValue("keyword");
  await expect(page.locator("#query")).toHaveValue("scaling-keyword-fixture");
  await expect(page.locator("#place")).toHaveValue("Amsterdam");
  await page.screenshot({
    path: testInfo.outputPath("keyword-budget-recovery.png"),
    fullPage: true,
  });
  budgetExceeded = false;
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#result-total")).toHaveText("1001 results");
  await expect(page.locator("#search-recovery")).toBeHidden();
  expect(requests.at(-1)).toEqual({ ...failedSearch, mode: "keyword" });
});
