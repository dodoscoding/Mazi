import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("learned model indexes locally and keeps keyword fallback", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.MAZI_EMBEDDING_MODEL_DIR,
    "Run explicitly with verified local model files",
  );
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  const groups = await (await page.request.get("/api/groups")).json();
  const group = groups[0].id;
  const resetProcessing = async () => {
    for (const groupWide of [true, false]) {
      const response = await page.request.post("/api/discovery/processing", {
        data: { group, enabled: false, group_wide: groupWide },
      });
      expect(response.ok()).toBeTruthy();
    }
  };
  await resetProcessing();
  try {
    await page.goto("/#/discover");
    await page
      .getByText("My visibility & processing choices", { exact: true })
      .click();
    await page.getByLabel("Enable optional local processing").check();
    await expect(page.locator("#processing-status")).toContainText(
      "Group processing on",
    );
    await page.getByLabel("Allow local related-search processing").check();
    await expect(page.locator("#build-index")).toBeVisible();
    await page
      .getByLabel("Search", { exact: true })
      .fill("people relaxing on a wooden dock beside a mountain lake");
    await page.getByLabel("Search mode").selectOption("keyword");
    await page.getByRole("button", { name: "Search archive" }).click();
    await expect(page.locator("#result-total")).toHaveText("0 results");
    await page.getByLabel("Search mode").selectOption("semantic");
    await page.getByRole("button", { name: "Search archive" }).click();
    await expect(page.locator("#index-progress")).toContainText(
      "need indexing",
    );
    await page
      .getByRole("button", { name: "Build local search index" })
      .click();
    await expect(page.locator("#index-progress")).toContainText("0 remaining");
    await expect(page.locator("#count")).toContainText("Local CLIP");
    await expect(page.locator("#results article").first()).toContainText(
      "Archive item one",
    );
    await expect(page.locator("#model-help")).toContainText("English");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("learned-discovery.png"),
      fullPage: true,
    });
    await page.getByLabel("Allow local related-search processing").uncheck();
    await expect(page.locator("#results article")).toHaveCount(0);
    await page.getByLabel("Search", { exact: true }).fill("photo-0.jpg");
    await page.getByRole("button", { name: "Search archive" }).click();
    await expect(page.locator("#results article")).toHaveCount(1);
    await expect(page.locator("#results article").first()).toContainText(
      "Archive item one",
    );
    await page.getByLabel("Enable optional local processing").uncheck();
    await expect(page.locator("#processing-status")).toContainText(
      "Group processing off",
    );
  } finally {
    await resetProcessing();
  }
});
