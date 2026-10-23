import { test, expect } from "@playwright/test";

async function enter(page: import("@playwright/test").Page, name = "Ben") {
  const response = await page.request.post("/api/entry", {
    data: { name, code: "synthetic-shared-code" },
  });
  expect(response.ok()).toBe(true);
  const { group_id: group } = await response.json();
  const { memories } = await (
    await page.request.get(`/api/atlas?group=${group}`)
  ).json();
  const event = memories.find(
    (memory: { kind: string }) => memory.kind === "memory",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  return { group, event };
}

test("event notebook saves, reloads, edits and removes only your note", async ({
  page,
  browser,
}) => {
  const { group, event } = await enter(page);
  await page.goto(`/#/memory/${event.id}?notebook=1`);
  await expect(page.locator(".memory-detail h1")).toBeFocused();
  await page.getByRole("button", { name: "Add your recollection" }).click();
  await page
    .getByLabel("Your recollection", { exact: true })
    .fill("The long summer evening.");
  await page
    .getByRole("button", { name: "Save recollection", exact: true })
    .click();
  await expect(page.locator(".event-notebook")).toContainText(
    "The long summer evening.",
  );
  await page.reload();
  await expect(page.locator(".event-notebook")).toContainText(
    "The long summer evening.",
  );
  const other = await browser.newContext();
  const alice = await other.newPage();
  await alice.goto(page.url());
  await enter(alice, "Alice");
  await alice.reload();
  await expect(alice.locator(".event-notebook")).toContainText(
    "The long summer evening.",
  );
  await expect(
    alice.getByRole("button", { name: "Edit your recollection" }),
  ).toHaveCount(0);
  await other.close();
  await page.getByRole("button", { name: "Edit your recollection" }).click();
  await page
    .getByLabel("Your recollection", { exact: true })
    .fill("The evening we remember.");
  await page
    .getByRole("button", { name: "Save recollection", exact: true })
    .click();
  await expect(page.locator(".event-notebook")).toContainText(
    "The evening we remember.",
  );
  await page.getByRole("button", { name: "Edit your recollection" }).click();
  await page.getByRole("button", { name: "Remove my recollection" }).click();
  await expect(page.locator(".event-notebook")).not.toContainText(
    "The evening we remember.",
  );
  const saved = await (
    await page.request.get(
      `/api/memories/notebook?group=${group}&event=${event.id}`,
    )
  ).json();
  expect(
    saved.sections.flatMap((section: { notes: unknown[] }) => section.notes),
  ).toEqual([]);
});

const notebook = (eventId: string, revision = 1) => ({
  eventId,
  sections: [
    {
      id: "first-story",
      notes: [
        {
          id: "first-story:mine",
          authorName: "Ben",
          text: "My earlier recollection",
          ownership: {
            kind: "mine",
            target: { kind: "saved", storyId: "first-story", revision },
          },
        },
        {
          id: "first-story:other",
          authorName: "Alice",
          text: "Alice's recollection",
          ownership: { kind: "other" },
        },
      ],
    },
    {
      id: "second-story",
      notes: [
        {
          id: "second-story:mine",
          authorName: "Ben",
          text: "My later recollection",
          ownership: {
            kind: "mine",
            target: { kind: "saved", storyId: "second-story", revision },
          },
        },
      ],
    },
  ],
});

test("all legacy notes remain readable and conflict recovery targets the selected story", async ({
  page,
}) => {
  const { event } = await enter(page);
  let revision = 1;
  let attempts = 0;
  const writes: {
    target: { storyId: string; revision: number };
    text: string;
  }[] = [];
  await page.route("**/api/memories/notebook?*", (route) =>
    route.fulfill({ json: notebook(event.id, revision) }),
  );
  await page.route("**/api/memories/note", async (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    attempts++;
    if (attempts === 1)
      return route.fulfill({ status: 503, json: { error: "Busy" } });
    if (attempts === 2) {
      revision = 2;
      return route.fulfill({ status: 409, json: { error: "Changed" } });
    }
    const saved = notebook(event.id, 3);
    saved.sections[1].notes[0].text = body.text;
    return route.fulfill({ json: saved });
  });
  await page.goto(`/#/memory/${event.id}?notebook=1`);
  const region = page.locator(".event-notebook");
  await expect(region).toContainText("Alice's recollection");
  await expect(region).toContainText("My earlier recollection");
  await expect(region).toContainText("My later recollection");
  await page
    .getByRole("button", { name: "Edit your recollection" })
    .nth(1)
    .click();
  const draft = page.getByLabel("Your recollection", { exact: true });
  await expect(draft).toHaveValue("My later recollection");
  await draft.fill("My retained draft");
  const save = page.getByRole("button", {
    name: "Save recollection",
    exact: true,
  });
  await save.click();
  await expect(region.getByRole("alert")).toContainText("draft is still here");
  await expect(draft).toHaveValue("My retained draft");
  await save.click();
  await expect(
    page.getByRole("button", { name: "Refresh saved notes" }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Refresh saved notes" }).click();
  await expect(draft).toHaveValue("My retained draft");
  await expect(draft).toBeFocused();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(draft).toHaveCount(0);
  await expect(region).toContainText("My retained draft");
  expect(writes.map((write) => write.target)).toEqual([
    { kind: "saved", storyId: "second-story", revision: 1 },
    { kind: "saved", storyId: "second-story", revision: 1 },
    { kind: "saved", storyId: "second-story", revision: 2 },
  ]);
});

test("lost first-save response refreshes the saved target and keeps the draft", async ({
  page,
}) => {
  const { event } = await enter(page);
  let committed = false;
  let attempts = 0;
  await page.route("**/api/memories/notebook?*", (route) =>
    route.fulfill({
      json: committed
        ? notebook(event.id, 2)
        : { eventId: event.id, sections: [] },
    }),
  );
  await page.route("**/api/memories/note", async (route) => {
    attempts++;
    const body = route.request().postDataJSON();
    if (attempts === 1) {
      committed = true;
      return route.abort("failed");
    }
    if (body.target.kind === "new")
      return route.fulfill({ status: 409, json: { error: "Already saved" } });
    expect(body.target).toEqual({
      kind: "saved",
      storyId: "first-story",
      revision: 2,
    });
    const saved = notebook(event.id, 3);
    saved.sections[0].notes[0].text = body.text;
    await route.fulfill({ json: saved });
  });
  await page.goto(`/#/memory/${event.id}?notebook=1`);
  await page.getByRole("button", { name: "Add your recollection" }).click();
  const draft = page.getByLabel("Your recollection", { exact: true });
  await draft.fill("The draft after a lost response");
  const save = page.getByRole("button", {
    name: "Save recollection",
    exact: true,
  });
  await save.click();
  await expect(page.getByRole("alert")).toContainText("connection failed");
  await save.click();
  await page.getByRole("button", { name: "Refresh saved notes" }).click();
  await expect(draft).toHaveValue("The draft after a lost response");
  await save.click();
  await expect(draft).toHaveCount(0);
  expect(attempts).toBe(3);
});

test("background clearing discards notes and drafts and ignores a late save", async ({
  page,
}) => {
  const { event } = await enter(page);
  await page.route("**/api/memories/notebook?*", (route) =>
    route.fulfill({ json: notebook(event.id) }),
  );
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saving = false;
  await page.route("**/api/memories/note", async (route) => {
    saving = true;
    await gate;
    await route.fulfill({ json: notebook(event.id, 2) }).catch(() => {});
  });
  await page.goto(`/#/memory/${event.id}?notebook=1`);
  await page
    .getByRole("button", { name: "Edit your recollection" })
    .first()
    .click();
  await page
    .getByLabel("Your recollection", { exact: true })
    .fill("Private unsaved draft");
  await page
    .getByRole("button", { name: "Save recollection", exact: true })
    .click();
  await expect.poll(() => saving).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  release();
  await expect(page.locator("body")).not.toContainText("Private unsaved draft");
  await expect(page.locator(".notebook-note")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".event-notebook")).toContainText(
    "Alice's recollection",
  );
  await expect(
    page.getByLabel("Your recollection", { exact: true }),
  ).toHaveCount(0);
});

test("event title links open imported excerpts and all notebook entry points use event IDs", async ({
  page,
}) => {
  const { group, event } = await enter(page);
  const memories = (
    await (await page.request.get(`/api/atlas?group=${group}`)).json()
  ).memories;
  event.messages = [
    {
      name: "Alice",
      time: "2024-01-02 12:00",
      text: "Keep this summer afternoon.",
    },
  ];
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({
      json: {
        memories: memories.map((memory: { id: string }) =>
          memory.id === event.id ? event : memory,
        ),
      },
    }),
  );
  await page.addInitScript(() => sessionStorage.setItem("mazi.intro", "seen"));
  await page.goto(`/#/?selected=${event.id}`);
  const title = page.locator("#featured-title a");
  await expect(title).toHaveAttribute(
    "href",
    `#/memory/${event.id}?notebook=1`,
  );
  await title.click();
  await expect(page.locator(".memory-detail h1")).toBeFocused();
  await expect(page.locator(".conversation blockquote")).toBeInViewport();
  await expect(page.locator(".conversation")).toContainText(
    "Imported excerpts",
  );
  await page.goto("/#/review");
  await expect(page.locator("#reviewed-events h3 a").first()).toHaveAttribute(
    "href",
    `#/memory/${event.id}?notebook=1`,
  );
  await page.goto("/#/memories");
  await page
    .getByRole("button", { name: "Start a story", exact: true })
    .click();
  await expect(page.locator("#stories h3 a").first()).toHaveAttribute(
    "href",
    `#/memory/${event.id}?notebook=1`,
  );
  await expect(page.locator("#recap h3 a").first()).toHaveAttribute(
    "href",
    `#/memory/${event.id}?notebook=1`,
  );
});

test("standalone photographs and sample mode never load private recollections", async ({
  page,
}) => {
  const { event } = await enter(page);
  let requests = 0;
  await page.route("**/api/memories/notebook?*", (route) => {
    requests++;
    return route.fulfill({ json: notebook(event.id) });
  });
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({ json: { memories: [{ ...event, kind: "photo" }] } }),
  );
  await page.goto(`/#/memory/${event.id}`);
  await expect(page.locator(".memory-detail h1")).toHaveText(event.title);
  await expect(page.locator(".event-notebook")).toHaveCount(0);
  await page.goto("/?demo=1#/memory/last-ferry");
  await expect(page.locator(".memory-detail h1")).toBeVisible();
  await expect(page.locator(".event-notebook")).toHaveCount(0);
  expect(requests).toBe(0);
});

