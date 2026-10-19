import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until, deferred } from "./feature-harness.mjs";

const origins = [
  { id: "first", filename: "First photo" },
  { id: "second", filename: "Second photo" },
];
const places = { points: [], countries: [], cities: [], paths: [] };
const capacity = () =>
  Object.assign(new Error("Local map limit is 1,000 shared locations"), {
    status: 400,
    code: "capacity_exceeded",
  });
function base(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/places?")) return places;
  if (path.startsWith("/api/review/my-contributions?")) return origins;
  if (path.startsWith("/api/sources?") || path.startsWith("/api/archive?"))
    return [];
  if (path === "/land.geojson") return { features: [] };
  throw Error(`Unexpected ${path}`);
}
function refresh({ $, window }) {
  $("#filters").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
}
function draft({ $ }) {
  $("#origins").value = "second";
  for (const [name, value] of Object.entries({
    country: "NL",
    city: "My draft",
    latitude: "52",
    longitude: "5",
    day: "2024-06-01",
  }))
    $(`#place-form [name=${name}]`).value = value;
}
function assertDraft({ $ }) {
  assert.equal($("#origins").value, "second");
  for (const [name, value] of Object.entries({
    country: "NL",
    city: "My draft",
    latitude: "52",
    longitude: "5",
    day: "2024-06-01",
  }))
    assert.equal($(`#place-form [name=${name}]`).value, value);
}

test("map capacity keeps repair controls available and removal restores the map", async (t) => {
  let limited = true;
  const writes = [];
  const feature = await mountFeature(
    t,
    "places",
    (path, body) => {
      if (path.startsWith("/api/places?")) return limited ? capacity() : places;
      if (path === "/api/places") {
        writes.push(body);
        limited = false;
        return { ok: true };
      }
      return base(path);
    },
    { realLifecycle: true },
  );
  const { $ } = feature;
  await until(
    () => $("#origins").options.length === 2,
    "repair contributions load despite map capacity",
  );
  await until(
    () => $("#sources").textContent.includes("No connections"),
    "source controls load",
  );
  assert.equal($("#signed-out").hidden, true);
  assert.match($("#place-count").textContent, /unavailable/i);
  assert.match($("#places-error").textContent, /1,000/);
  assert.match($("#places-error").textContent, /before filters/i);
  draft(feature);
  $("#remove-place").click();
  await until(
    () => !limited && $("#places-error").hidden,
    "map recovers after removal",
  );
  assert.deepEqual(writes, [
    { origin: "second", latitude: null, longitude: null },
  ]);
  assertDraft(feature);
  assert.equal($("#signed-out").hidden, true);
});

test("failed source and contribution refresh preserve draft and selection for retry", async (t) => {
  let failed = false;
  const feature = await mountFeature(
    t,
    "places",
    (path) => {
      if (
        failed &&
        (path.startsWith("/api/sources?") ||
          path.startsWith("/api/review/my-contributions?"))
      )
        return new Error("Synthetic network failure");
      return base(path);
    },
    { realLifecycle: true },
  );
  const { $ } = feature;
  await until(
    () => $("#origins").options.length === 2,
    "initial contributions",
  );
  draft(feature);
  failed = true;
  refresh(feature);
  await until(
    () => $("#origins-status")?.textContent.includes("could not load"),
    "contribution failure",
  );
  assert.match($("#sources").textContent, /retry/i);
  assertDraft(feature);
  assert.equal($("#origins").disabled, true);
  assert.equal($("#signed-out").hidden, true);
  failed = false;
  refresh(feature);
  await until(() => !$("#origins").disabled, "contribution retry");
  assertDraft(feature);
});

