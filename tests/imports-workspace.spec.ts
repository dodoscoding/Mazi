import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";

test("import workspace exposes source and file controls in both themes", async ({
  page,
}, info) => {
  const response = await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  expect(response.ok()).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/imports");
  await expect(
    page.getByRole("heading", { name: "My Imports", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Import steps" })).toBeVisible();
  await page.getByRole("button", { name: "Choose Photos in a ZIP" }).click();
  await expect(page.locator('#upload select[name="source"]')).toHaveValue(
    "manual",
  );
  await expect(page.locator('#upload input[name="namespace"]')).toBeFocused();
  await expect(page.getByLabel("Export ZIP")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload and inspect inventory" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const theme of ["night", "day"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const result = await new AxeBuilder({ page })
      .include(".fx-imports")
      .analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`imports-${theme}.png`),
      fullPage: true,
    });
  }
});

test("a synthetic ZIP reaches the shared archive and reupload does not duplicate it", async ({
  page,
}, info) => {
  const response = await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/#/imports");
  const fixture = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(83,61),'purple').save(p,'JPEG'); a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr('workspace-synthetic.jpg',p.getvalue()); z.close(); sys.stdout.buffer.write(a.getvalue())",
  ]);
  await page.locator('#upload select[name="source"]').selectOption("manual");
  await page
    .getByLabel("Source account label")
    .fill(`workspace ${info.project.name}`);
  await page.getByLabel("Export ZIP").setInputFiles({
    name: "workspace.zip",
    mimeType: "application/zip",
    buffer: fixture,
  });
  const submit = page.getByRole("button", {
    name: "Upload and inspect inventory",
    exact: true,
  });
  await submit.click();
  await expect(page.locator("#report-title")).toContainText("inventoried");
  await page
    .getByRole("button", { name: "Start importing to group", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("completed");
  const profile = await (await page.request.get("/api/session")).json();
  const readArchive = async () =>
    (await page.request.get(`/api/archive?group=${profile.group_id}`)).json();
  const before = await readArchive();
  expect(
    before.some((item: { origins: { original_filename: string }[] }) =>
      item.origins.some(
        (origin) => origin.original_filename === "workspace-synthetic.jpg",
      ),
    ),
  ).toBe(true);
  await expect(page.locator("#gallery article")).toHaveCount(before.length);
  const repeatedStart = page.waitForResponse((response) =>
    response.url().endsWith("/api/imports/start"),
  );
  await submit.click();
  expect((await repeatedStart).ok()).toBe(true);
  await expect(submit).toBeEnabled();
  await expect(page.locator("#report-title")).toContainText("completed");
  expect(await readArchive()).toHaveLength(before.length);
  const previousRun = await page
    .locator("#imports .history-row")
    .first()
    .getAttribute("data-run");
  let activeRun = "";
  let reportWaiting = false;
  let releaseReport!: () => void;
  const reportGate = new Promise<void>((resolve) => {
    releaseReport = resolve;
  });
  await page.route("**/api/imports/start", async (route) => {
    const started = await route.fetch();
    activeRun = (await started.json()).id;
    await route.fulfill({ response: started });
  });
  await page.route(/\/api\/imports\/[^/?]+\?offset=0$/, async (route) => {
    if (
      activeRun &&
      new URL(route.request().url()).pathname === `/api/imports/${activeRun}` &&
      !reportWaiting
    ) {
      const report = await route.fetch();
      reportWaiting = true;
      await reportGate;
      await route.fulfill({ response: report });
    } else await route.continue();
  });
  await page
    .getByLabel("Source account label")
    .fill(`race ${info.project.name}`);
  await submit.click();
  await expect.poll(() => reportWaiting).toBe(true);
  await page.locator(`#imports [data-run="${previousRun}"]`).click();
  await expect(page.locator("#report-title")).toContainText("completed");
  const finish = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/imports/finish") &&
      response.request().postDataJSON().id === activeRun,
  );
  releaseReport();
  expect((await finish).ok()).toBe(true);
  await page.locator(`#imports [data-run="${activeRun}"]`).click();
  await expect(page.locator("#report-title")).toContainText("inventoried");
  await page
    .getByRole("button", { name: "Start importing to group", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("completed");
  expect(await readArchive()).toHaveLength(before.length);
  await page.reload();
  await expect(page.locator("#gallery article")).toHaveCount(before.length);
  const importedPhoto = page.getByRole("img", {
    name: "workspace-synthetic.jpg",
    exact: true,
  });
  await importedPhoto.scrollIntoViewIfNeeded();
  await expect(importedPhoto).toBeVisible();
  await expect
    .poll(() =>
      importedPhoto.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("imports-completed.png"),
    fullPage: true,
  });
});

