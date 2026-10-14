import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

async function shell(page: Page) {
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator(".site-header")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(1);
  expect(await page.locator('a[href*="phase"]').count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function navigate(page: Page, name: string, route: string) {
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/${route}`));
  await shell(page);
}

test("one authenticated shell connects real Atlas, stories, discovery and evidence", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const login = await page.request.post("/api/login", {
    data: { email: "ben@example.test", password: "correct horse battery" },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/");
  await shell(page);
  await page
    .getByRole("button", { name: "Select Our summer", exact: true })
    .click();
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Our summer", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".photo-frame img")).toBeVisible();
  expect(await page.locator(".photo-frame img").getAttribute("src")).toContain(
    "/api/",
  );
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await navigate(page, "Memories", "memories");
  await expect(page.locator("#recap")).toContainText("Our summer");
  await page
    .getByRole("button", { name: "Start a story", exact: true })
    .click();
  await page
    .getByLabel("Your recollection")
    .fill("<img src=x onerror=alert(1)> A beautiful day.");
  await page
    .getByRole("button", { name: "Save my recollection", exact: true })
    .click();
  await expect(page.locator("#stories")).toContainText("You: <img");
  await expect(page.locator("#stories img[onerror]")).toHaveCount(0);
  await page.getByLabel("Sub-event title").fill("Morning");
  await page.getByRole("checkbox", { name: "Photo 1", exact: true }).check();
  await page
    .getByRole("button", { name: "Add sub-event", exact: true })
    .click();
  await expect(page.locator("#stories")).toContainText("Morning · 1 photos");
  await page
    .getByRole("button", { name: "Show slideshow", exact: true })
    .click();
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(page.locator("#stories")).toContainText("Photo 2 of 3");
  for (const [label, filename] of [
    ["Download video (AVI)", "mazi-memory.avi"],
    ["Export story JSON", "mazi-story.json"],
  ]) {
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
  }
  await page
    .getByLabel("Capsule title", { exact: true })
    .fill("Hidden surprise");
  await page.getByLabel("Note for the future").fill("These words stay sealed");
  await page.getByLabel("Opening time").fill("2030-01-01T12:00");
  await page.getByRole("button", { name: "Seal capsule", exact: true }).click();
  await expect(page.locator("#capsules")).toContainText("Sealed capsule");
  await expect(page.locator("#capsules")).not.toContainText(
    "These words stay sealed",
  );
  await page.getByLabel("Show in-app capsule notifications").check();
  await expect(page.locator("#notifications")).toBeEmpty();
  await navigate(page, "Search", "search");
  await expect(page.locator("#results article")).toHaveCount(3);
  await page.getByLabel("Search", { exact: true }).fill("bicycle");
  await page
    .getByRole("button", { name: "Search archive", exact: true })
    .click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await navigate(page, "Ask your archive", "ask");
  await page.getByLabel("Ask the archive").fill("When was bicycle?");
  await page
    .getByRole("button", { name: "Find evidence", exact: true })
    .click();
  await expect(page.locator("#answer")).toContainText("2024-01-02");
  await page
    .getByRole("link", { name: "View supporting record", exact: true })
    .click();
  await expect(page.locator("#record")).toContainText("Bicycle beside the sea");
  await shell(page);
  await navigate(page, "My Imports", "imports");
  await expect(
    page.getByRole("heading", { name: "Add a chapter" }),
  ).toBeVisible();
  await navigate(page, "Places & sources", "places");
  await expect(
    page.getByRole("heading", { name: "Your sources", exact: true }),
  ).toBeVisible();
  const sourceForm = page.locator("#source-form");
  await sourceForm
    .getByLabel("Name", { exact: true })
    .fill(`Synthetic browser source ${info.project.name}`);
  await sourceForm.getByLabel("From", { exact: true }).fill("2020-01-01");
  await sourceForm.getByLabel("Through", { exact: true }).fill("2030-01-01");
  await sourceForm
    .getByRole("button", { name: "Create paused source", exact: true })
    .click();
  await expect(page.locator("#sources")).toContainText(
    `Synthetic browser source ${info.project.name}`,
  );
  await expect(page.locator("#sources")).toContainText("Paused");
  await navigate(page, "Archive review", "review");
  await expect(page.locator("#timeline article")).toHaveCount(3);
  for (let i = 0; i < 2; i++) {
    await navigate(page, "Memories", "memories");
    await expect(page.locator("#stories")).toContainText("Morning · 1 photos");
    await navigate(page, "Home", "");
  }
  await navigate(page, "Memories", "memories");
  let saves = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/memories/write")
    )
      saves++;
  });
  await page.getByLabel("Your recollection").fill("Edited after navigation");
  await page
    .getByRole("button", { name: "Save my recollection", exact: true })
    .click();
  await expect(page.locator("#stories")).toContainText(
    "Edited after navigation",
  );
  expect(saves).toBe(1);
  await page
    .getByRole("heading", { name: "Our memories, in our words.", exact: true })
    .click();
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.screenshot({
    path: `work/poteto/unified-app/browser-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Delete capsule", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete story", exact: true }).click();
  await navigate(page, "My Imports", "imports");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#login")).toBeVisible();
  await expect(page.locator("#stories")).toHaveCount(0);
  expect((await page.request.get("/api/groups")).status()).toBe(403);
  expect(errors).toEqual([]);
});

