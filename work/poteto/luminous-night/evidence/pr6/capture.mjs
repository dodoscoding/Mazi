// Captures PR 6 review screenshots from a running synthetic server
// (tests.browser.memories_server). Usage:
//   node work/poteto/luminous-night/evidence/pr6/capture.mjs http://127.0.0.1:8611 [filter]
// States the fixture cannot reach on its own (an import in progress or failed,
// a second circle, a slow answer) are produced by rewriting API responses in
// the browser only; nothing is written to the server for them.
import { chromium, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] || "http://127.0.0.1:8611";
const only = process.argv[3] || "";
const out = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const sizes = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 }, phone: true },
];

async function setup() {
  const context = await browser.newContext();
  const request = context.request;
  const login = await request.post(`${base}/api/entry`, {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  const { group_id: group } = await login.json();
  const mine = await (
    await request.get(`${base}/api/review/my-contributions?group=${group}`)
  ).json();
  const spots = [
    ["NL", "Amsterdam", 52.37, 4.9, "2024-01-02"],
    ["TR", "Istanbul", 41.01, 28.98, "2024-01-02"],
    ["NL", "Amsterdam", 52.37, 4.9, "2024-01-03"],
  ];
  for (const [index, origin] of mine.entries()) {
    const [country, city, latitude, longitude, day] =
      spots[index % spots.length];
    await request.post(`${base}/api/places`, {
      data: { origin: origin.id, country, city, latitude, longitude, day },
    });
  }
  await context.close();
  return group;
}

async function importZip() {
  const context = await browser.newContext();
  const request = context.request;
  const login = await request.post(`${base}/api/entry`, {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  const { group_id: group } = await login.json();
  const zip = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image\na=io.BytesIO(); z=zipfile.ZipFile(a,'w')\nfor n,c in [('harbour.jpg','#3b6e8f'),('harbour-copy.jpg','#3b6e8f'),('market.jpg','#a8643a')]:\n  p=io.BytesIO(); Image.new('RGB',(120,90),c).save(p,'JPEG',quality=60 if 'copy' in n else 90); z.writestr(n,p.getvalue())\nz.close(); sys.stdout.buffer.write(a.getvalue())",
  ]);
  const sha256 = createHash("sha256").update(zip).digest("hex");
  const { id } = await (
    await request.post(`${base}/api/imports/start`, {
      data: {
        group,
        source: "manual",
        namespace: "screenshot account",
        size: zip.length,
        sha256,
        options: {},
      },
    })
  ).json();
  await request.post(`${base}/api/imports/chunk`, {
    data: { id, offset: 0, data: zip.toString("base64") },
  });
  await request.post(`${base}/api/imports/finish`, { data: { id } });
  for (let i = 0; i < 40; i++) {
    const report = await (
      await request.get(`${base}/api/imports/${id}`)
    ).json();
    if (report.state === "INVENTORIED") break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await request.post(`${base}/api/imports/confirm`, { data: { id } });
  for (let i = 0; i < 40; i++) {
    const report = await (
      await request.get(`${base}/api/imports/${id}`)
    ).json();
    if (report.state === "COMPLETED") break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await context.close();
}

async function shoot(name, run, { user = "Alice", fresh = false } = {}) {
  if (only && !name.includes(only)) return;
  for (const theme of ["night", "day"]) {
    for (const size of sizes) {
      const context = await browser.newContext({
        ...(size.phone ? devices["iPhone 13"] : {}),
        ...(size.phone ? { deviceScaleFactor: 2 } : {}),
        viewport: size.viewport,
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        (value) => localStorage.setItem("mazi.theme", value),
        theme,
      );
      const page = await context.newPage();
      const visitor = fresh ? `${user} ${size.name} ${theme}` : user;
      await page.request.post(`${base}/api/entry`, {
        data: { name: visitor, code: "synthetic-shared-code" },
      });
      if (fresh)
        await page.request.post(`${base}/api/introduction/complete`, {
          data: {},
        });
      await run(page, size);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${out}/${name}-${size.name}-${theme}.jpg`,
        type: "jpeg",
        quality: 80,
      });
      await context.close();
    }
  }
}

const open = async (page, route, ready) => {
  await page.goto(`${base}/#${route}`);
  await page.locator(ready).first().waitFor();
};

const group = await setup();

await shoot("review-done", async (page) => {
  // The fixture leaves one same-day event suggestion; this state shows the queue emptied.
  await page.route("**/api/review/events?*", (route) =>
    route.fulfill({ json: [] }),
  );
  await open(page, "/review", "#done:not([hidden])");
});
if (!only) await importZip();

await shoot("imports", async (page) => {
  await page.route("**/api/imports?group=*", async (route) => {
    const list = await (await route.fetch()).json();
    if (list[0]) list[0].state = "PROCESSING";
    await route.fulfill({ json: list });
  });
  await page.route("**/api/imports/*?offset=0", async (route) => {
    const report = await (await route.fetch()).json();
    Object.assign(report, {
      state: "PROCESSING",
      discovered: 98,
      counts: { AVAILABLE_TO_GROUP: 41, PENDING: 55, UNSUPPORTED: 2 },
      unique_assets: 41,
    });
    await route.fulfill({ json: report });
  });
  await open(page, "/imports", "#imports .history-row");
  await page.locator("#imports .history-row").first().click();
  await page.locator("#report:not([hidden])").waitFor();
  await page.locator(".share-note").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
});
await shoot("imports-report", async (page) => {
  await page.route("**/api/imports/*?offset=0", async (route) => {
    const report = await (await route.fetch()).json();
    Object.assign(report, {
      state: "PROCESSING",
      discovered: 98,
      counts: { AVAILABLE_TO_GROUP: 41, PENDING: 55, UNSUPPORTED: 2 },
      unique_assets: 41,
    });
    await route.fulfill({ json: report });
  });
  await open(page, "/imports", "#imports .history-row");
  await page.locator("#imports .history-row").first().click();
  await page.locator("#report:not([hidden])").waitFor();
  await page
    .locator("#reports-title")
    .evaluate((node) => node.scrollIntoView());
});
await shoot(
  "imports-empty",
  async (page) => {
    await open(page, "/imports", "#first-import:not([hidden])");
  },
  { user: "Newcomer", fresh: true },
);
await shoot("imports-error", async (page) => {
  await page.route("**/api/imports?group=*", async (route) => {
    const list = await (await route.fetch()).json();
    if (list[0]) list[0].state = "FAILED";
    await route.fulfill({ json: list });
  });
  await page.route("**/api/imports/*?offset=0", async (route) => {
    const report = await (await route.fetch()).json();
    Object.assign(report, {
      state: "FAILED",
      source: "discord",
      error: "This file is not a Discord data package.",
      discovered: 0,
      counts: {},
      unique_assets: 0,
      items: [],
    });
    await route.fulfill({ json: report });
  });
  await open(page, "/imports", "#imports .history-row");
  await page.locator("#imports .history-row").first().click();
  await page.locator("#report-error:not([hidden])").waitFor();
  await page
    .locator("#reports-title")
    .evaluate((node) => node.scrollIntoView());
});

const twoCircles = async (page) => {
  await page.route("**/api/groups", async (route) => {
    const list = await (await route.fetch()).json();
    await route.fulfill({
      json: [
        ...list,
        { id: "synthetic-second", name: "Lisbon Erasmus", role: "member" },
      ],
    });
  });
};
await shoot("circle", async (page) => {
  await open(page, "/circle", "#members .member");
});
await shoot("circle-picker", async (page, size) => {
  await twoCircles(page);
  await open(page, "/circle", "#members .member");
  if (size.phone) {
    await page.locator("#circle-picker").click();
    await page.getByRole("dialog", { name: "Switch circle" }).waitFor();
  }
});

await shoot("review", async (page) => {
  await open(page, "/review", "#timeline article");
});
await shoot("review-card", async (page) => {
  await open(page, "/review", "#timeline article.needs-review");
  await page
    .locator("#timeline article.needs-review")
    .first()
    .evaluate((node) => node.scrollIntoView());
});
await shoot("review-merge", async (page) => {
  await open(page, "/review", "#duplicates article");
  await page
    .locator("#duplicates-title")
    .evaluate((node) => node.scrollIntoView());
});

await shoot("places", async (page) => {
  await open(page, "/places", "#places article");
});
await shoot("places-sources", async (page, size) => {
  await open(page, "/places", "#origin-counts .origin-row");
  if (size.phone) await page.getByRole("button", { name: /^Sources/ }).click();
  else
    await page
      .locator("#source-title")
      .evaluate((node) => node.scrollIntoView());
  await page.waitForTimeout(300);
});

const ask = async (page, question) => {
  await open(page, "/ask", "#private:not([hidden])");
  await page.getByLabel("Ask the archive").fill(question);
  await page.getByRole("button", { name: "Find evidence" }).click();
};
await shoot("ask", async (page) => {
  await ask(page, "Where was dinner?");
  await page.locator("#answer .answer-text").waitFor();
});
await shoot("ask-thinking", async (page) => {
  await page.route("**/api/answers/ask", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 60000));
    await route.continue().catch(() => {});
  });
  await ask(page, "Where was dinner?");
  await page.locator(".answer--thinking").waitFor();
});
await shoot("ask-none", async (page) => {
  await ask(page, "Was dinner our first trip ever?");
  await page.locator(".answer--none").waitFor();
});
await shoot("ask-evidence", async (page, size) => {
  await ask(page, "Where was dinner?");
  await page.locator("#answer .answer-text").waitFor();
  if (size.phone) {
    await page.locator(".evidence-toggle").click();
    await page
      .getByRole("dialog", { name: "Evidence for this answer" })
      .waitFor();
  } else
    await page
      .locator("#evidence-panel")
      .evaluate((node) => node.scrollIntoView());
});
await shoot("evidence-view", async (page) => {
  await ask(page, "Where was dinner?");
  await page.locator("#answer a.cite").first().click();
  await page.locator("#record .evidence-body").waitFor();
});

await shoot("about", async (page) => {
  await open(page, "/about", ".about-page");
});
await shoot("about-signout", async (page) => {
  await open(page, "/about", ".about-page");
  await page.locator(".about-sign-out").click();
  await page.getByRole("alertdialog").waitFor();
});

await browser.close();
console.log("group", group);
