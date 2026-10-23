import { test, expect } from "@playwright/test";

const scenarios = [
  "stable",
  "feature-bootstrap",
  "session-bootstrap",
  "feature-exchange",
  "session-exchange",
  "feature-channels",
  "session-channels",
];

for (const scenario of scenarios) {
  test(`Discord return completes once through ${scenario}`, async ({
    page,
  }) => {
    let linkRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/sources/discord/link")
        linkRequests++;
    });
    await page.request.post("/api/entry", {
      data: { name: "Alice", code: "synthetic-shared-code" },
    });
    await page.goto("/places");
    await expect(page.locator("#workspace")).toBeVisible();
    const [group] = await (await page.request.get("/api/groups")).json();
    const { url } = await (
      await page.request.post("/api/sources/discord/connect", {
        data: { group: group.id },
      })
    ).json();
    const state = new URL(url).searchParams.get("state")!;
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    if (scenario !== "stable") {
      const boundary = scenario.endsWith("exchange")
        ? /\/api\/sources\/discord\/link$/
        : scenario.endsWith("channels")
          ? /\/api\/sources\/discord\/channels\?/
          : /\/api\/groups$/;
      await page.route(boundary, async (route) => {
        entered();
        await gate;
        await route.continue().catch(() => {});
      });
    }
    try {
      await page.goto(
        `/places?code=synthetic-code&state=${encodeURIComponent(state)}`,
      );
      await expect.poll(() => new URL(page.url()).search).toBe("");
      if (scenario !== "stable") {
        await reached;
        await page.evaluate(
          (event) => window.dispatchEvent(new Event(event)),
          scenario.startsWith("session") ? "mazi:session" : "mazi:group",
        );
      }
    } finally {
      release();
    }
    await expect(page.locator("#kind")).toHaveValue("discord");
    await expect(
      page.getByRole("combobox", { name: "Server", exact: true }),
    ).toHaveValue("77");
    await expect(
      page.getByRole("group", { name: "Channels" }).getByLabel("#photos"),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Channels" }).getByLabel("#general"),
    ).toBeVisible();
    expect(linkRequests).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("mazi:group")));
    await expect(page.locator("#workspace")).toBeVisible();
    expect(linkRequests).toBe(1);
  });
}
