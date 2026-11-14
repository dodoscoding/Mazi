import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { openFullMemory } from "./helpers/atlas";
import { followShellLink, signOut } from "./helpers/shell";

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
  await followShellLink(page, name);
  await expect(page).toHaveURL(new RegExp(`#/${route}`));
  await shell(page);
}

test("one authenticated shell connects real Atlas, stories, discovery and evidence", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const login = await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  expect(login.ok()).toBe(true);
  const profile = await login.json();
  const initialRecords = await (
    await page.request.get(`/api/archive?group=${profile.group_id}`)
  ).json();
  const initialCount = initialRecords.length;
  const storiesResponse = await page.request.get(
    `/api/memories/stories?group=${profile.group_id}`,
  );
  expect(storiesResponse.ok()).toBe(true);
  for (const story of await storiesResponse.json()) {
    if (!story.can_delete || story.event.title !== "Our summer") continue;
    expect(
      (
        await page.request.post("/api/memories/delete", {
          data: {
            group: profile.group_id,
            story: story.id,
            revision: story.revision,
          },
        })
      ).ok(),
    ).toBe(true);
  }
  const currentStory = page
    .locator("#stories > article")
    .filter({
      has: page.getByRole("heading", { name: "Our summer", exact: true }),
    })
    .filter({
      has: page.getByRole("button", { name: "Delete story", exact: true }),
    });
  await page.goto("/#/atlas");
  await shell(page);
  await page
    .getByRole("button", { name: "Our summer anısını seç", exact: true })
    .click();
  await openFullMemory(page);
  await expect(
    page.getByRole("heading", { name: "Our summer", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".viewer-track .photo-frame img")).toBeVisible();
  expect(
    await page.locator(".viewer-track .photo-frame img").getAttribute("src"),
  ).toContain("/api/");
  await page
    .getByRole("button", { name: "Sonraki fotoğraf", exact: true })
    .click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await navigate(page, "Fotoğraflar", "memories");
  await expect(page.locator("#recap")).toContainText("Our summer");
  await page
    .getByRole("button", { name: "Start a story", exact: true })
    .click();
  await currentStory
    .getByRole("textbox", { name: "Your recollection", exact: true })
    .fill("<img src=x onerror=alert(1)> A beautiful day.");
  await currentStory
    .getByRole("button", { name: "Save my recollection", exact: true })
    .click();
  await expect(page.locator("#stories")).toContainText("You: <img");
  await expect(page.locator("#stories img[onerror]")).toHaveCount(0);
  await currentStory.getByLabel("Sub-event title").fill("Morning");
  await currentStory
    .getByRole("checkbox", { name: "Photo 1", exact: true })
    .check();
  await currentStory
    .getByRole("button", { name: "Add sub-event", exact: true })
    .click();
  await expect(page.locator("#stories")).toContainText("Morning · 1 photos");
  await currentStory
    .getByRole("button", { name: "Show slideshow", exact: true })
    .click();
  await currentStory
    .getByRole("button", { name: "Next photo", exact: true })
    .click();
  await expect(page.locator("#stories")).toContainText("Photo 2 of 3");
  for (const [label, filename] of [
    ["Download video (AVI)", "mazi-memory.avi"],
    ["Export story JSON", "mazi-story.json"],
  ]) {
    const downloading = page.waitForEvent("download");
    await currentStory
      .getByRole("button", { name: label, exact: true })
      .click();
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
  await expect(page.locator("#results article")).toHaveCount(initialCount);
  await page.getByLabel("Ara", { exact: true }).fill("bicycle");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
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
    page.getByRole("heading", { name: "Kaynak bağlantıları", exact: true }),
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
  await expect(page.locator("#timeline article")).toHaveCount(initialCount);
  for (let i = 0; i < 2; i++) {
    await navigate(page, "Fotoğraflar", "memories");
    await expect(page.locator("#stories")).toContainText("Morning · 1 photos");
    await navigate(page, "Home", "");
  }
  await navigate(page, "Fotoğraflar", "memories");
  let saves = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/memories/write")
    )
      saves++;
  });
  await currentStory
    .getByRole("textbox", { name: "Your recollection", exact: true })
    .fill("Edited after navigation");
  await currentStory
    .getByRole("button", { name: "Save my recollection", exact: true })
    .click();
  await expect(page.locator("#stories")).toContainText(
    "Edited after navigation",
  );
  expect(saves).toBe(1);
  await page
    .getByRole("heading", { name: "Fotoğraflar", exact: true, level: 1 })
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
  await currentStory
    .getByRole("button", { name: "Delete story", exact: true })
    .click();
  await navigate(page, "My Imports", "imports");
  await signOut(page);
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator("#stories")).toHaveCount(0);
  expect((await page.request.get("/api/groups")).status()).toBe(403);
  expect(errors).toEqual([]);
});

