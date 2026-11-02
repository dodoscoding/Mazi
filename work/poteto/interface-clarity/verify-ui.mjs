import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.MAZI_EVIDENCE_URL || "http://127.0.0.1:18273";
const output = new URL("./", import.meta.url);
const browser = await chromium.launch();
const report = [];
const settled = (page) =>
  page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
const capture = async (page, name) => {
  await settled(page);
  await page.screenshot({
    path: fileURLToPath(new URL(name, output)),
    fullPage: true,
  });
};
const noOverflow = async (page) =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
try {
  for (const [screen, options] of [
    ["desktop", { viewport: { width: 1440, height: 1024 } }],
    ["phone", devices["Pixel 7"]],
  ]) {
    const context = await browser.newContext({
      ...options,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    assert.equal(
      (
        await page.request.post(`${base}/api/entry`, {
          data: { name: "Ben", code: "synthetic-shared-code" },
        })
      ).ok(),
      true,
    );
    await page.addInitScript(() =>
      sessionStorage.setItem("mazi.intro", "seen"),
    );
    await page.goto(`${base}/?demo=1`);
    await page.locator(".home-featured .photo-frame.is-loaded").waitFor();
    assert.deepEqual(
      await page
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("link")
        .allTextContents(),
      ["Home", "Keşfet", "Grubumuz"],
    );
    assert.equal(await page.locator(".atlas-stage").count(), 0);
    assert.ok((await page.locator(".home-memory").count()) <= 3);
    await noOverflow(page);
    await capture(page, `after-home-${screen}.png`);
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Keşfet", exact: true })
      .click();
    const directory = page.getByRole("navigation", {
      name: "Keşfet araçları",
      exact: true,
    });
    await directory.waitFor();
    assert.equal(await directory.getByRole("link").count(), 12);
    await noOverflow(page);
    await capture(page, `after-explore-${screen}.png`);
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    await directory.getByRole("link", { name: "Atlas", exact: true }).click();
    await page.getByRole("button", { name: "Flat map", exact: true }).click();
    await page.locator(".atlas-stage[data-ready]").waitFor();
    await capture(page, `after-atlas-${screen}.png`);
    await page.goto(`${base}/`);
    await page.locator(".home-featured .photo-frame.is-loaded").waitFor();
    await capture(page, `after-home-archive-${screen}.png`);
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Grubumuz", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Our circle", exact: true })
      .waitFor();
    await noOverflow(page);
    await capture(page, `after-group-${screen}.png`);
    for (const [name, target] of [
      ["Hikâyeler", "#stories-heading"],
      ["Yıllık özet", "#recap-heading"],
      ["Zaman kapsülleri", "#capsules-heading"],
      ["Kişiler", "#people-heading"],
    ]) {
      await page
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("link", { name: "Keşfet", exact: true })
        .click();
      await page
        .getByRole("navigation", { name: "Keşfet araçları", exact: true })
        .getByRole("link", { name, exact: true })
        .click();
      await page.locator(target).waitFor();
      await page.waitForFunction(
        (selector) =>
          document.activeElement === document.querySelector(selector),
        target,
      );
    }
    await page.goto(`${base}/#/memories?section=toString`);
    await page.locator("#grid").waitFor();
    await page.goto(`${base}/`);
    await page.locator(".home-featured .photo-frame.is-loaded").waitFor();
    await page.setViewportSize({ width: 320, height: 844 });
    await noOverflow(page);
    await page.getByRole("button", { name: "Hesap", exact: true }).click();
    await page.getByRole("navigation", { name: "Hesap araçları" }).waitFor();
    await noOverflow(page);
    await settled(page);
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Hesap", exact: true })
        .evaluate((button) => button === document.activeElement),
      true,
    );
    assert.deepEqual(errors, []);
    report.push({
      screen,
      mainLabels: ["Home", "Keşfet", "Grubumuz"],
      directoryEntries: 12,
      focusedSections: 4,
      axeViolations: 0,
      narrowWidth: 320,
      pageErrors: errors,
    });
    await context.close();
  }
  await writeFile(
    new URL("ui-results.json", output),
    JSON.stringify(
      {
        base,
        sourceHead: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        browser: browser.version(),
        report,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
