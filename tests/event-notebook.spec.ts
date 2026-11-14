import { mockArchive } from "./helpers/archive";
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

test("legacy notebook notes remain readable without story writing controls", async ({
  page,
}) => {
  const { event } = await enter(page);
  await page.route("**/api/memories/notebook?*", (route) =>
    route.fulfill({ json: notebook(event.id) }),
  );
  await page.goto(`/#/memory/${event.id}?notebook=1`);
  await expect(page.locator(".event-notebook")).toContainText(
    "My earlier recollection",
  );
  await expect(page.locator(".event-notebook")).toContainText(
    "My later recollection",
  );
  await expect(page.locator(".event-notebook textarea")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /Add your recollection|Edit your recollection|Save recollection/,
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".event-notebook")).toContainText(
    "My earlier recollection",
  );
});

test("notebook read failures retry and denial clears retained notes", async ({
  page,
}) => {
  const { event } = await enter(page);
  await page.route("**/api/memories/notebook?*", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto(`/#/memory/${event.id}?notebook=1`);
  await expect(
    page.locator(".event-notebook").getByRole("alert"),
  ).toBeVisible();
  await page.unroute("**/api/memories/notebook?*");
  await page.route("**/api/memories/notebook?*", (route) =>
    route.fulfill({ json: notebook(event.id) }),
  );
  await page
    .locator(".event-notebook")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(page.locator(".event-notebook")).toContainText(
    "My earlier recollection",
  );
  await page.unroute("**/api/memories/notebook?*");
  await page.route("**/api/memories/notebook?*", (route) =>
    route.fulfill({ status: 403, json: { error: "Access withdrawn" } }),
  );
  await page.reload();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator(".event-notebook")).toHaveCount(0);
});

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
  await mockArchive(
    page,
    memories.map((memory: { id: string }) =>
      memory.id === event.id ? event : memory,
    ),
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
    "aktarılmış alıntılar",
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
      .getByRole("link", { name: "Notları aç", exact: true }),
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
  await mockArchive(page, [{ ...event, kind: "photo" }]);
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
  await expect(page.locator(".memory-detail")).toBeVisible();
  await expect(
    page
      .locator(".memory-detail")
      .getByRole("link", { name: "Notları aç", exact: true }),
  ).toHaveCount(0);
  expect(requests).toBe(0);
});

test("event notes are discoverable before the photograph viewer", async ({
  page,
}) => {
  const { event } = await enter(page);
  await page.goto(`/#/memory/${event.id}`);
  const jump = page.getByRole("link", { name: "Notları aç", exact: true });
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
  await mockArchive(page, [event]);
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
  await page.getByRole("link", { name: "Geri", exact: true }).click();
  await expect(page.locator(".home-featured")).toContainText(event.title);
  await expect(page.locator(".atlas-stage")).toHaveCount(0);
});
