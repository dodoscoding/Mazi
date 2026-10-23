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
  await expect(
    page.getByRole("heading", { name: "The circle remembers" }),
  ).toBeFocused();
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
