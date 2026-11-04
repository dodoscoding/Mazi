import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require("@playwright/test");
const [base, phase] = process.argv.slice(2);
assert(["STAGED", "PRODUCTION"].includes(phase));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  if (phase === "STAGED") {
    let headers;
    try {
      headers = execFileSync(
        "vercel",
        [
          "curl",
          "/",
          "--deployment",
          base,
          "--",
          "--silent",
          "--show-error",
          "--max-time",
          "55",
          "--header",
          "x-vercel-set-bypass-cookie: true",
          "--dump-header",
          "-",
          "--output",
          "/dev/null",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      throw new Error("Unable to obtain the authenticated platform session");
    }
    const cookies = [...headers.matchAll(/^set-cookie:\s*([^;\r\n]+)/gim)].map(
      (match) => {
        const split = match[1].indexOf("=");
        return {
          name: match[1].slice(0, split),
          value: match[1].slice(split + 1),
          url: base,
          secure: true,
          httpOnly: true,
          sameSite: "Lax",
        };
      },
    );
    assert(cookies.length > 0, "Expected authenticated platform cookie");
    try {
      await context.addCookies(cookies);
    } catch {
      throw new Error(
        "Unable to initialize the authenticated platform session",
      );
    }
  }
  const page = await context.newPage();
  const errors = [];
  const writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin === new URL(base).origin &&
      url.pathname.startsWith("/api/") &&
      request.method() !== "GET"
    )
      writes.push({ path: url.pathname, method: request.method() });
  });
  const checks = [];
  for (const path of [
    "/",
    "/explore",
    "/circle",
    "/memory/release-probe?photo=1",
  ]) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200);
    await page
      .getByLabel("Shared code")
      .waitFor({ state: "visible", timeout: 20000 });
    assert.equal(
      await page
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .count(),
      0,
    );
    checks.push({
      path,
      status: response.status(),
      application_login_visible: true,
      private_shell_visible: false,
    });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `work/poteto/social-space-delivery/${phase}_LOGIN.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 780 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Phone entry overflow",
  );
  await page.getByLabel("Shared code").waitFor({ state: "visible" });
  await page.screenshot({
    path: `work/poteto/social-space-delivery/${phase}_LOGIN_PHONE.png`,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  const record = {
    time: new Date().toISOString(),
    base,
    phase,
    scope:
      "Anonymous application entry; platform authentication only for staged URL. No profiles or archive data written.",
    checks,
    phone_width: 320,
    page_errors: errors,
    application_write_requests: writes,
    result: "PASS",
  };
  writeFileSync(
    `work/poteto/social-space-delivery/${phase}_BROWSER.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  process.stdout.write(
    JSON.stringify({
      phase,
      result: "PASS",
      routes: checks.length,
      phone_width: 320,
    }) + "\n",
  );
} finally {
  await browser.close();
}