test("named profile imports and logout discard delayed private Atlas responses", async ({
  page,
}, info) => {
  await page.goto("/#/imports");
  await page
    .getByLabel("Your name")
    .fill(`Importer ${info.project.name} ${Date.now()}`);
  await page.getByLabel("Shared code").fill("synthetic-shared-code");
  await page.getByRole("button", { name: "Enter Mazi", exact: true }).click();
  await page
    .getByRole("button", { name: "Open the Atlas", exact: true })
    .click();
  await navigate(page, "My Imports", "imports");
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
  const profile = await (await page.request.get("/api/session")).json();
  const importedRecords = await (
    await page.request.get(`/api/archive?group=${profile.group_id}`)
  ).json();
  const importedNames = importedRecords.flatMap(
    (item: { origins: { original_filename: string }[] }) =>
      item.origins.map((origin) => origin.original_filename),
  );
  expect(importedNames).toEqual(
    expect.arrayContaining(["photo.jpg", "second.jpg"]),
  );
  await expect(page.locator("#gallery article")).toHaveCount(
    importedRecords.length,
  );
  await navigate(page, "Archive review", "review");
  await expect(page.locator("#timeline article")).toHaveCount(
    importedRecords.length,
  );
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
  const storyResponse = await page.request.post("/api/memories/create", {
    data: { group: firstGroup, event: event.id },
  });
  expect(storyResponse.ok()).toBe(true);
  const story = await storyResponse.json();
  await navigate(page, "Fotoğraflar", "memories");
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
  let intercepted = false;
  let privatePreviewTitle = "";
  await page.route("**/api/social/home?*", async (route) => {
    if (intercepted) return route.continue();
    intercepted = true;
    const response = await route.fetch();
    const payload = await response.json();
    privatePreviewTitle =
      payload.featured?.memory?.title ||
      payload.featured?.preview?.title ||
      payload.featured?.plan?.title;
    expect(privatePreviewTitle).toBeTruthy();
    heldLogout();
    await logoutGate;
    await route.fulfill({ response }).catch(() => {});
    deliveredLogout();
  });
  await navigate(page, "Home", "");
  await capturedLogout;
  await expect(
    page.getByRole("heading", { name: "Birlikte hatırlayalım", exact: true }),
  ).toBeVisible();
  await navigate(page, "My Imports", "imports");
  await expect(
    page.getByRole("heading", {
      name: "İçe aktarmalar",
      exact: true,
      level: 1,
    }),
  ).toBeFocused();
  expect(
    (
      await page.request.post("/api/memories/delete", {
        data: { group: firstGroup, story: story.id, revision: story.revision },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/review/event", {
        data: {
          group: firstGroup,
          assets: timeline.items.map((item: { id: string }) => item.id),
          title,
          decision: "undo",
        },
      })
    ).ok(),
  ).toBe(true);
  await signOut(page);
  await expect(page.getByLabel("Shared code")).toBeVisible();
  releaseLogout();
  await logoutDelivery;
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(
    page.locator(".home-featured, .home-plan, .activity-list"),
  ).toHaveCount(0);
  await expect(
    page.getByText(privatePreviewTitle, { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `${title} anısını seç`, exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hesap" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ekle" })).toHaveCount(0);
  expect((await page.request.get("/api/groups")).status()).toBe(403);
});

