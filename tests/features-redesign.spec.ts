import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

async function enter(page: Page, name = "Ben") {
  const response = await page.request.post("/api/entry", {
    data: { name, code: "synthetic-shared-code" },
  });
  expect(response.ok()).toBe(true);
}

async function ask(page: Page, question: string) {
  await page.goto("/#/ask");
  await page.getByLabel("Ask the archive").fill(question);
  await page
    .getByRole("button", { name: "Find evidence", exact: true })
    .click();
}

test("About states the privacy promises and replays the introduction", async ({
  page,
}) => {
  await enter(page);
  await page.goto("/#/about");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", {
      name: "A private atlas for one circle of friends",
    }),
  ).toBeVisible();
  const promises = main.getByRole("list").first();
  for (const promise of [
    "Only the circle can see it",
    "What you add is shared at once",
    "No email, no password",
    "You can take things back",
    "Answers cite their sources",
    "Optional AI stays off",
  ])
    await expect(promises).toContainText(promise);
  await expect(main).toContainText("There is no feed, no public profile");
  await main.getByRole("link", { name: "Replay introduction" }).click();
  await expect(page).toHaveURL(/#\/introduction/);
  await page.getByRole("button", { name: "Open the Atlas" }).click();
  await expect(page).toHaveURL(/#\/$/);
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
  await page.waitForTimeout(300);
  await expect(page.getByLabel("Shared code")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/about/);
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
    page.getByRole("link", { name: "Connect in Places & sources" }),
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
    page.getByRole("heading", { name: "Our circle", level: 1 }),
  ).toBeVisible();
  const members = page.getByRole("list", { name: "Members" });
  await expect(members.getByRole("listitem")).not.toHaveCount(0);
  await expect(members).toContainText("Alice");
  await expect(members).toContainText("Ben");
  await expect(page.getByRole("main")).not.toContainText(/follower|share on/i);
});

test("Ask streams the answer word by word, then cites its evidence", async ({
  page,
}) => {
  await enter(page);
  const reply = page.waitForResponse("**/api/answers/ask");
  await ask(page, "When was bicycle?");
  const result = await (await reply).json();
  await expect(page.locator("#notice")).toHaveText("Evidence found.");
  const answer = page.locator("#answer");
  await expect(answer).toHaveAttribute("aria-busy", "true");
  expect(
    await answer.locator(".answer-coverage span[hidden]").count(),
  ).toBeGreaterThan(10);
  await expect(answer.locator(".answer-coverage")).not.toContainText(
    "incomplete",
    { useInnerText: true },
  );
  await expect(answer).not.toHaveAttribute("aria-busy", "true");
  // Once revealed, the visible text is exactly what the server answered.
  const visible = (selector: string) =>
    answer
      .locator(selector)
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          (node as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
        ),
      );
  expect(await visible(".answer-lede")).toEqual([result.message]);
  expect(await visible(".answer-text > p:not(.answer-lede)")).toEqual(
    result.claims.map(
      (claim: { text: string; evidence_ids: string[] }) =>
        `${claim.text} ${claim.evidence_ids.map((_, i) => i + 1).join(" ")}`,
    ),
  );
  expect(await visible(".answer-coverage")).toEqual([result.coverage]);
  await expect(answer).toContainText("2024-01-02");
  const cite = answer.getByRole("link", {
    name: "View supporting record",
    exact: true,
  });
  await expect(cite).toHaveText("1");
  if ((page.viewportSize()?.width ?? 1440) > 800) {
    const evidence = page.getByRole("complementary", { name: "Evidence" });
    await expect(evidence).toContainText("Bicycle beside the sea");
  } else {
    await answer.getByRole("button", { name: /Evidence · 1 source/ }).click();
    const sheet = page.getByRole("dialog", {
      name: "Evidence for this answer",
    });
    await expect(sheet).toContainText("Bicycle beside the sea");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  }
  await cite.click();
  await expect(page.locator("#record")).toContainText("Bicycle beside the sea");
});

test("Under reduced motion the answer appears complete", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await ask(page, "When was bicycle?");
  await expect(page.locator("#notice")).toHaveText("Evidence found.");
  const answer = page.locator("#answer");
  await expect(answer.locator("span[hidden], a[hidden]")).toHaveCount(0);
  expect(await answer.getAttribute("aria-busy")).toBeNull();
  await expect(answer).toContainText("2024-01-02");
  await expect(
    answer.getByRole("link", { name: "View supporting record", exact: true }),
  ).toBeVisible();
});

