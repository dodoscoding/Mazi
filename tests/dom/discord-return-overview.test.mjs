import assert from "node:assert/strict";
import test from "node:test";
import { mountFeature, group, deferred, until } from "./feature-harness.mjs";
test("Discord return loads channels while an unrelated archive page is pending", async (t) => {
  const stalled = deferred();
  t.after(() => stalled.resolve([]));
  let links = 0;
  const offsets = [];
  const f = await mountFeature(
    t,
    "places",
    (path) => {
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/archive?")) {
        const offset = Number(
          new URL(path, "http://localhost").searchParams.get("offset"),
        );
        offsets.push(offset);
        return offset >= 120
          ? stalled.promise
          : Array.from({ length: 30 }, (_, i) => ({
              id: `memory-${offset + i}`,
              origins: [],
            }));
      }
      if (path === "/api/sources/discord/link") {
        links++;
        return { guild: { id: "77", name: "Lake house" } };
      }
      if (path.startsWith("/api/sources/discord/guilds?"))
        return links ? [{ id: "77", name: "Lake house" }] : [];
      if (path.startsWith("/api/sources/discord/channels?"))
        return [{ id: "71", name: "photos" }];
      if (path.startsWith("/api/places?"))
        return { points: [], countries: [], cities: [], paths: [] };
      if (path === "/land.geojson") return { features: [] };
      return [];
    },
    {
      url: "http://localhost/places?code=synthetic-code&state=synthetic-state",
      realLifecycle: true,
    },
  );
  await until(() => offsets.includes(120), "archive page120 reached");
  await until(
    () => f.$("#channel-list").textContent.includes("#photos"),
    "Discord channels must not wait for unrelated archive overview",
  );
  assert.equal(links, 1);
  assert.equal(f.$("#kind").value, "discord");
  assert.equal(f.window.location.search, "");
  stalled.resolve([]);
});
