import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until, deferred } from "./feature-harness.mjs";
const places = {
  points: [
    {
      origin: "origin",
      asset_id: "photo",
      latitude: 52,
      longitude: 5,
      city: "Utrecht",
      country: "NL",
      day: null,
    },
  ],
  countries: ["NL"],
  cities: ["Utrecht"],
  paths: [],
};
function base(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/places?")) return places;
  if (
    path.startsWith("/api/sources?") ||
    path.startsWith("/api/archive?") ||
    path.startsWith("/api/review/my-contributions?")
  )
    return [];
  throw Error(`Unexpected ${path}`);
}
test("a stalled optional coastline does not block places or source controls", async (t) => {
  const gate = deferred();
  const { $, root } = await mountFeature(t, "places", (path) =>
    path === "/land.geojson" ? gate.promise : base(path),
  );
  await until(
    () =>
      $("#places").textContent.includes("Utrecht") &&
      $("#sources").textContent.includes("No connections yet"),
    "places and sources render without coastline",
  );
  assert.equal($("#workspace").hidden, false);
  assert.equal($("#signed-out").hidden, true);
  assert.equal(root.querySelectorAll("#map .node").length, 1);
  gate.resolve(new Error("Synthetic coastline unavailable"));
  await until(
    () => $("#map-warning") && !$("#map-warning").hidden,
    "optional failure is explained",
  );
  assert.equal($("#signed-out").hidden, true);
});

test("coastline retry clears a malformed-data warning without losing places", async (t) => {
  let calls = 0;
  const { $, window } = await mountFeature(t, "places", (path) => {
    if (path === "/land.geojson")
      return ++calls === 1
        ? { features: [{ geometry: null }] }
        : {
            features: [
              {
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [0, 0],
                      [2, 0],
                      [1, 2],
                      [0, 0],
                    ],
                  ],
                },
              },
            ],
          };
    return base(path);
  });
  await until(
    () => $("#map-warning") && !$("#map-warning").hidden,
    "malformed outline warning",
  );
  assert.match($("#places").textContent, /Utrecht/);
  assert.equal($("#signed-out").hidden, true);
  $("#filters").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(
    () => calls === 2 && $("#map-warning").hidden,
    "outline retry succeeds",
  );
  assert.match($("#places").textContent, /Utrecht/);
  assert.match($("#map .land").getAttribute("d"), /^M/);
  assert.equal($("#map").children[1].contains($("#map .land")), true);
  assert.equal($("#map").children[2].contains($("#map .node")), true);
});

