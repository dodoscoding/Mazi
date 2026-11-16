import type { Page } from "@playwright/test";

export async function mockArchive<T extends { id: string }>(
  page: Page,
  memories: T[],
) {
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({ json: { memories } }),
  );
  await page.route("**/api/atlas/memory?*", (route) => {
    const id = new URL(route.request().url()).searchParams.get("memory");
    const memory = memories.find((item) => item.id === id);
    return route.fulfill({
      status: memory ? 200 : 404,
      json: memory ? { memory } : { error: "Unavailable" },
    });
  });
  await page.route("**/api/social/home?*", (route) =>
    route.fulfill({
      json: {
        featured: memories[0] ? { kind: "memory", memory: memories[0] } : null,
        activity: { items: [], next_cursor: null },
        server_time: new Date().toISOString(),
        can_plan: true,
      },
    }),
  );
}