test("workspace failure exposes keyboard retry and restores visible focus", async ({
  page,
}, info) => {
  const response = await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  expect(response.ok()).toBe(true);
  let fail = true;
  await page.route("**/api/groups", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Synthetic temporary workspace failure",
        }),
      });
    else await route.continue();
  });
  await page.goto("/#/imports");
  const error = page.locator("#workspace-error");
  await expect(error).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include("#workspace-error").analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("imports-error.png"),
    fullPage: true,
  });
  const retry = error.getByRole("button", { name: "Try again" });
  await retry.focus();
  fail = false;
  await page.keyboard.press("Enter");
  await expect(error).toBeHidden();
  await expect(page.locator("#page-title")).toBeFocused();
  await expect(page.getByLabel("Export ZIP")).toBeVisible();
});

test("working pages fit narrow and zoomed viewports in both themes", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/imports");
  const screens = [
    ["imports", "#upload"],
    ["memories", ".mem-moment"],
    ["review", "#timeline article"],
    ["places", "#origin-counts"],
    ["ask", "#private:not([hidden])"],
    ["discover", ".disc-search"],
    ["circle", "#members li"],
  ];
  const widths = info.project.name === "phone" ? [320, 390] : [720, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["night", "day"]) {
      await page.evaluate(
        (value) => localStorage.setItem("mazi.theme", value),
        theme,
      );
      for (const [route, ready] of screens) {
        await page.goto(`/#/${route}`);
        await page.reload();
        await expect(page.locator(ready).first()).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
          })),
          `${route} ${width} ${theme}`,
        ).toEqual({ width, scroll: width });
        await page.evaluate(async () => {
          await Promise.all(
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.effect?.getComputedTiming().iterations !== Infinity,
              )
              .map((animation) => animation.finished.catch(() => {})),
          );
        });
        const result = await new AxeBuilder({ page }).analyze();
        expect(
          result.violations.map(({ id, nodes }) => ({
            id,
            nodes: nodes.map(({ target, failureSummary }) => ({
              target,
              failureSummary,
            })),
          })),
          `${route} ${width} ${theme}`,
        ).toEqual([]);
        await page.screenshot({
          path: info.outputPath(`${route}-${width}-${theme}.png`),
          fullPage: true,
        });
      }
    }
  }
});

test("phone memories preserves view and order with reachable touch controls", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "Phone browsing contract");
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#/memories");
    await page.reload();
    const all = page.getByRole("button", { name: "All photos", exact: true });
    const moment = page.getByRole("button", { name: "By moment", exact: true });
    const order = page.getByRole("button", { name: "Order: Newest first" });
    for (const control of [all, moment, order]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await all.tap();
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(moment).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".mem-moment")).toHaveCount(0);
    await order.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#grid-order")).toBeFocused();
    await expect(page.locator("#grid-order")).toContainText("Oldest first");
    await moment.tap();
    await expect(moment).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".mem-moment").first()).toBeVisible();
    await expect(page.locator("#grid-order")).toContainText("Oldest first");
  }
});

test("interrupted transfers resume at the acknowledged offset after reload", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/imports");
  const fixture = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(67,49),'orange').save(p,'JPEG'); a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr('resume-photo.jpg',p.getvalue()); z.writestr('unsupported.bin',bytes(300000)); z.close(); sys.stdout.buffer.write(a.getvalue())",
  ]);
  const namespace = `resume ${info.project.name}`;
  const selectFile = async () => {
    await page.locator('#upload select[name="source"]').selectOption("manual");
    await page.getByLabel("Source account label").fill(namespace);
    await page.getByLabel("Export ZIP").setInputFiles({
      name: "resume.zip",
      mimeType: "application/zip",
      buffer: fixture,
    });
  };
  await selectFile();
  let fail = true;
  let releaseChunk!: () => void;
  const chunkGate = new Promise<void>((resolve) => {
    releaseChunk = resolve;
  });
  let firstChunkWaiting = false;
  const offsets: number[] = [];
  await page.route("**/api/imports/chunk", async (route) => {
    const { offset } = route.request().postDataJSON();
    offsets.push(offset);
    if (offset === 0) {
      firstChunkWaiting = true;
      await chunkGate;
    }
    if (offset > 0 && fail) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "Synthetic interrupted transfer. Select the same file to resume.",
        }),
      });
    } else await route.continue();
  });
  const submit = page.getByRole("button", {
    name: "Upload and inspect inventory",
    exact: true,
  });
  const initialStart = page.waitForResponse("**/api/imports/start");
  await submit.click();
  const initialRun = await (await initialStart).json();
  await expect.poll(() => firstChunkWaiting).toBe(true);
  await expect(submit).toBeDisabled();
  await expect(
    page.getByRole("progressbar", { name: "Archive transfer progress" }),
  ).toBeVisible();
  await expect(page.locator("#notice")).toHaveText("Transferring archive…");
  releaseChunk();
  await expect(page.locator("#notice")).toContainText(
    "Synthetic interrupted transfer",
  );
  await expect(submit).toBeEnabled();
  expect(offsets).toEqual([0, 256 * 1024]);
  await page.screenshot({
    path: info.outputPath("imports-interrupted.png"),
    fullPage: true,
  });
  await page.reload();
  await selectFile();
  fail = false;
  const started = page.waitForResponse("**/api/imports/start");
  await submit.click();
  const resumed = await (await started).json();
  expect(resumed.id).toBe(initialRun.id);
  await expect(page.locator("#report-title")).toContainText("inventoried");
  expect(offsets).toEqual([0, 256 * 1024, 256 * 1024]);
  await expect(page.locator("#report-title")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Start importing to group", exact: true }),
  ).toBeEnabled();
});

