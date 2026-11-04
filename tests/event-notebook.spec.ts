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
    (memory: { kind: string; title: string }) =>
      memory.kind === "memory" && memory.title === "Our summer",
  );
  expect(event).toBeDefined();
  await page.emulateMedia({ reducedMotion: "reduce" });
  return { group, event };
}

test("event notebook saves, reloads, edits and removes only your note", async ({
  page,
  browser,
}) => {
  const { group, event } = await enter(page);
  await page.goto(`/#/memory/${event.id}?notebook=1`);
  await expect(page.locator("#notebook-heading")).toBeFocused();
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

test("backgrounding retains notes, newer drafts and pending saves through authorized restore", async ({
  page,
}) => {
  const { event } = await enter(page);
  let reads = 0;
  await page.route("**/api/memories/notebook?*", (route) => {
    reads++;
    return route.fulfill({ json: notebook(event.id) });
  });
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
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    ),
  );
  const draft = page.getByLabel("Your recollection", { exact: true });
  await expect(draft).toHaveValue("Private unsaved draft");
  await expect(page.locator(".event-notebook")).toContainText(
    "Alice's recollection",
  );
  await expect(
    page.getByRole("button", { name: "Save recollection", exact: true }),
  ).toBeDisabled();
  await draft.fill("Newer typing survives backgrounding");
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
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(draft).toHaveValue("Newer typing survives backgrounding");
  await expect(
    page.getByRole("button", { name: "Save recollection", exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Save recollection", exact: true }),
  ).toBeEnabled();
  await expect(draft).toHaveValue("Newer typing survives backgrounding");
  expect(reads).toBe(1);
});

for (const status of [401, 403]) {
  test(`foreground session denial ${status} clears notebook and suppresses a late save`, async ({
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
    let settled = false;
    await page.route("**/api/memories/note", async (route) => {
      saving = true;
      await gate;
      await route.fulfill({ json: notebook(event.id, 2) }).catch(() => {});
      settled = true;
    });
    await page.goto(`/#/memory/${event.id}?notebook=1`);
    await page
      .getByRole("button", { name: "Edit your recollection" })
      .first()
      .click();
    await page
      .getByLabel("Your recollection", { exact: true })
      .fill("Draft cleared after denial");
    await page
      .getByRole("button", { name: "Save recollection", exact: true })
      .click();
    await expect.poll(() => saving).toBe(true);
    await page.route("**/api/session", (route) =>
      route.fulfill({ status, json: { error: "Access denied" } }),
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        value: false,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator(".event-notebook")).toHaveCount(0);
    release();
    await expect.poll(() => settled).toBe(true);
    await expect(page.locator(".notebook-note")).toHaveCount(0);
    await expect(
      page.getByLabel("Your recollection", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      "Alice's recollection",
    );
  });
}

test("event title links open notes alongside imported excerpts and use event IDs", async ({
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
  await expect(title).toHaveCSS("text-decoration-line", "underline");
  await expect(
    page
      .locator(".featured")
      .getByRole("link", { name: "Notları aç", exact: true }),
  ).toBeVisible();
  await title.click();
  await expect(page.locator("#notebook-heading")).toBeFocused();
  await expect(page.locator("#notebook-heading")).toBeInViewport();
  await expect(page.locator(".conversation")).toContainText(
    "Imported excerpts",
  );
  await page.goto("/#/memories");
  const galleryTitle = page
    .locator(".mem-moment-title")
    .filter({ hasText: event.title });
  await expect(galleryTitle).toHaveCSS("text-decoration-line", "underline");
  await expect(
    page
      .locator(".mem-moment-head")
      .filter({ has: galleryTitle })
      .getByRole("link", { name: "View notes", exact: true }),
  ).toBeVisible();
  await galleryTitle.click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#notebook-heading")).toBeFocused();
  await expect(page.locator("#notebook-heading")).toBeInViewport();
  await page.goto("/#/review");
  await expect(
    page
      .locator("#reviewed-events h3")
      .getByRole("link", { name: event.title, exact: true }),
  ).toHaveAttribute("href", `#/memory/${event.id}?notebook=1`);
  await page.goto("/#/memories");
  await page
    .locator("#recap article")
    .filter({
      has: page.getByRole("heading", { name: event.title, exact: true }),
    })
    .getByRole("button", { name: "Start a story", exact: true })
    .click();
  await expect(
    page
      .locator("#stories h3")
      .getByRole("link", { name: event.title, exact: true })
      .last(),
  ).toHaveAttribute("href", `#/memory/${event.id}?notebook=1`);
  await expect(
    page
      .locator("#recap h3")
      .getByRole("link", { name: event.title, exact: true }),
  ).toHaveAttribute("href", `#/memory/${event.id}?notebook=1`);
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
  await page.addInitScript(() => sessionStorage.setItem("mazi.intro", "seen"));
  await page.goto("/?demo=1#/?selected=last-ferry");
  await expect(
    page
      .locator(".featured")
      .getByRole("link", { name: "Notları aç", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Anıyı aç", exact: true }).click();
  await expect(page.locator(".dossier")).toBeVisible();
  await expect(
    page
      .locator(".dossier")
      .getByRole("link", { name: "Notları aç", exact: true }),
  ).toHaveCount(0);
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

for (const otherOwnNote of [false, true]) {
  for (const removal of ["conflict refresh", "successful removal"] as const) {
    test(`removed saved recollection retains its draft after ${removal} ${otherOwnNote ? "with another own note" : "without another own note"}`, async ({
      page,
    }) => {
      const { event } = await enter(page);
      const initial = notebook(event.id);
      if (!otherOwnNote) initial.sections[1].notes = [];
      const refreshed = structuredClone(initial);
      refreshed.sections[0].notes = refreshed.sections[0].notes.filter(
        (note) => note.ownership.kind !== "mine",
      );
      let removed = false;
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const writes: { target: { kind: string }; text: string }[] = [];
      await page.route("**/api/memories/notebook?*", (route) =>
        route.fulfill({ json: removed ? refreshed : initial }),
      );
      await page.route("**/api/memories/note", async (route) => {
        const body = route.request().postDataJSON();
        writes.push(body);
        if (writes.length > 1) {
          expect(body.target).toEqual({ kind: "new" });
          const saved = notebook(event.id, 3);
          saved.sections[0].notes[0].text = body.text;
          return route.fulfill({ json: saved });
        }
        removed = true;
        if (removal === "conflict refresh")
          return route.fulfill({
            status: 409,
            json: { error: "Note removed" },
          });
        await gate;
        return route.fulfill({ json: refreshed });
      });
      await page.goto(`/#/memory/${event.id}?notebook=1`);
      await page
        .getByRole("button", { name: "Edit your recollection" })
        .first()
        .click();
      const draft = page.getByLabel("Your recollection", { exact: true });
      const save = page.getByRole("button", {
        name: "Save recollection",
        exact: true,
      });
      if (removal === "conflict refresh") {
        await draft.fill("Keep this recovered draft");
        await save.click();
        await page.getByRole("button", { name: "Refresh saved notes" }).click();
      } else {
        await page
          .getByRole("button", { name: "Remove my recollection" })
          .click();
        await expect.poll(() => writes.length).toBe(1);
        await draft.fill("Keep this recovered draft");
        release();
      }
      await expect(page.locator(".notebook-status")).toContainText(
        "The saved recollection was removed",
      );
      await expect(draft).toHaveValue("Keep this recovered draft");
      await expect(page.locator(".event-notebook")).toContainText(
        "Alice's recollection",
      );
      if (otherOwnNote) {
        await expect(page.locator(".event-notebook")).toContainText(
          "My later recollection",
        );
        await expect(save).toBeDisabled();
        await expect(
          page.locator(".event-notebook").getByRole("alert"),
        ).toContainText("Copy your draft");
        expect(writes).toHaveLength(1);
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page
          .getByRole("button", { name: "Edit your recollection", exact: true })
          .click();
        await expect(draft).toHaveValue("My later recollection");
      } else {
        await expect(save).toBeEnabled();
        await save.click();
        await expect(draft).toHaveCount(0);
        expect(writes[1]).toMatchObject({
          target: { kind: "new" },
          text: "Keep this recovered draft",
        });
      }
    });
  }
}

test("event notes are discoverable before the photograph viewer", async ({
  page,
}) => {
  const { event } = await enter(page);
  await page.goto(`/#/memory/${event.id}`);
  const jump = page.getByRole("link", { name: "View notes", exact: true });
  await expect(jump).toBeInViewport();
  await jump.click();
  const notes = page.getByRole("heading", {
    name: "Notes from your circle",
    exact: true,
  });
  await page.evaluate(() => document.fonts.ready);
  await expect(notes).toBeFocused();
  await expect(notes).toBeInViewport();
  await jump.scrollIntoViewIfNeeded();
  await jump.click();
  await expect(notes).toBeFocused();
  await expect(notes).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/memory/${event.id}$`));
});

test("Home exposes event notes without opening the Atlas or photograph viewer", async ({
  page,
}) => {
  const { event } = await enter(page);
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({ json: { memories: [event] } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Birlikte hatırlayalım", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".atlas-stage, .photo-viewer")).toHaveCount(0);
  const notes = page
    .locator(".home-featured")
    .getByRole("link", { name: "Notları aç", exact: true });
  await expect(notes).toHaveAttribute(
    "href",
    `#/memory/${event.id}?notebook=1`,
  );
  await notes.click();
  await expect(page.locator("#notebook-heading")).toBeFocused();
  await expect(page.locator("#notebook-heading")).toBeInViewport();
  await expect(page.locator(".photo-viewer")).toHaveCount(0);
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.locator(".home-featured")).toContainText(event.title);
  await expect(page.locator(".atlas-stage")).toHaveCount(0);
});