test("pending saves block duplicates, keep newer typing and clear on access loss", async ({
  page,
}) => {
  const { event } = await enter(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route("**/api/memories/notebook?*", (route) =>
    route.fulfill({ json: notebook(event.id) }),
  );
  await page.route("**/api/memories/note", async (route) => {
    writes++;
    await gate;
    await route.fulfill({ json: notebook(event.id, 2) });
  });
  await page.goto(`/#/memory/${event.id}?notebook=1`);
  await page
    .getByRole("button", { name: "Edit your recollection" })
    .first()
    .click();
  const draft = page.getByLabel("Your recollection", { exact: true });
  await draft.fill("First saved draft");
  await page.locator(".notebook-editor").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect.poll(() => writes).toBe(1);
  await expect(
    page.getByRole("button", { name: "Save recollection", exact: true }),
  ).toBeDisabled();
  await draft.fill("Newer typing stays here");
  release();
  await expect(
    page.getByRole("button", { name: "Save recollection", exact: true }),
  ).toBeEnabled();
  await expect(draft).toHaveValue("Newer typing stays here");
  await draft.press("Escape");
  await expect(draft).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/memory/${event.id}\\?notebook=1$`));
  await page
    .getByRole("button", { name: "Edit your recollection" })
    .first()
    .click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("mazi:access-lost")),
  );
  await expect(page.locator(".notebook-note")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    "My earlier recollection",
  );
});