test("new account import and circle/session transitions discard delayed private Atlas responses", async ({
  page,
}, info) => {
  const email = `unified-${info.project.name}-${Date.now()}@example.test`;
  await page.goto("/#/imports");
  await page.locator("#register input[name=email]").fill(email);
  await page
    .locator("#register input[name=password]")
    .fill("correct horse battery");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "Account created",
  );
  await page.locator("#login input[name=email]").fill(email);
  await page
    .locator("#login input[name=password]")
    .fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await navigate(page, "My Imports", "imports");
  await page.getByLabel("New group name").fill("Synthetic unified circle");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  const fixture = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(80,60),'red').save(p,'JPEG'); a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr('photo.jpg',p.getvalue()); p2=io.BytesIO(); Image.new('RGB',(80,60),'blue').save(p2,'JPEG'); z.writestr('second.jpg',p2.getvalue()); z.close(); sys.stdout.buffer.write(a.getvalue())",
  ]);
  await page.locator("#upload select[name=source]").selectOption("manual");
  await page.getByLabel("Source account label").fill("synthetic account");
  await page.getByLabel("Export ZIP").setInputFiles({
    name: "synthetic.zip",
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
  await expect(page.locator("#gallery article")).toHaveCount(2);
  await navigate(page, "Archive review", "review");
  await expect(page.locator("#timeline article")).toHaveCount(2);
  const firstGroup = await page.locator("#groups").inputValue();
  const timeline = await (
    await page.request.get(`/api/review/timeline?group=${firstGroup}`)
  ).json();
  const title = `Private event ${info.project.name}`;
  const eventResponse = await page.request.post("/api/review/event", {
    data: {
      group: firstGroup,
      assets: timeline.items.map((item: { id: string }) => item.id),
      title,
      decision: "accept",
    },
  });
  expect(eventResponse.ok()).toBe(true);
  const event = await eventResponse.json();
  expect(
    (
      await page.request.post("/api/memories/create", {
        data: { group: firstGroup, event: event.id },
      })
    ).ok(),
  ).toBe(true);
  const secondResponse = await page.request.post("/api/group", {
    data: { name: "Empty private circle" },
  });
  const secondGroup = (await secondResponse.json()).id;
  await navigate(page, "Memories", "memories");
  await expect(page.locator("#stories")).toContainText(title);

  // Hold a real authorized body while later loads and circle transitions finish.
  let release!: () => void;
  let held!: () => void;
  const captured = new Promise<void>((resolve) => {
    held = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delivered!: () => void;
  const delivery = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  let intercepted = false;
  await page.route("**/api/atlas?*", async (route) => {
    if (intercepted) return route.continue();
    intercepted = true;
    const response = await route.fetch();
    held();
    await gate;
    await route.fulfill({ response }).catch(() => {});
    delivered();
  });
  await navigate(page, "Home", "");
  await captured;
  await navigate(page, "Memories", "memories");
  await expect(page.locator("#stories")).toContainText(title);
  await page
    .getByLabel("Current circle", { exact: true })
    .selectOption(secondGroup);
  await expect(page.locator("#groups")).toHaveValue(secondGroup);
  await expect(page.locator("#stories")).toContainText("No shared stories");
  release();
  await delivery;
  await expect(page.getByLabel("Current circle", { exact: true })).toHaveValue(
    secondGroup,
  );
  await expect(page.locator("#stories")).not.toContainText(title);
  await navigate(page, "Home", "");
  await expect(
    page.getByRole("button", { name: `Select ${title}`, exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/atlas?*");

  await navigate(page, "Memories", "memories");
  await page
    .getByLabel("Current circle", { exact: true })
    .selectOption(firstGroup);
  await expect(page.locator("#stories")).toContainText(title);
  let releaseLogout!: () => void;
  let heldLogout!: () => void;
  const capturedLogout = new Promise<void>((resolve) => {
    heldLogout = resolve;
  });
  const logoutGate = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  let deliveredLogout!: () => void;
  const logoutDelivery = new Promise<void>((resolve) => {
    deliveredLogout = resolve;
  });
  intercepted = false;
  await page.route("**/api/atlas?*", async (route) => {
    if (intercepted) return route.continue();
    intercepted = true;
    const response = await route.fetch();
    heldLogout();
    await logoutGate;
    await route.fulfill({ response }).catch(() => {});
    deliveredLogout();
  });
  await navigate(page, "Home", "");
  await capturedLogout;
  await navigate(page, "My Imports", "imports");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#login")).toBeVisible();
  releaseLogout();
  await logoutDelivery;
  await navigate(page, "Home", "");
  await expect(
    page.getByRole("link", {
      name: "Sign in or create your circle",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Select ${title}`, exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Current circle", { exact: true })).toHaveCount(
    0,
  );
  expect((await page.request.get("/api/groups")).status()).toBe(403);
  await shell(page);
});

test("access loss clears private drafts and circle changes clear supporting records", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/login", {
        data: { email: "ben@example.test", password: "correct horse battery" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/ask");
  await page.getByLabel("Ask the archive").fill("When was bicycle?");
  await page
    .getByRole("button", { name: "Find evidence", exact: true })
    .click();
  await page
    .getByRole("link", { name: "View supporting record", exact: true })
    .click();
  await expect(page.locator("#record")).toContainText("Bicycle beside the sea");
  const initialGroup = await page
    .getByLabel("Current circle", { exact: true })
    .inputValue();
  const response = await page.request.post("/api/group", {
    data: { name: `Evidence privacy circle ${info.project.name}` },
  });
  const other = (await response.json()).id;
  // Reload retains the explicit evidence query while refreshing the circle inventory.
  await page.reload();
  await expect(page.locator("#record")).toContainText("Bicycle beside the sea");
  await page.getByLabel("Current circle", { exact: true }).selectOption(other);
  await expect(page.getByLabel("Current circle", { exact: true })).toHaveValue(
    other,
  );
  await expect(page.locator("#record")).not.toContainText(
    "Bicycle beside the sea",
  );
  await navigate(page, "Memories", "memories");
  await page
    .getByLabel("Current circle", { exact: true })
    .selectOption(initialGroup);
  await expect(page.locator("#recap")).toContainText("Our summer");
  await page
    .getByLabel("Note for the future")
    .fill("Private unsaved capsule draft");
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Refresh stories", exact: true })
    .click();
  await expect(page.locator("#capsule-text")).toHaveCount(0);
  await expect(page.locator("#recap")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  expect(
    await page
      .locator("textarea")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLTextAreaElement).value),
      ),
  ).not.toContain("Private unsaved capsule draft");
  await shell(page);
});