test("older map source and contribution responses cannot replace a newer refresh", async (t) => {
  const gates = { map: deferred(), sources: deferred(), origins: deferred() };
  const calls = { map: 0, sources: 0, origins: 0 };
  const feature = await mountFeature(
    t,
    "places",
    (path) => {
      const key = path.startsWith("/api/places?")
        ? "map"
        : path.startsWith("/api/sources?")
          ? "sources"
          : path.startsWith("/api/review/my-contributions?")
            ? "origins"
            : null;
      if (key && ++calls[key] === 1) return gates[key].promise;
      return base(path);
    },
    { realLifecycle: true },
  );
  const { $ } = feature;
  await until(
    () => Object.values(calls).every((n) => n === 1),
    "independent panels requested",
  );
  refresh(feature);
  await until(
    () =>
      $("#origins").options.length === 2 &&
      $("#sources").textContent.includes("No connections"),
    "newer panels",
  );
  draft(feature);
  gates.map.resolve(capacity());
  gates.sources.resolve([
    {
      id: "old",
      label: "Obsolete source",
      kind: "apple",
      enabled: false,
      permission: "authorized",
      scope: { start: "2020-01-01", end: "2020-01-02" },
    },
  ]);
  gates.origins.resolve([{ id: "old", filename: "Obsolete contribution" }]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal($("#places-error").hidden, true);
  assert.doesNotMatch($("#sources").textContent, /Obsolete/);
  assert.doesNotMatch($("#origins").textContent, /Obsolete/);
  assert.doesNotMatch($("#notice").textContent, /1,000/);
  assertDraft(feature);
});

test("a removed selected contribution never silently retargets a location draft", async (t) => {
  let removed = false;
  let writes = 0;
  const feature = await mountFeature(
    t,
    "places",
    (path) => {
      if (path.startsWith("/api/review/my-contributions?"))
        return removed ? origins.slice(0, 1) : origins;
      if (path === "/api/places") {
        writes++;
        return { ok: true };
      }
      return base(path);
    },
    { realLifecycle: true },
  );
  const { $, window } = feature;
  await until(
    () => $("#origins").options.length === 2,
    "initial contributions",
  );
  draft(feature);
  removed = true;
  refresh(feature);
  await until(
    () => $("#origins").options.length === 1,
    "authorized contribution refresh",
  );
  assert.equal($("#origins").value, "");
  assert.equal($("#remove-place").disabled, true);
  assert.equal($("#place-form [name=city]").value, "My draft");
  assert.match($("#origins-status").textContent, /Choose another/);
  $("#place-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  assert.equal(writes, 0);
  $("#origins").value = "first";
  $("#origins").dispatchEvent(new window.Event("change"));
  assert.equal($("#remove-place").disabled, false);
});

for (const status of [401, 403]) {
  test(`access loss ${status} clears drafts and ignores late source and contribution data`, async (t) => {
    const source = deferred(),
      origin = deferred();
    let denied = false;
    const feature = await mountFeature(
      t,
      "places",
      (path) => {
        if (path.startsWith("/api/places?") && denied)
          return Object.assign(new Error("Access revoked"), { status });
        if (path.startsWith("/api/sources?")) return source.promise;
        if (path.startsWith("/api/review/my-contributions?"))
          return origin.promise;
        return base(path);
      },
      { realLifecycle: true },
    );
    const { $, root } = feature;
    await until(() => !$("#workspace").hidden, "workspace");
    $("#place-form [name=city]").value = "Private draft";
    denied = true;
    refresh(feature);
    await until(() => root.hidden, "access loss");
    source.resolve([]);
    origin.resolve(origins);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal($("#origins").textContent, "");
    assert.equal($("#sources").textContent, "");
    assert.equal($("#place-form [name=city]").value, "");
  });
}

test("a groups network failure offers retry without false sign-in and restores focus", async (t) => {
  let calls = 0;
  const feature = await mountFeature(t, "places", (path) =>
    path === "/api/groups" && ++calls === 1
      ? new Error("Synthetic groups outage")
      : base(path),
  );
  const { $, window } = feature;
  await until(
    () => $("#retry-workspace") && !$("#retry-workspace").hidden,
    "workspace retry",
  );
  assert.equal($("#signed-out").hidden, true);
  $("#retry-workspace").focus();
  $("#retry-workspace").click();
  await until(
    () => $("#retry-workspace").hidden && !$("#workspace").hidden,
    "workspace recovered",
  );
  assert.equal(calls, 2);
  assert.equal(window.document.activeElement, $("h1"));
});

for (const action of ["share", "remove"]) {
  test(`successful ${action} remains saved when map refresh fails`, async (t) => {
    let written = false;
    const feature = await mountFeature(
      t,
      "places",
      (path) => {
        if (path === "/api/places") {
          written = true;
          return { ok: true };
        }
        if (written && path.startsWith("/api/places?"))
          return action === "share"
            ? capacity()
            : new Error("Synthetic map outage");
        return base(path);
      },
      { realLifecycle: true },
    );
    const { $, window } = feature;
    await until(
      () => $("#origins").options.length === 2,
      "contributions loaded",
    );
    draft(feature);
    if (action === "share")
      $("#place-form").dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    else $("#remove-place").click();
    await until(
      () => written && !$("#places-error").hidden && $("#notice").textContent,
      "saved write and map failure",
    );
    assert.equal($("#notice").dataset.tone, "success");
    assert.equal($("#notice").textContent, "Changes saved.");
    assert.match($("#places-error").textContent, /retry|refresh/i);
    assertDraft(feature);
  });
}
