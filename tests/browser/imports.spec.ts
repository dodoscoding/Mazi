import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

test("import inventory, automatic sharing, report, replay and withdrawal", async ({
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
photo = io.BytesIO()
Image.new('RGB', (80, 60), '#869b76').save(photo, 'JPEG')
archive = io.BytesIO()
with zipfile.ZipFile(archive, 'w') as z:
    z.writestr('chat.txt', '01/01/2020, 12:00 - Ana: photo.jpg (file attached)\\n<script>alert(1)</script>\\n01/01/2020, 12:01 - Ben: missing.jpg (file attached)\\n01/01/2020, 12:02 - Ana: movie.mp4 (file attached)')
    z.writestr('photo.jpg', photo.getvalue())
    z.writestr('movie.mp4', b'unsupported video')
sys.stdout.buffer.write(archive.getvalue())
`,
  ]);
  await page.getByLabel("Source account label").fill("my synthetic account");
  await page.getByLabel("Export ZIP").setInputFiles({
    name: "synthetic.zip",
    mimeType: "application/zip",
    buffer: fixture,
  });
  await page
    .getByRole("button", { name: "Upload and inspect inventory" })
    .click();
  await expect(page.locator("#report-title")).toContainText("inventoried", {
    timeout: 15000,
  });
  await expect(page.locator("#report-summary")).toContainText("3 discovered");
  await expect(page.locator("#gallery article")).toHaveCount(0);
  await page.getByRole("button", { name: "Start importing to group" }).click();
  await expect(page.locator("#report-title")).toContainText("completed");
  await expect(page.locator("#report-summary")).toContainText(
    "1 available to group",
  );
  await expect(page.locator("#gallery article")).toHaveCount(1);
  await page.locator("#gallery summary").click();
  await expect(page.locator("#gallery")).toContainText(
    "<script>alert(1)</script>",
  );
  await expect(page.locator("#gallery script")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download outcome report" }).click();
  expect((await download).suggestedFilename()).toBe("mazi-import-report.json");
  await page
    .getByRole("button", { name: "Upload and inspect inventory" })
    .click();
  await expect(page.locator("#notice")).toContainText("Existing import found");
  await expect(page.locator("#gallery article")).toHaveCount(1);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("import-report.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Withdraw this contribution" })
    .click();
  await expect(page.locator("#gallery article")).toHaveCount(0);
  expect(errors).toEqual([]);
});