for (const path of ["imports"]) {
  test(`${path} keeps an in-flight upload across hiding and returning`, async ({
    page,
  }, info) => {
    expect(
      (
        await page.request.post("/api/entry", {
          data: { name: "Alice", code: "synthetic-shared-code" },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/#/${path}`);
    const fixture = execFileSync(".venv/bin/python", [
      "-c",
      "import io,sys,zipfile; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(67,49),'green').save(p,'JPEG'); a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr('background.jpg',p.getvalue()); z.writestr('unsupported.bin',bytes(600000)); z.close(); sys.stdout.buffer.write(a.getvalue())",
    ]);
    const namespace = `background ${path} ${info.project.name}`;
    await page.locator('#upload select[name="source"]').selectOption("manual");
    await page.getByLabel("Source account label").fill(namespace);
    await page.getByLabel("Export ZIP").setInputFiles({
      name: "background.zip",
      mimeType: "application/zip",
      buffer: fixture,
    });
    let releaseChunk!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseChunk = resolve;
    });
    let waiting = false;
    const offsets: number[] = [];
    const failed: string[] = [];
    let finishes = 0;
    page.on("requestfailed", (request) => {
      if (request.url().includes("/api/imports/")) failed.push(request.url());
    });
    page.on("request", (request) => {
      if (request.url().endsWith("/api/imports/finish")) finishes++;
    });
    await page.route("**/api/imports/chunk", async (route) => {
      const { offset } = route.request().postDataJSON();
      offsets.push(offset);
      if (offset === 256 * 1024) {
        waiting = true;
        await gate;
      }
      await route.continue();
    });
    const start = page.waitForResponse("**/api/imports/start");
    await page
      .getByRole("button", {
        name: "Upload and inspect inventory",
        exact: true,
      })
      .click();
    const run = (await (await start).json()).id;
    await expect.poll(() => waiting).toBe(true);
    try {
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.getByLabel("Export ZIP")).toHaveCount(1);
      releaseChunk();
      await expect
        .poll(
          async () =>
            (
              await (
                await page.request.get(`/api/imports/${run}?offset=0`)
              ).json()
            ).state,
        )
        .toBe("INVENTORIED");
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.locator("#report-title")).toContainText("inventoried");
      await expect(page.getByLabel("Source account label")).toHaveValue(
        namespace,
      );
      expect(
        await page
          .getByLabel("Export ZIP")
          .evaluate((element: HTMLInputElement) => element.files?.length),
      ).toBe(1);
      expect(offsets).toEqual([0, 256 * 1024, 512 * 1024]);
      expect(finishes).toBe(1);
      expect(failed).toEqual([]);
      let denyReport!: () => void;
      const denialGate = new Promise<void>((resolve) => {
        denyReport = resolve;
      });
      let reportWaiting = false;
      await page.route(`**/api/imports/${run}?*`, async (route) => {
        reportWaiting = true;
        await denialGate;
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic access revoked" }),
        });
      });
      await expect.poll(() => reportWaiting).toBe(true);
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      denyReport();
      await expect(page.getByLabel("Export ZIP")).toHaveCount(0);
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(
        page.getByText(
          "Your access changed. Enter again to check your circle.",
        ),
      ).toBeVisible();
      await expect(page.getByLabel("Export ZIP")).toHaveCount(0);
    } finally {
      releaseChunk();
    }
  });
}

test("circle retains its mounted state across visibility changes", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/circle");
  await expect(
    page.getByRole("heading", { name: "Our circle", level: 1 }),
  ).toBeVisible();
  await page.locator(".feature-content").evaluate((element) => {
    element.setAttribute("data-retained-probe", "original");
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator('[data-retained-probe="original"]')).toHaveCount(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator('[data-retained-probe="original"]')).toHaveCount(1);
});

test("imports mounts when opened in a hidden document", async ({ page }) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.addInitScript(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
  });
  await page.goto("/#/imports");
  await expect(page.getByLabel("Export ZIP")).toHaveCount(1);
});
