import assert from "node:assert/strict";
import test from "node:test";
import { deferred, group, mountFeature, until } from "./feature-harness.mjs";

const state = {
  people: [
    {
      id: "synthetic-person",
      name: "Sam",
      count: 1,
      places: [],
      memories: [],
    },
  ],
  memories: [],
  hidden_memories: [],
  hidden: [],
  suppressed: [],
  identities: [],
  settings: {
    model_label: "Related concepts & colors",
    model_message: "Synthetic local model",
    learned: false,
    model_ready: true,
    group_enabled: true,
    contribution_enabled: true,
  },
};
const photograph = {
  id: "synthetic-photo",
  title: "Lake photograph",
  date: "2024-06-01",
  place: "Lake",
  people: [],
};
const searchPage = {
  items: [photograph],
  total: 1,
  next_offset: null,
  mode: "keyword",
  unindexed: 0,
};

function submit({ $, window }) {
  $("#search-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
}

test("Search pages photographs before requesting optional context and preserves its query on completion", async (t) => {
  const context = deferred();
  const requests = [];
  const feature = await mountFeature(
    t,
    "discovery",
    (path, body) => {
      if (path === "/api/discovery/tag") {
        requests.push({ path, body });
        return {};
      }
      requests.push(path);
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/discovery/search")) return searchPage;
      if (path.startsWith("/api/discovery/state")) return context.promise;
      if (path.startsWith("/api/atlas")) return { memories: [] };
      throw Error(`Unexpected ${path}`);
    },
    { route: "/search" },
  );
  const { $ } = feature;
  await until(() => $("#results h3"), "first photo before context");
  assert.equal(
    requests.some(
      (path) =>
        path.startsWith("/api/discovery/state") ||
        path.startsWith("/api/atlas"),
    ),
    false,
  );
  $("#query").value = "Sam";
  submit(feature);
  await until(
    () => $("#result-total").textContent.includes("photograph"),
    "honest photo count",
  );
  await until(() => $("#results h3"), "searched photograph");
  $("#include-context").click();
  await until(
    () => requests.some((path) => path.startsWith("/api/discovery/state")),
    "context requested on intent",
  );
  assert.equal($("#private").hidden, false);
  assert.equal($("#results h3").textContent, photograph.title);
  assert.equal($("#person").disabled, true);
  $("#place").value = "Lake";
  submit(feature);
  await until(
    () =>
      requests.filter((path) => path.startsWith("/api/discovery/search"))
        .length === 3,
    "keyword filters while context stalls",
  );
  await until(() => $("#results h3"), "filtered photos while context stalls");
  context.resolve(state);
  await until(() => !$("#person").disabled, "People ready");
  assert.equal($("#query").value, "Sam");
  assert.equal($("#place").value, "Lake");
  assert.match($("#people-list").textContent, /Sam/);
  assert.equal(
    $(".disc-tag select option[value=synthetic-person]").textContent,
    "Sam",
  );
  assert.equal($("#results h3").textContent, photograph.title);
  const confirm = [...feature.root.querySelectorAll("#results button")].find(
    (button) => button.textContent === "Confirm tag",
  );
  assert.equal(confirm.disabled, false);
  $(".disc-tag select").value = "synthetic-person";
  confirm.click();
  await until(
    () => requests.some((request) => request.path === "/api/discovery/tag"),
    "tag submitted after context loads",
  );
  assert.deepEqual(
    requests.find((request) => request.path === "/api/discovery/tag").body,
    { person: "synthetic-person", asset: "synthetic-photo", confirmed: true },
  );
  await until(
    () => $("#notice").textContent === "Changes saved.",
    "tag refresh completed",
  );
});

test("Search optional context failure offers retry without hiding photographs", async (t) => {
  let fail = true;
  const feature = await mountFeature(
    t,
    "discovery",
    (path) => {
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/discovery/search")) return searchPage;
      if (path.startsWith("/api/discovery/state"))
        return fail ? new Error("Synthetic context unavailable") : state;
      if (path.startsWith("/api/atlas")) return { memories: [] };
      throw Error(`Unexpected ${path}`);
    },
    { route: "/search" },
  );
  const { $ } = feature;
  await until(() => $("#results h3"), "photo");
  $("#query").value = "absent";
  submit(feature);
  $("#include-context").click();
  await until(
    () => $("#context-status").textContent.includes("unavailable"),
    "retryable failure",
  );
  assert.equal($("#include-context").disabled, false);
  assert.equal($("#results h3").textContent, photograph.title);
  assert.equal($("#search-none").hidden, true);
  fail = false;
  $("#include-context").click();
  await until(() => !$("#person").disabled, "retry success");
  assert.equal($("#query").value, "absent");
});

test("Search ignores late context after a group change and clears private data on access denial", async (t) => {
  const oldContext = deferred();
  let denied = false;
  let second = false;
  const feature = await mountFeature(
    t,
    "discovery",
    (path) => {
      if (path === "/api/groups")
        return [group, { ...group, id: "second", name: "Second circle" }];
      if (path.startsWith("/api/discovery/search"))
        return denied
          ? Object.assign(Error("Access denied"), { status: 403 })
          : searchPage;
      if (path.startsWith("/api/discovery/state")) return oldContext.promise;
      if (path.startsWith("/api/atlas")) return { memories: [] };
      throw Error(`Unexpected ${path}`);
    },
    { route: "/search" },
  );
  const { $, lifecycle } = feature;
  await until(() => $("#results h3"), "initial photo");
  $("#include-context").click();
  lifecycle.selectGroup = (select) => {
    select.value = "second";
    second = true;
    return "second";
  };
  $("#groups").onchange();
  await until(() => second && $("#results h3"), "new circle photo");
  oldContext.resolve(state);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal($("#person").disabled, true);
  assert.equal($("#people").textContent, "");
  denied = true;
  submit(feature);
  await until(() => $("#private").hidden, "denied private content");
  assert.equal($("#results").textContent, "");
  assert.equal($("#people").textContent, "");
});

test("Search retains paginated photo navigation while optional context is stalled", async (t) => {
  const context = deferred();
  const offsets = [];
  const feature = await mountFeature(
    t,
    "discovery",
    (path) => {
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/discovery/search")) {
        const offset = new URL(path, "http://localhost").searchParams.get(
          "offset",
        );
        offsets.push(offset);
        return {
          ...searchPage,
          total: 2,
          next_offset: offset === "0" ? 1 : null,
          items: [
            {
              ...photograph,
              title: offset === "0" ? "First photo" : "Second photo",
            },
          ],
        };
      }
      if (path.startsWith("/api/discovery/state")) return context.promise;
      if (path.startsWith("/api/atlas")) return { memories: [] };
      throw Error(`Unexpected ${path}`);
    },
    { route: "/search" },
  );
  const { $ } = feature;
  await until(() => $("#results h3"), "first page");
  $("#include-context").click();
  $("#more").click();
  await until(
    () => $("#results h3")?.textContent === "Second photo",
    "next page without context",
  );
  assert.deepEqual(offsets, ["0", "1"]);
  context.resolve(state);
  await until(() => !$("#person").disabled, "context ready");
  assert.equal($("#results h3").textContent, "Second photo");
  assert.equal($("#more").hidden, true);
});