test("Ask says when the archive has no evidence and links nothing", async ({
  page,
}) => {
  await enter(page);
  await ask(page, "Was bicycle our first trip ever?");
  await expect(page.locator("#notice")).toHaveText("Not enough evidence.");
  const answer = page.locator("#answer");
  await expect(answer).toContainText("No evidence found");
  await expect(answer).toContainText("so Mazi won’t guess");
  await expect(answer.locator("a")).toHaveCount(0);
  await answer.getByRole("button", { name: "Check My Imports" }).click();
  await expect(page).toHaveURL(/#\/imports/);
});

test("PR 6 screens have no axe violations in night or day", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.goto("/");
  const screens: [string, string][] = [
    ["/imports", "#imports"],
    ["/circle", "#members li"],
    ["/review", "#timeline article"],
    ["/places", "#origin-counts"],
    ["/ask", "#private:not([hidden])"],
    ["/about", ".about-page"],
  ];
  for (const theme of ["night", "day"]) {
    await page.evaluate(
      (value) => localStorage.setItem("mazi.theme", value),
      theme,
    );
    for (const [route, ready] of screens) {
      await page.goto(`/#${route}`);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.locator(ready).first().waitFor();
      await page.waitForTimeout(300);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `${route} in ${theme}`).toEqual([]);
    }
    await ask(page, "When was bicycle?");
    await expect(page.locator("#notice")).toHaveText("Evidence found.");
    await page.waitForTimeout(300);
    const answered = await new AxeBuilder({ page }).analyze();
    expect(answered.violations, `answer in ${theme}`).toEqual([]);
    await page
      .locator("#answer")
      .getByRole("link", { name: "View supporting record", exact: true })
      .click();
    await expect(page.locator("#record")).toContainText("Bicycle");
    await page.waitForTimeout(300);
    const record = await new AxeBuilder({ page }).analyze();
    expect(record.violations, `evidence in ${theme}`).toEqual([]);
  }
});

test("Search photographs stay usable while included categories load and retry", async ({
  page,
}, info) => {
  await enter(page, "Alice");
  let requested = false;
  let fail = true;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/discovery/state?**", async (route) => {
    requested = true;
    await gate;
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic context failure" }),
      });
    else await route.continue();
  });
  await page.goto("/#/search");
  await expect(page.locator("#results article")).toHaveCount(3);
  expect(requested).toBe(false);
  await page.getByLabel("Search", { exact: true }).fill("bicycle");
  await page
    .getByRole("button", { name: "Search archive", exact: true })
    .click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await expect(page.locator("#result-total")).toHaveText("1 photograph");
  const include = page.getByRole("button", {
    name: "Include memories, chats, places and people",
  });
  await page.screenshot({
    path: info.outputPath("search-photographs-ready.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await include.click();
  await expect.poll(() => requested).toBe(true);
  await expect(include).toBeDisabled();
  await expect(page.locator("#results article")).toHaveCount(1);
  await expect(page.locator("#person")).toBeDisabled();
  await page
    .getByText("Refine by place, person, date or source", { exact: true })
    .click();
  await page.getByLabel("Place", { exact: true }).fill("Amsterdam");
  await page
    .getByRole("button", { name: "Search archive", exact: true })
    .click();
  await expect(page.locator("#results article")).toHaveCount(1);
  release();
  await expect(page.locator("#context-status")).toContainText("unavailable");
  await expect(include).toBeEnabled();
  await expect(page.locator("#results article")).toHaveCount(1);
  fail = false;
  await include.click();
  await expect(page.locator("#person")).toBeEnabled();
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue(
    "bicycle",
  );
  await expect(page.getByLabel("Place", { exact: true })).toHaveValue(
    "Amsterdam",
  );
  await expect(page.locator("#results article")).toHaveCount(1);
  await expect(page.locator("#people")).toContainText("Ben");
  await expect(page.locator(".disc-tag select")).toBeEnabled();
  await expect(page.locator(".disc-tag select option")).not.toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("search-context-ready.png"),
    fullPage: true,
  });
});
