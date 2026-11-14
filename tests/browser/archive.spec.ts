import { followShellLink } from "../helpers/shell";
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

test("Add, selected-photo correction, suggestions, Settings export and withdrawal", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/add");
  await page.getByLabel("Your name").fill(`${info.project.name}-${Date.now()}`);
  await page.getByLabel("Shared code").fill("synthetic-shared-code");
  await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
  await page
    .getByRole("button", { name: "Open the Atlas", exact: true })
    .click();
  await followShellLink(page, "Add");
  const fixture = execFileSync(process.env.MAZI_PYTHON || "python3", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; a=io.BytesIO(); z=zipfile.ZipFile(a,'w');\nfor name,q in [('red.jpg',90),('compressed.jpg',40)]:\n p=io.BytesIO(); Image.new('RGB',(40,40),'red').save(p,'JPEG',quality=q); z.writestr(name,p.getvalue())\nz.close(); sys.stdout.buffer.write(a.getvalue())",
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
    .getByRole("button", { name: "Upload and inspect inventory", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("inventoried");
  await page
    .getByRole("button", { name: "Start importing to group", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("completed");
  const profile = await (await page.request.get("/api/session")).json();
  const cards = (
    await (
      await page.request.get(`/api/atlas?group=${profile.group_id}`)
    ).json()
  ).memories;
  expect(cards).toHaveLength(2);
  for (const card of cards) {
    await page.goto(`/#/memory/${card.id}`);
    await page
      .getByRole("button", { name: "Tarihi düzelt", exact: true })
      .click();
    const editor = page.getByRole("form", {
      name: "Seçili fotoğrafı düzelt",
      exact: true,
    });
    await editor.getByLabel("Çekim tarihi", { exact: true }).fill("2020-10-06");
    await editor.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await page
      .getByRole("button", { name: /^(Yer ekle|Yeri değiştir)$/ })
      .click();
    await editor.getByLabel("Yer", { exact: true }).fill("Amsterdam");
    await editor.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(editor).toHaveCount(0);
  }
  const timeline = await (
    await page.request.get(`/api/review/timeline?group=${profile.group_id}`)
  ).json();
  expect(timeline.items.map((item: { date: string }) => item.date)).toEqual([
    "2020-10-06",
    "2020-10-06",
  ]);
  expect(timeline.items.map((item: { place: string }) => item.place)).toEqual([
    "amsterdam",
    "amsterdam",
  ]);
  await page.goto("/#/add?section=suggestions");
  await expect(page.locator("#duplicates article")).toHaveCount(1);
  await expect(page.locator("#events article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Accept selected photos", exact: true })
    .click();
  await expect(page.locator("#reviewed-events article")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo event", exact: true }).click();
  await expect(page.locator("#events article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Merge presentation", exact: true })
    .click();
  await expect(page.locator("#reviewed-pairs article")).toHaveCount(1);
  await page.getByRole("button", { name: "Split pair", exact: true }).click();
  await expect(page.locator("#duplicates article")).toHaveCount(1);
  await page.goto("/#/settings");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download archive", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("mazi-archive.zip");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("archive-controls.png"),
    fullPage: true,
  });
  await page.goto("/#/add");
  await page.locator("#imports button").first().click();
  await page
    .getByRole("button", { name: "Withdraw this contribution", exact: true })
    .click();
  await page.goto("/#/photos");
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  const remaining = await (
    await page.request.get(`/api/review/timeline?group=${profile.group_id}`)
  ).json();
  expect(remaining.items).toEqual([]);
  expect(errors).toEqual([]);
});