test("obsolete coastline failure cannot replace a successful newer map", async (t) => {
  const gate = deferred();
  let calls = 0;
  const { $, window } = await mountFeature(t, "places", (path) => {
    if (path === "/land.geojson")
      return ++calls === 1 ? gate.promise : { features: [] };
    return base(path);
  });
  await until(
    () => calls === 1 && $("#places").textContent.includes("Utrecht"),
    "first map available",
  );
  $("#filters").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => calls === 2 && $("#map-warning").hidden, "new map loaded");
  gate.resolve(new Error("Obsolete outline failure"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal($("#map-warning").hidden, true);
  assert.equal($("#signed-out").hidden, true);
});

test("real lifecycle access denial still hides private places and ignores late outlines", async (t) => {
  const gate = deferred();
  let denied = false;
  const { $, root, window } = await mountFeature(
    t,
    "places",
    (path) => {
      if (path === "/land.geojson") return gate.promise;
      if (path.startsWith("/api/places?") && denied)
        return Object.assign(new Error("Access removed"), { status: 403 });
      return base(path);
    },
    { realLifecycle: true },
  );
  await until(
    () => $("#places").textContent.includes("Utrecht"),
    "private places loaded",
  );
  denied = true;
  $("#filters").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => root.hidden, "access denial hides view");
  gate.resolve({ features: [] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(root.hidden, true);
  assert.equal($("#places").children.length, 0);
  assert.equal($("#map").children.length, 0);
});

for (const total of [31, 1020, 1021]) {
  test(`source summary states the scope of ${total} shared items`, async (t) => {
    const offsets = [];
    const { $ } = await mountFeature(t, "places", (path) => {
      if (path === "/land.geojson") return { features: [] };
      if (path.startsWith("/api/archive?")) {
        const offset = Number(
          new URL(path, "http://test").searchParams.get("offset"),
        );
        offsets.push(offset);
        return Array.from(
          { length: Math.max(0, Math.min(30, total - offset)) },
          (_, i) => ({
            id: `photo-${offset + i}`,
            origins: [{ source_type: "manual" }],
            next_origin_offset: null,
          }),
        );
      }
      return base(path);
    });
    await until(() => $("#origin-counts").children.length, "source summary");
    if (total >= 1020) assert.equal(offsets.at(-1), 1020);
    if (total > 1020) {
      assert.match($("#origin-sub").textContent, /first 1,020/);
      assert.doesNotMatch($("#origin-sub").textContent, /all/);
    } else
      assert.match(
        $("#origin-sub").textContent,
        new RegExp(`all ${total.toLocaleString("en-US")}`),
      );
  });
}

test("source summary discloses paginated provenance", async (t) => {
  const { $ } = await mountFeature(t, "places", (path) => {
    if (path === "/land.geojson") return { features: [] };
    if (path.startsWith("/api/archive?"))
      return [
        {
          id: "photo",
          origins: Array.from({ length: 100 }, () => ({
            source_type: "manual",
          })),
          origin_count: 101,
          next_origin_offset: 100,
        },
      ];
    return base(path);
  });
  await until(() => $("#origin-counts").children.length, "source summary");
  assert.match($("#origin-sub").textContent, /first 100 source records/);
  assert.doesNotMatch($("#origin-sub").textContent, /all/);
});

test("failed lookahead never claims a complete source summary", async (t) => {
  let fail = true;
  const { $, window } = await mountFeature(t, "places", (path) => {
    if (path === "/land.geojson") return { features: [] };
    if (path.startsWith("/api/archive?")) {
      const offset = Number(
        new URL(path, "http://test").searchParams.get("offset"),
      );
      if (offset === 1020)
        return fail ? new Error("Lookahead unavailable") : [];
      return Array.from({ length: 30 }, () => ({
        origins: [{ source_type: "manual" }],
        next_origin_offset: null,
      }));
    }
    return base(path);
  });
  await until(
    () => $("#origin-sub").textContent.includes("could not load"),
    "summary failure visible",
  );
  assert.doesNotMatch($("#origin-sub").textContent, /all/);
  fail = false;
  $("#filters").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(
    () => $("#origin-sub").textContent.includes("all 1,020"),
    "failed overview retries successfully",
  );
});

test("older source overview cannot overwrite a newer refresh", async (t) => {
  const gate = deferred();
  let calls = 0;
  const { $, window } = await mountFeature(t, "places", (path) => {
    if (path === "/land.geojson") return { features: [] };
    if (path.startsWith("/api/archive?"))
      return ++calls === 1
        ? gate.promise
        : [{ origins: [{ source_type: "manual" }], next_origin_offset: null }];
    return base(path);
  });
  await until(() => calls === 1, "first summary pending");
  $("#filters").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(
    () => $("#origin-sub").textContent.includes("all 1"),
    "new summary available",
  );
  gate.resolve([
    { origins: [{ source_type: "apple" }], next_origin_offset: null },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.doesNotMatch($("#origin-counts").textContent, /Apple/);
});

test("disposed places view ignores a late source overview", async (t) => {
  const gate = deferred();
  let requested = false;
  const { $, root, lifecycle } = await mountFeature(
    t,
    "places",
    (path) => {
      if (path === "/land.geojson") return { features: [] };
      if (path.startsWith("/api/archive?")) {
        requested = true;
        return gate.promise;
      }
      return base(path);
    },
    { realLifecycle: true },
  );
  await until(() => requested, "summary pending");
  lifecycle.dispose();
  root.remove();
  gate.resolve([
    { origins: [{ source_type: "apple" }], next_origin_offset: null },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal($("#origin-counts").children.length, 0);
});
