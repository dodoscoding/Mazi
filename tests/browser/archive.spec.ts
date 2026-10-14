import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

test("import, correct, review, export, and withdraw", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const unique = `${testInfo.project.name}-${Date.now()}`;
  await page.goto("/#/imports");
  await page.getByLabel("Your name").fill(unique);
  await page.getByLabel("Shared code").fill("synthetic-shared-code");
  await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
  await page
    .getByRole("button", { name: "Open the Atlas", exact: true })
    .click();
  await page
    .getByRole("link", { name: "My Imports", exact: true })
    .first()
    .click();
  const fixture = execFileSync(process.env.MAZI_PYTHON || "python3", [
    "-c",
    `
import io, sys, zipfile
from PIL import Image
archive = io.BytesIO()
with zipfile.ZipFile(archive, 'w') as z:
    for name, quality in [('red.jpg', 90), ('red-compressed.jpg', 40)]:
        image = io.BytesIO(); Image.new('RGB', (40, 40), 'red').save(image, 'JPEG', quality=quality)
        z.writestr(name, image.getvalue())
sys.stdout.buffer.write(archive.getvalue())
`,
  ]);
  await page
    .getByLabel("Source account label")
    .fill("synthetic review account");
  await page.locator("#upload select[name=source]").selectOption("manual");
  await page.getByLabel("Export ZIP").setInputFiles({
    name: "review.zip",
    mimeType: "application/zip",
    buffer: fixture,
  });
  await page
    .getByRole("button", { name: "Upload and inspect inventory" })
    .click();
  await expect(page.locator("#report-title")).toContainText("inventoried", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Start importing to group" }).click();
  await expect(page.locator("#report-title")).toContainText("completed", {
    timeout: 15000,
  });
  await page.goto("/#/review");
  await expect(page.locator("#timeline article")).toHaveCount(2);
  await expect(page.locator("#duplicates article")).toHaveCount(1);
  await page
    .locator("#timeline article")
    .first()
    .getByLabel("Title")
    .fill("Birthday");
  await page
    .locator("#timeline article")
    .first()
    .getByLabel("Capture date")
    .fill("2020-10-06");
  await page
    .locator("#timeline article")
    .first()
    .getByLabel("Place")
    .fill("Amsterdam");
  await page
    .locator("#timeline article")
    .first()
    .getByLabel("Approved for On this day")
    .check();
  await page
    .locator("#timeline article")
    .first()
    .getByRole("button", { name: "Save correction" })
    .click();
  await expect(page.locator("#timeline article").first()).toContainText(
    "Birthday",
  );
  await page
    .locator("#timeline article")
    .nth(1)
    .getByLabel("Capture date")
    .fill("2020-10-06");
  await page
    .locator("#timeline article")
    .nth(1)
    .getByLabel("Place")
    .fill("Amsterdam");
  await page
    .locator("#timeline article")
    .nth(1)
    .getByRole("button", { name: "Save correction" })
    .click();
  await expect(page.locator("#events article")).toHaveCount(1);
  await page.getByRole("button", { name: "Accept selected photos" }).click();
  await expect(page.locator("#reviewed-events article")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo event" }).click();
  await expect(page.locator("#events article")).toHaveCount(1);
  await page.getByRole("button", { name: "Merge presentation" }).click();
  await expect(page.locator("#reviewed-pairs article")).toHaveCount(1);
  await page.getByRole("button", { name: "Split pair" }).click();
  await expect(page.locator("#duplicates article")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download archive" }).click();
  expect((await download).suggestedFilename()).toContain("export");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("review.png"),
    fullPage: true,
  });
  await page.goto("/#/imports");
  await page.locator("#imports button").first().click();
  await page
    .getByRole("button", { name: "Withdraw this contribution" })
    .click();
  await page.goto("/#/review");
  await expect(page.locator("#count")).toContainText("0 photographs");
  expect(errors).toEqual([]);
});
