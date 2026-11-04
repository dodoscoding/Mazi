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
  facets: {
    sources: [{ value: "apple", count: 1 }],
    shared_by: [{ value: "Ana", count: 1 }],
  },
  mode: "keyword",
  unindexed: 0,
};
function capacity(message) {
  return Object.assign(new Error(message), {
    status: 400,
    code: "capacity_exceeded",
  });
}
function boundary(search) {
  return (path) => {
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/discovery/state")) return state;
    if (path.startsWith("/api/atlas")) return { memories: [] };
    if (path.startsWith("/api/discovery/search"))
      return search(new URL(path, "http://localhost").searchParams);
    throw Error(`Unexpected ${path}`);
  };
}
function submit({ $, window }) {
  $("#search-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
}

test("semantic capacity offers an explicit Words & filters retry preserving the search", async (t) => {
  const requests = [];
  const feature = await mountFeature(
    t,
    "discovery",
    boundary((params) => {
      requests.push(Object.fromEntries(params));
      return params.get("mode") === "semantic"
        ? capacity("Local search limit is 1,000 items")
        : searchPage;
    }),
  );
  const { $, root, window } = feature;
  await until(() => $("#results h3"), "initial photograph");
  root.querySelector("#source-filter button[data-source=apple]").click();
  await until(() => requests.length === 2, "source applied at once");
  $("#shared-by").value = "Ana";
  $("#shared-by").dispatchEvent(new window.Event("change", { bubbles: true }));
  await until(() => requests.length === 3, "Shared by applied at once");
  await until(() => $("#results h3"), "filtered photograph");
  const filters = {
    query: "lake bicycle",
    person: "synthetic-person",
    place: "Lake",
    country: "NL",
    object: "bicycle",
    start: "2024-01-01",
    end: "2024-12-31",
  };
  for (const [id, value] of Object.entries(filters)) $("#" + id).value = value;
  $("#mode").value = "semantic";
  submit(feature);
  await until(
    () => !$("#search-recovery").hidden,
    "semantic capacity recovery",
  );
  assert.equal($("#mode").value, "semantic");
  assert.deepEqual(
    requests.map((request) => request.mode),
    ["keyword", "keyword", "keyword", "semantic"],
  );
  assert.match($("#search-recovery").textContent, /10,000 visible photographs/);
  assert.match($("#search-recovery").textContent, /No partial results/);
  const retry = [...root.querySelectorAll("#search-recovery button")].find(
    (button) => button.textContent.trim() === "Use Words & filters",
  );
  assert.ok(
    retry,
    "capacity recovery provides the explicit mode-switch action",
  );
  assert.equal(retry.hidden, false);
  retry.focus();
  assert.equal(root.ownerDocument.activeElement.id, "use-keyword");
  retry.click();
  assert.equal(root.ownerDocument.activeElement.id, "query");
  await until(() => $("#results h3"), "keyword retry photograph");
  assert.equal(root.ownerDocument.activeElement.id, "query");
  assert.equal($("#mode").value, "keyword");
  assert.equal($("#search-recovery").hidden, true);
  assert.equal($("#notice").textContent, "");
  assert.deepEqual(requests.at(-1), {
    group: group.id,
    query: "lake bicycle",
    mode: "keyword",
    person: "synthetic-person",
    place: "Lake",
    country: "NL",
    object_query: "bicycle",
    start: "2024-01-01",
    end: "2024-12-31",
    source: "apple",
    date_basis: "chronology",
    shared_by: "Ana",
    similar: "",
    offset: "0",
  });
  for (const [id, value] of Object.entries(filters))
    assert.equal($("#" + id).value, value);
  assert.equal($("#shared-by").value, "Ana");
  assert.equal(
    $("#source-filter button[aria-pressed=true]").dataset.source,
    "apple",
  );
});

test("keyword metadata-budget exhaustion hides stale totals and keeps filters for retry", async (t) => {
  let unavailable = false;
  const feature = await mountFeature(
    t,
    "discovery",
    boundary(() =>
      unavailable
        ? capacity("Keyword search exceeded its metadata-work budget")
        : {
            ...searchPage,
            items: Array.from({ length: 30 }, (_, index) => ({
              ...photograph,
              id: `synthetic-photo-${index}`,
            })),
            total: 1001,
            next_offset: 30,
          },
    ),
  );
  const { $, root } = feature;
  await until(() => $("#results h3"), "initial photographs");
  $("#query").value = "lake";
  $("#place").value = "Lake";
  submit(feature);
  await until(
    () => $("#result-total").textContent === "1001 results",
    "exact total above 1,000",
  );
  unavailable = true;
  $("#more").click();
  await until(() => !$("#search-recovery").hidden, "keyword budget recovery");
  assert.match($("#search-recovery").textContent, /metadata-work budget/);
  assert.match(
    $("#search-recovery").textContent,
    /Complete results are unavailable/,
  );
  assert.match($("#search-recovery").textContent, /No partial results/);
  assert.doesNotMatch($("#search-recovery").textContent, /1,000/);
  assert.equal($("#use-keyword").hidden, true);
  assert.equal($("#mode").value, "keyword");
  assert.equal($("#query").value, "lake");
  assert.equal($("#place").value, "Lake");
  assert.equal(root.querySelectorAll("#results article").length, 0);
  assert.equal($("#count").textContent, "Search unavailable.");
  assert.equal($("#result-total").textContent, "");
  assert.equal($("#result-types").hidden, true);
  assert.equal($("#search-groups").hidden, true);
  assert.equal($("#search-none").hidden, true);
  assert.equal($("#more").hidden, true);
  assert.equal($("#search-recovery a").getAttribute("href"), "#/memories");
  assert.match(
    $("#search-help").textContent,
    /Words & filters can search more than 1,000/,
  );
  unavailable = false;
  submit(feature);
  await until(
    () => $("#result-total").textContent === "1001 results",
    "keyword retry exact total",
  );
  assert.equal($("#search-recovery").hidden, true);
  assert.equal($("#search-groups").hidden, false);
});

test("Words & filters recovery clears a failed similar-image reference", async (t) => {
  const requests = [];
  const feature = await mountFeature(
    t,
    "discovery",
    boundary((params) => {
      requests.push(Object.fromEntries(params));
      return params.get("similar")
        ? capacity("Local search limit is 1,000 items")
        : { ...searchPage, mode: params.get("mode") };
    }),
  );
  const { $, root } = feature;
  await until(() => $("#results h3"), "initial photograph");
  $("#query").value = "lake";
  $("#mode").value = "semantic";
  submit(feature);
  await until(
    () => $("#count").textContent.endsWith("semantic"),
    "semantic photograph",
  );
  [...root.querySelectorAll("#results button")]
    .find((button) => button.textContent === "Find similar colors")
    .click();
  await until(
    () => !$("#search-recovery").hidden,
    "similar-image capacity recovery",
  );
  assert.equal(requests.at(-1).similar, "synthetic-photo");
  $("#use-keyword").click();
  await until(() => $("#results h3"), "keyword photograph");
  assert.equal($("#mode").value, "keyword");
  assert.equal($("#query").value, "lake");
  assert.equal(requests.at(-1).similar, "");
  assert.equal($("#clear-similar").hidden, true);
});

for (const mode of ["semantic", "keyword"]) {
  test(`${mode} capacity recovery describes the failed request after the selector changes`, async (t) => {
    const pending = deferred();
    let waiting = false;
    const feature = await mountFeature(
      t,
      "discovery",
      boundary(() => (waiting ? pending.promise : searchPage)),
    );
    const { $ } = feature;
    await until(() => $("#results h3"), "initial photograph");
    waiting = true;
    $("#mode").value = mode;
    submit(feature);
    $("#mode").value = mode === "semantic" ? "keyword" : "semantic";
    pending.resolve(capacity("Synthetic capacity failure"));
    await until(() => !$("#search-recovery").hidden, "failed request recovery");
    assert.match(
      $("#search-recovery-message").textContent,
      mode === "semantic"
        ? /10,000 visible photographs/
        : /metadata-work budget/,
    );
    assert.equal($("#use-keyword").hidden, mode !== "semantic");
    assert.equal($("#count").textContent, "Search unavailable.");
  });
}
