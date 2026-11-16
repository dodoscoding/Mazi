import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

async function enter(page: Page, name = "Ben") {
  const response = await page.request.post("/api/entry", {
    data: { name, code: "synthetic-shared-code" },
  });
  expect(response.ok()).toBe(true);
}

test("About states the privacy promises and replays the introduction", async ({
  page,
}) => {
  await enter(page);
  await page.goto("/#/about");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", {
      name: "About",
      exact: true,
    }),
  ).toBeVisible();
  const promises = main.locator(".about-promises");
  for (const promise of [
    "Only the circle can see it",
    "What you add is shared at once",
    "No email, no password",
    "You can take things back",
    "Sources stay inspectable",
    "Optional AI stays off",
  ])
    await expect(promises).toContainText(promise);
  await expect(main).toContainText(
    "There is no public feed or public profile.",
  );
  await main.getByRole("link", { name: "Replay introduction" }).click();
  await expect(page).toHaveURL(/#\/introduction/);
  await page.getByRole("button", { name: "Open the Atlas" }).click();
  await expect(page).toHaveURL(/#\/settings$/);
});

test("Sign out on About asks first; Stay keeps the session and confirming ends it", async ({
  page,
}) => {
  await enter(page);
  await page.goto("/#/about");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Sign out", exact: true }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Sign out of Our small circle?",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Stay signed in" }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Stay signed in" }).click();
  // A late press on Sign out while the dialog fades away must not sign out.
  await page.locator(".about-dialog .button--primary").dispatchEvent("click");
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  await expect(page.getByLabel("Shared code")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/settings/);
  expect((await page.request.get("/api/groups")).status()).toBe(200);
  await main.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect((await page.request.get("/api/groups")).status()).toBe(200);
  await main.getByRole("button", { name: "Sign out", exact: true }).click();
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  expect((await page.request.get("/api/groups")).status()).toBe(403);
});

test("My Imports always says imports are shared at once and offers no publish step", async ({
  page,
}) => {
  await enter(page);
  await page.goto("/#/imports");
  const note = page.getByRole("note");
  await expect(note).toContainText(
    "Imports are shared with the whole circle immediately.",
  );
  await expect(note).toBeVisible();
  for (const source of ["WhatsApp", "Discord", "Messenger"])
    await expect(
      page.getByRole("button", { name: `Choose ${source}` }),
    ).toBeVisible();
  await page.getByRole("button", { name: "Choose Discord" }).click();
  await expect(page.locator("#upload select[name=source]")).toHaveValue(
    "discord",
  );
  await expect(page.getByLabel("Source account label")).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Connect in Add" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /publish|approve/i }),
  ).toHaveCount(0);
});

test("an import report has one technical confirm step and no publish gate", async ({
  page,
}, info) => {
  await enter(page, `Importer ${info.project.name} ${Date.now()}`);
  await page.request.post("/api/introduction/complete", { data: {} });
  await page.goto("/#/imports");
  const fixture = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(64,48),'#5a7d4c').save(p,'JPEG'); a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr('gate-check.jpg',p.getvalue()); z.close(); sys.stdout.buffer.write(a.getvalue())",
  ]);
  await page.locator("#upload select[name=source]").selectOption("manual");
  await page.getByLabel("Source account label").fill("gate check");
  await page.getByLabel("Export ZIP").setInputFiles({
    name: "gate-check.zip",
    mimeType: "application/zip",
    buffer: fixture,
  });
  await page
    .getByRole("button", { name: "Upload and inspect inventory" })
    .click();
  const report = page.locator("#report");
  await expect(page.locator("#report-title")).toContainText("inventoried");
  const visibleActions = () =>
    report
      .locator(".actions button")
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => (button as HTMLElement).offsetParent !== null)
          .map((button) => button.textContent?.trim()),
      );
  // The inventory check is the only step before sharing; there is no review or publish step.
  expect(await visibleActions()).toEqual([
    "Start importing to group",
    "Cancel remaining work",
    "Download outcome report",
  ]);
  await expect(
    page.getByRole("button", { name: /publish|approve|make visible/i }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Start importing to group" }).click();
  await expect(page.locator("#report-title")).toContainText("completed");
  expect(await visibleActions()).toEqual([
    "Withdraw this contribution",
    "Download outcome report",
  ]);
  await expect(page.locator('#gallery img[alt="gate-check.jpg"]')).toHaveCount(
    1,
  );
});

test("Our circle lists members without public or social counts", async ({
  page,
}) => {
  await enter(page);
  await page.goto("/#/circle");
  await expect(
    page.getByRole("heading", { name: "Settings", level: 1 }),
  ).toBeVisible();
  const members = page.getByRole("list", { name: "Members" });
  await expect(members.getByRole("listitem")).not.toHaveCount(0);
  await expect(members).toContainText("Alice");
  await expect(members).toContainText("Ben");
  await expect(page.getByRole("main")).not.toContainText(/follower|share on/i);
});

test("PR 6 screens have no axe violations", async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.goto("/");
  const screens: [string, string][] = [
    ["/imports", "#imports"],
    ["/circle", "#members li"],
    ["/add?section=suggestions", "#events"],
    ["/add?section=sources", "#source-form"],
    ["/photos", ".mem-tile"],
    ["/settings", "#members li"],
  ];
  for (const theme of ["night"]) {
    await page.evaluate(
      (value) => localStorage.setItem("mazi.theme", value),
      theme,
    );
    for (const [route, ready] of screens) {
      await page.goto(`/#${route}`);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.locator(ready).first().waitFor();
      await page.waitForTimeout(500);
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .filter(
              (a) => a.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((a) => a.finished.catch(() => {})),
        );
      });
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `${route} in ${theme}`).toEqual([]);
    }
    const profile = await (await page.request.get("/api/session")).json();
    const atlas = await (
      await page.request.get(`/api/atlas?group=${profile.group_id}`)
    ).json();
    const asset = atlas.memories[0].photos[0].assetId;
    await page.goto(
      `/#/answer-evidence?group=${profile.group_id}&asset=${asset}`,
    );
    await expect(page.locator(".viewer")).toBeVisible();
    const record = await new AxeBuilder({ page }).analyze();
    expect(
      record.violations,
      `retained photograph evidence in ${theme}`,
    ).toEqual([]);
  }
});