test("access loss clears private drafts and supporting records", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
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
  await navigate(page, "Fotoğraflar", "memories");
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
  await expect(page.getByLabel("Shared code")).toBeVisible();
  expect(
    await page
      .locator("textarea")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLTextAreaElement).value),
      ),
  ).not.toContain("Private unsaved capsule draft");
});

test("shared viewer opens directly and restores Globe and browse state", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/atlas");
  await page
    .getByRole("button", { name: "Our summer anısını seç", exact: true })
    .click();
  const origin = page.url();
  await page.getByRole("link", { name: "Anıyı aç", exact: true }).click();
  await expect(page.locator(".viewer")).toBeVisible();
  await expect(page.locator(".dossier")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Sonraki fotoğraf", exact: true })
    .click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/photo=1/);
  expect(
    await page
      .locator(".viewer-track img")
      .evaluate((image) => getComputedStyle(image).objectFit),
  ).toBe("contain");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(origin);
  await expect(page.locator("#featured-title")).toContainText("Our summer");
  await page.goto("/#/timeline");
  if (info.project.name === "desktop")
    await page
      .getByRole("button", { name: "Önce en yeniler", exact: true })
      .click();
  const card = page.locator(".tl-card").filter({ hasText: "Our summer" });
  await card.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await card.click();
  await expect(page.locator(".viewer")).toBeVisible();
  await page.getByRole("link", { name: "Geri", exact: true }).click();
  await expect(page).toHaveURL(/#\/timeline$/);
  if (info.project.name === "desktop")
    await expect(
      page.getByRole("button", { name: "Önce en yeniler", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
  await card.click();
  await expect(page.locator(".viewer")).toBeVisible();
  await page.goBack();
  if (info.project.name === "desktop")
    await expect(
      page.getByRole("button", { name: "Önce en yeniler", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: `work/poteto/app-simplification/viewer-return-${info.project.name}.png`,
  });
});

test("shared viewer preserves individual-photo selection and closes to filtered gallery", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/memories?view=all&order=oldest&years=2024");
  const photo = page.locator('.mem-tile[href*="photo=1"]').first();
  await photo.scrollIntoViewIfNeeded();
  const origin = page.url();
  const selected = await photo.getAttribute("href");
  await photo.click();
  await expect(page).toHaveURL(
    new RegExp(selected!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"),
  );
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Fotoğrafı kapat", exact: true })
    .click();
  await expect(page).toHaveURL(origin);
  await expect(photo).toBeFocused();
  await expect(page.locator(".mem-tile")).toHaveCount(3);
});

test("shared viewer keeps Conversation context optional and supports keyboard photos", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/atlas");
  await page
    .getByRole("button", { name: "Our summer anısını seç", exact: true })
    .click();
  await openFullMemory(page);
  await page
    .getByRole("button", { name: "Sonraki fotoğraf", exact: true })
    .click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await expect(
    page.getByText("“Anyone checked the ferry time?”", { exact: true }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Konuşmayı göster", exact: true })
    .click();
  await expect(
    page.getByText("Worth missing the ferry for.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kaynak bilgileri", exact: true }),
  ).toBeVisible();
  await page.locator(".viewer").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("3 / 3", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `work/poteto/app-simplification/viewer-context-${info.project.name}.png`,
    fullPage: true,
  });
});

test("shared viewer clears retained private media when the session is lost", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/memories?view=all");
  await page.locator(".mem-tile").first().click();
  await expect(page.locator(".viewer")).toBeVisible();
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(
    page.locator(".viewer, .mem-tile, .facts, .conversation"),
  ).toHaveCount(0);
  expect(
    (
      await page.request.get("/api/atlas/memory?group=missing&memory=missing")
    ).status(),
  ).toBe(403);
});

test("Add imports, recovers failures and shares successful photographs automatically", async ({
  page,
}, info) => {
  const login = await page.request.post("/api/entry", {
    data: {
      name: "Ben",
      code: "synthetic-shared-code",
    },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/#/add");
  await expect(
    page.getByRole("heading", { name: "Add", exact: true, level: 1 }),
  ).toBeVisible();
  const filename = `add-${info.project.name}-${Date.now()}.jpg`;
  const fixture = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(83,61),(51,78,121)).save(p,'JPEG'); a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr(sys.argv[1],p.getvalue()); z.writestr('broken.jpg',b'not a photograph'); z.close(); sys.stdout.buffer.write(a.getvalue())",
    filename,
  ]);
  await page.locator("#upload select[name=source]").selectOption("manual");
  await page.getByLabel("Source account label").fill("Add synthetic archive");
  await page.getByLabel("Export ZIP").setInputFiles({
    name: "add.zip",
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
  await expect(page.locator("#report-summary")).toContainText(
    "1 available to group",
  );
  await expect(page.locator("#items")).toContainText("invalid media");
  const retrying = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/imports/retry") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Retry item", exact: true }).click();
  const retry = await retrying;
  expect(retry.ok()).toBe(true);
  const retriedRun = retry.request().postDataJSON().id;
  await expect
    .poll(async () => {
      const report = await (
        await page.request.get(`/api/imports/${retriedRun}`)
      ).json();
      return report.state;
    })
    .toBe("COMPLETED");
  await expect(page.locator("#report-title")).toContainText("completed");
  await expect(
    page.getByRole("button", { name: "Retry item", exact: true }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download outcome report", exact: true })
    .click();
  expect((await downloading).suggestedFilename()).toBe(
    "mazi-import-report.json",
  );
  const profile = await login.json();
  const records = await (
    await page.request.get(`/api/archive?group=${profile.group_id}`)
  ).json();
  const imported = records.find(
    (record: { origins: { original_filename: string }[] }) =>
      record.origins.some((origin) => origin.original_filename === filename),
  );
  expect(imported).toBeTruthy();
  await page.goto("/#/atlas");
  await expect(
    page
      .getByRole("button", {
        name: "Untitled photograph anısını seç",
        exact: true,
      })
      .filter({ has: page.locator(`img[src$="/${imported.id}"]`) }),
  ).toBeVisible();
  await page.goto("/#/add");
  await expect(page.locator("#imports")).toContainText("Done");
  await page.screenshot({
    path: `work/poteto/app-simplification/add-${info.project.name}.png`,
    animations: "disabled",
    fullPage: true,
  });
});

test("Add preserves inventory cancellation, history and session-loss clearing", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/atlas");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await page.getByRole("link", { name: "Add", exact: true }).click();
  await expect(page).toHaveURL(/#\/add$/);
  const fixture = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr('cancelled.jpg',b'cancel before processing'); z.close(); sys.stdout.buffer.write(a.getvalue())",
  ]);
  await page.locator("#upload select[name=source]").selectOption("manual");
  await page
    .getByLabel("Source account label")
    .fill("cancelled synthetic archive");
  await page.getByLabel("Export ZIP").setInputFiles({
    name: "cancel.zip",
    mimeType: "application/zip",
    buffer: fixture,
  });
  await page
    .getByRole("button", { name: "Upload and inspect inventory", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("inventoried");
  await page
    .getByRole("button", { name: "Cancel remaining work", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("cancelled");
  await expect(page.locator("#report-summary")).toContainText(
    "0 unique photos",
  );
  await page.reload();
  await expect(page.locator("#imports")).toContainText("Cancelled");
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator("#imports")).toHaveCount(0);
});

test("viewer corrects one photograph and withdraws only its owned contribution", async ({
  page,
  browser,
}, info) => {
  const other = await browser.newContext();
  const nonce = `${info.project.name}-${Date.now()}`;
  const login = await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  expect(login.ok()).toBe(true);
  const profile = await login.json();
  expect(
    (
      await other.request.post(
        new URL("/api/entry", info.project.use.baseURL as string).href,
        { data: { name: "Ben", code: "synthetic-shared-code" } },
      )
    ).ok(),
  ).toBe(true);
  const imported: { request: typeof page.request; id: string }[] = [];
  try {
    for (const [request, owner] of [
      [page.request, "Alice"],
      [other.request, "Ben"],
    ] as const) {
      const fixture = execFileSync(".venv/bin/python", [
        "-c",
        "import hashlib,io,sys,zipfile; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(91,59),tuple(hashlib.sha256(sys.argv[2].encode()).digest()[:3])).save(p,'JPEG'); a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr('proof.jpg',p.getvalue()); z.writestr('_chat.txt','01/02/2020, 12:00 - '+sys.argv[1]+': proof.jpg (file attached)\\n01/02/2020, 12:01 - '+sys.argv[1]+': '+sys.argv[1]+' private context '+sys.argv[2]+'\\n'); z.close(); sys.stdout.buffer.write(a.getvalue())",
        owner,
        nonce,
      ]);
      const base = info.project.use.baseURL as string;
      const url = (path: string) => new URL(path, base).href;
      const start = await request.post(url("/api/imports/start"), {
        data: {
          group: profile.group_id,
          source: "whatsapp",
          namespace: `viewer-${owner}-${nonce}`,
          size: fixture.length,
          sha256: createHash("sha256").update(fixture).digest("hex"),
          options: {},
        },
      });
      expect(start.ok()).toBe(true);
      const { id } = await start.json();
      imported.push({ request, id });
      expect(
        (
          await request.post(url("/api/imports/chunk"), {
            data: { id, offset: 0, data: fixture.toString("base64") },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (await request.post(url("/api/imports/finish"), { data: { id } })).ok(),
      ).toBe(true);
      await expect
        .poll(
          async () =>
            (await (await request.get(url(`/api/imports/${id}`))).json()).state,
        )
        .toBe("INVENTORIED");
      expect(
        (
          await request.post(url("/api/imports/confirm"), { data: { id } })
        ).ok(),
      ).toBe(true);
      await expect
        .poll(
          async () =>
            (await (await request.get(url(`/api/imports/${id}`))).json()).state,
        )
        .toBe("COMPLETED");
    }
    const archive = await (
      await page.request.get(`/api/archive?group=${profile.group_id}`)
    ).json();
    const photograph = archive.find(
      (item: { origins: { source_account_namespace: string }[] }) =>
        item.origins.some(
          (origin) =>
            origin.source_account_namespace === `viewer-Alice-${nonce}`,
        ),
    );
    expect(photograph).toBeTruthy();
    const asset = photograph.id;
    const origins = `/api/archive/${asset}/origins`;
    const originalAssertions = await (await page.request.get(origins)).json();
    const atlas = await (
      await page.request.get(`/api/atlas?group=${profile.group_id}`)
    ).json();
    const memory = atlas.memories.find(
      (item: { photos: { assetId: string }[] }) =>
        item.photos.some((photo) => photo.assetId === asset),
    );
    await page.goto(`/#/memory/${memory.id}`);
    await page
      .getByRole("button", { name: "Tarihi düzelt", exact: true })
      .click();
    const editor = page.getByRole("form", {
      name: "Seçili fotoğrafı düzelt",
      exact: true,
    });
    await editor.getByLabel("Çekim tarihi", { exact: true }).fill("2021-05-06");
    await editor.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.locator(".viewer-caption-text")).toContainText(
      "6 May 2021",
    );
    await page.getByRole("button", { name: "Yer ekle", exact: true }).click();
    await editor
      .getByLabel("Yer", { exact: true })
      .fill("Synthetic uncertain garden");
    let fail = true;
    await page.route("**/api/atlas/photo", async (route) => {
      if (route.request().method() !== "POST" || !fail) return route.continue();
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic write outage" }),
      });
    });
    await editor.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(editor).toContainText("Taslağınız korundu");
    await expect(editor.getByLabel("Yer", { exact: true })).toHaveValue(
      "Synthetic uncertain garden",
    );
    await editor.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.locator(".viewer-caption-text")).toContainText(
      "Synthetic uncertain garden",
    );
    expect(await (await page.request.get(origins)).json()).toEqual(
      originalAssertions,
    );
    await page.goto("/#/photos");
    await page
      .getByRole("combobox", { name: "Yıl", exact: true })
      .selectOption("2021");
    await expect(
      page.getByRole("region", { name: "Mayıs 2021", exact: true }),
    ).toBeVisible();
    await page.locator(`.mem-tile[href*="/memory/${memory.id}"]`).click();
    await expect(page.locator(".viewer-caption-text")).toContainText(
      "Synthetic uncertain garden",
    );
    await expect(
      page.getByRole("button", { name: "Katkımı yönet", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Katkımı yönet", exact: true })
      .click();
    const contributions = page.getByRole("region", {
      name: "Seçili fotoğrafa katkılarım",
      exact: true,
    });
    await expect(contributions).toContainText("proof.jpg");
    await contributions
      .getByRole("button", { name: "Katkıyı kaldır", exact: true })
      .click();
    let failRemoval = true;
    await page.route("**/api/review/delete-contribution", async (route) => {
      if (!failRemoval) return route.continue();
      failRemoval = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic removal outage" }),
      });
    });
    await contributions
      .getByRole("button", { name: "Paylaşımı kaldır", exact: true })
      .click();
    await expect(contributions).toContainText("Katkı kaldırılamadı");
    await expect(contributions).toContainText("proof.jpg");
    await contributions
      .getByRole("button", { name: "Paylaşımı kaldır", exact: true })
      .click();
    await expect
      .poll(async () => (await (await page.request.get(origins)).json()).total)
      .toBe(1);
    await page.reload();
    await page
      .getByRole("button", { name: "Katkımı yönet", exact: true })
      .click();
    await expect(contributions).toContainText(
      "Bu fotoğrafta etkin katkınız yok",
    );
    await expect(page.locator(".photo-frame img")).toBeVisible();
    await page
      .getByRole("button", { name: "Konuşmayı göster", exact: true })
      .click();
    await expect(
      page.getByText(`Ben private context ${nonce}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`Alice private context ${nonce}`, { exact: true }),
    ).toHaveCount(0);
    expect((await (await page.request.get(origins)).json()).total).toBe(1);
    await page.screenshot({
      path: `work/poteto/app-simplification/contribution-${info.project.name}.png`,
      animations: "disabled",
      fullPage: true,
    });
    expect(
      (
        await other.request.post(
          new URL("/api/imports/withdraw", info.project.use.baseURL as string)
            .href,
          { data: { id: imported[1].id } },
        )
      ).ok(),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Anı bulunamadı", exact: true }),
    ).toBeVisible();
    await page.goto("/#/photos");
    await expect(page.locator(".mem-tile").first()).toBeVisible();
    await expect(
      page.locator(`.mem-tile[href*="/memory/${memory.id}"]`),
    ).toHaveCount(0);
  } finally {
    for (const item of imported)
      await item.request.post(
        new URL("/api/imports/withdraw", info.project.use.baseURL as string)
          .href,
        { data: { id: item.id } },
      );
    await other.close();
  }
});

test("viewer contribution controls recover a failed read and clear on session loss", async ({
  page,
}) => {
  const login = await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  const profile = await login.json();
  const atlas = await (
    await page.request.get(`/api/atlas?group=${profile.group_id}`)
  ).json();
  const memory = atlas.memories.find(
    (item: { title: string }) => item.title === "Our summer",
  );
  expect(memory).toBeTruthy();
  let fail = true;
  await page.route(/\/api\/review\/my-contributions\?/, async (route) => {
    if (!fail) return route.continue();
    fail = false;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic contribution read outage" }),
    });
  });
  await page.goto(`/#/memory/${memory.id}`);
  await page
    .getByRole("button", { name: "Katkımı yönet", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Seçili fotoğrafa katkılarım",
    exact: true,
  });
  await expect(panel).toContainText("Katkılarınız yüklenemedi");
  await panel
    .getByRole("button", { name: "Yeniden dene", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Katkıyı kaldır", exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Katkıyı kaldır", exact: true })
    .click();
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await panel
    .getByRole("button", { name: "Paylaşımı kaldır", exact: true })
    .click();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".photo-frame img")).toHaveCount(0);
});
