import { chromium, expect, request } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const directory = process.env.MAZI_NATIVE_OUTPUT || "/tmp/mazi-native-import";
await mkdir(directory, { recursive: true });
const base = process.env.MAZI_NATIVE_BASE_URL || "http://127.0.0.1:8039";
const debugPort = Number(process.env.MAZI_NATIVE_DEBUG_PORT || 9229);
const result = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  visibilityMethod:
    "Native macOS Chromium window/tab transitions; browser records unmodified visibility events with no focus or visibility emulation",
  events: [],
  errors: [],
  measurements: {},
};
const fixture = execFileSync(
  ".venv/bin/python",
  [
    "-c",
    `
import io, random, sys, zipfile
from PIL import Image
out = io.BytesIO()
randomizer = random.Random(42)
with zipfile.ZipFile(out, 'w') as archive:
    for index in range(80):
        picture = io.BytesIO()
        Image.frombytes('RGB', (320, 240), randomizer.randbytes(320*240*3)).save(picture, 'JPEG', quality=85)
        archive.writestr(f'photo-{index:03}.jpg', picture.getvalue())
sys.stdout.buffer.write(out.getvalue())
`,
  ],
  { maxBuffer: 16 * 1024 * 1024 },
);
result.archiveBytes = fixture.length;
result.photoCount = 80;
const child = spawn(
  chromium.executablePath(),
  [
    "--remote-debugging-port=" + debugPort,
    "--user-data-dir=" + directory + "/profile-" + Date.now(),
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);
let endpoint;
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    endpoint = await (
      await fetch("http://127.0.0.1:" + debugPort + "/json/version")
    ).json();
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
if (!endpoint) {
  child.kill();
  throw new Error("Native Chromium debug endpoint did not open");
}
process.once("SIGINT", () => {
  child.kill();
  process.exit(130);
});
const browser = await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl, {
  noDefaults: true,
});
const context = browser.contexts()[0];
const page = context.pages()[0];
let api = context.request;
let hold = false;
let chunks = 0;
let notifyHeld;
let releaseHeld;
let held = new Promise((resolve) => {
  notifyHeld = resolve;
});
const gate = new Promise((resolve) => {
  releaseHeld = resolve;
});
page.on("pageerror", (error) => result.errors.push(error.message));
page.on("requestfailed", (request) => {
  if (request.url().includes("/api/imports/"))
    result.events.push({
      kind: "failed",
      path: new URL(request.url()).pathname,
      error: request.failure(),
    });
});
page.on("request", (request) => {
  if (request.method() === "POST" && request.url().includes("/api/imports/")) {
    const body = request.postDataJSON();
    result.events.push({
      kind: "request",
      path: new URL(request.url()).pathname,
      id: body.id,
      offset: body.offset,
    });
  }
});
await page.route("**/api/imports/chunk", async (route) => {
  chunks++;
  if (hold && chunks === 2) {
    notifyHeld();
    await gate;
  }
  await route.continue().catch(() => {});
});
try {
  const entry = await context.request.post(base + "/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  assert.equal(entry.status(), 200);
  await page.goto(base + "/#/imports");
  await page.evaluate(() => {
    window.nativeVisibilityEvents = [];
    document.addEventListener("visibilitychange", () =>
      window.nativeVisibilityEvents.push({
        state: document.visibilityState,
        at: Date.now(),
      }),
    );
  });
  await expect(page.locator("#upload-button")).toBeVisible();
  async function selectFixture() {
    await page.locator("#upload select[name=source]").selectOption("manual");
    await page
      .getByLabel("Source account label")
      .fill("background-native-" + Date.now());
    await page.getByLabel("Export ZIP").setInputFiles({
      name: "synthetic.zip",
      mimeType: "application/zip",
      buffer: fixture,
    });
  }
  await selectFixture();
  hold = true;
  const started = page.waitForResponse("**/api/imports/start");
  await page.locator("#upload-button").click();
  const id = (await (await started).json()).id;
  await held;
  async function report() {
    return (await api.get(base + "/api/imports/" + id)).json();
  }
  result.beforeHide = await report();
  await page.screenshot({ path: directory + "/before-hide.png" });
  await writeFile(
    directory + "/ready.json",
    JSON.stringify({
      id,
      before: result.beforeHide,
      executable: chromium.executablePath(),
    }),
  );
  console.log("READY FOR NATIVE SCREEN SWITCH");
  await page.waitForFunction(() => document.hidden, undefined, {
    timeout: 180000,
    polling: 100,
  });
  result.hiddenDOM = await page.evaluate(() => ({
    hidden: document.hidden,
    roots: document.querySelectorAll(".feature-content").length,
    fileInputs: document.querySelectorAll("input[type=file]").length,
  }));
  releaseHeld();
  await expect
    .poll(async () => (await report()).state, { timeout: 30000 })
    .toBe("INVENTORIED");
  result.whileHidden = await report();
  result.nativeVisibilityEvents = await page.evaluate(
    () => window.nativeVisibilityEvents,
  );
  result.visibilityAfterInventory = await page.evaluate(
    () => document.visibilityState,
  );
  await writeFile(
    directory + "/hidden-success.json",
    JSON.stringify(result, null, 2),
  );
  console.log("INVENTORIED WHILE HIDDEN; READY TO RETURN");
  await page.waitForFunction(() => !document.hidden, undefined, {
    timeout: 180000,
    polling: 100,
  });
  result.afterReturn = await page
    .getByLabel("Export ZIP")
    .evaluate((input) => ({
      files: input.files.length,
      label: document.querySelector("input[name=namespace]").value,
    }));
  assert.equal(result.afterReturn.files, 1);
  await page.screenshot({ path: directory + "/after-return.png" });
  await expect(page.locator("#confirm")).toBeVisible();
  await expect(page.locator("#confirm")).toBeEnabled();
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/imports/confirm") &&
      response.request().method() === "POST",
  );
  await page.locator("#confirm").click();
  await response;
  result.afterConfirm = await report();
  api = await request.newContext({
    storageState: await context.storageState(),
  });
  await page.close();
  await expect
    .poll(async () => (await report()).state, { timeout: 30000 })
    .toBe("COMPLETED");
  result.afterClose = await report();
  assert.equal(result.afterClose.counts.AVAILABLE_TO_GROUP, 80);
  assert.equal(result.visibilityAfterInventory, "hidden");
  assert.equal(result.whileHidden.received, fixture.length);
  assert.equal(
    result.events.filter((event) => event.path === "/api/imports/finish")
      .length,
    1,
  );
  assert.deepEqual(
    result.events.filter((event) => event.kind === "failed"),
    [],
  );
  assert.deepEqual(result.errors, []);
  result.pass = true;
} catch (error) {
  result.pass = false;
  result.failure = error.stack;
  if (!page.isClosed())
    await page
      .screenshot({ path: directory + "/failure.png", timeout: 3000 })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  releaseHeld();
  await writeFile(directory + "/result.json", JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      result,
      (key, value) => (key === "items" ? `[${value.length} items]` : value),
      2,
    ),
  );
  await api.dispose();
  await browser.close();
  child.kill();
}