for (const outcome of ["pending", "failed"]) {
  test(`late context cannot restore old categories while a newer search is ${outcome}`, async (t) => {
    const context = deferred();
    const newer = deferred();
    let calls = 0;
    const feature = await mountFeature(
      t,
      "discovery",
      (path) => {
        if (path === "/api/groups") return [group];
        if (path.startsWith("/api/discovery/search"))
          return ++calls > 1 ? newer.promise : searchPage;
        if (path.startsWith("/api/discovery/state")) return context.promise;
        if (path.startsWith("/api/atlas")) return { memories: [] };
        throw Error(`Unexpected ${path}`);
      },
      { route: "/search" },
    );
    const { $ } = feature;
    await until(() => $("#results h3"), "first photograph");
    $("#include-context").click();
    $("#query").value = "unrelated newer query";
    submit(feature);
    if (outcome === "failed") {
      newer.resolve(
        Object.assign(Error("Synthetic capacity"), {
          status: 400,
          code: "capacity_exceeded",
        }),
      );
      await until(() => !$("#search-recovery").hidden, "newer failure");
    }
    context.resolve(state);
    await until(() => !$("#person").disabled, "context finished");
    assert.equal($("#search-groups").hidden, true);
    assert.equal($("#result-total").textContent, "");
    assert.equal($("#result-types").hidden, true);
    if (outcome === "pending") {
      assert.equal($("#search-loading").hidden, false);
      newer.resolve(searchPage);
      await until(() => $("#results h3"), "newer successful photos");
      assert.equal($("#search-groups").hidden, false);
      assert.equal($("#people-results").hidden, true);
    }
  });
}

test("a canceled circle's denied context cannot sign out the current circle through the real lifecycle", async (t) => {
  const context = deferred();
  const feature = await mountFeature(
    t,
    "discovery",
    (path) => {
      if (path === "/api/groups")
        return [group, { ...group, id: "second", name: "Second circle" }];
      if (path.startsWith("/api/discovery/search")) return searchPage;
      if (path.startsWith("/api/discovery/state")) return context.promise;
      if (path.startsWith("/api/atlas")) return { memories: [] };
      throw Error(`Unexpected ${path}`);
    },
    { route: "/search", realLifecycle: true },
  );
  const { $, root, window } = feature;
  let accessLost = 0;
  window.addEventListener("mazi:access-lost", () => {
    accessLost++;
  });
  await until(() => $("#results h3"), "first circle");
  $("#include-context").click();
  $("#groups").value = "second";
  $("#groups").onchange();
  await until(
    () => $("#results h3") && $("#groups").value === "second",
    "second circle",
  );
  $("#query").value = "keep current search";
  context.resolve(
    Object.assign(Error("Old circle access denied"), { status: 403 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(root.hidden, false);
  assert.equal(accessLost, 0);
  assert.equal($("#query").value, "keep current search");
  assert.equal($("#results h3").textContent, photograph.title);
});
