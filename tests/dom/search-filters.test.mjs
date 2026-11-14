import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until } from "./feature-harness.mjs";

const state = {
  people: [],
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
    group_enabled: false,
    contribution_enabled: false,
  },
};
const photos = [
  { id: "ana-photo", sources: ["whatsapp"], shared_by: ["Ana"] },
  { id: "deniz-photo", sources: ["whatsapp"], shared_by: ["Deniz"] },
  { id: "ben-photo", sources: ["discord"], shared_by: ["Ben"] },
].map((photo) => ({
  ...photo,
  title: `Lake by ${photo.shared_by[0]}`,
  date: "2024-02-01",
  place: "",
  people: [],
}));
const facets = {
  sources: [
    { value: "whatsapp", count: 2 },
    { value: "discord", count: 1 },
  ],
  shared_by: [
    { value: "Ana", count: 1 },
    { value: "Ben", count: 1 },
    { value: "Deniz", count: 1 },
  ],
};
function memory(id, title, source, { senders = [], shared = [] }) {
  return {
    id,
    kind: "memory",
    title,
    shortTitle: title,
    description: "An approved shared memory.",
    date: "2024-02-01",
    year: 2024,
    approximate: false,
    by: "Your circle",
    source,
    place: null,
    messages: [{ name: senders[0] || "Ben", time: "12:00", text: "the lake" }],
    people: { shared, conversation: senders },
    photos: [
      {
        src: `/api/review/rendition/${id}`,
        alt: title,
        caption: title,
        provenance: senders.map((sender) => ({
          sender,
          source,
          sharedAt: { local: null, raw: null, precision: "unknown" },
        })),
      },
    ],
  };
}
const atlas = {
  memories: [
    memory("picnic", "Lake picnic", "whatsapp", {
      senders: ["Ana"],
      shared: ["Altan"],
    }),
    memory("bot", "Lake from the server", "discord", { shared: ["Ben"] }),
  ],
};

function archive(requests) {
  return (path) => {
    requests.push(path);
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/discovery/state")) return state;
    if (path.startsWith("/api/atlas")) return atlas;
    if (path.startsWith("/api/discovery/search")) {
      const params = new URL(path, "http://localhost").searchParams;
      const items = photos.filter(
        (photo) =>
          (!params.get("source") ||
            photo.sources.includes(params.get("source"))) &&
          (!params.get("shared_by") ||
            photo.shared_by.includes(params.get("shared_by"))),
      );
      return {
        items,
        total: items.length,
        next_offset: null,
        facets,
        mode: "keyword / filters",
        unindexed: 0,
      };
    }
    throw Error(`Unexpected ${path}`);
  };
}
const searches = (requests) =>
  requests
    .filter((path) => path.startsWith("/api/discovery/search"))
    .map((path) => new URL(path, "http://localhost").searchParams);
const texts = (root, selector) =>
  [...root.querySelectorAll(selector)].map((el) => el.textContent.trim());

test("Source and sharer constrain photos and explicitly exclude unrelated context", async (t) => {
  const requests = [];
  const feature = await mountFeature(t, "discovery", archive(requests), {
    route: "/search",
  });
  const { $, root, window } = feature;
  await until(() => !$("#search-filters").hidden, "filters offered");
  assert.equal($(".disc-refine").open, false);
  assert.deepEqual(texts(root, "#source-filter button"), [
    "Tümü",
    "WhatsApp",
    "Discord",
  ]);
  assert.deepEqual(texts(root, "#shared-by option"), [
    "Herkes",
    "Ana",
    "Ben",
    "Deniz",
  ]);
  assert.deepEqual(texts(root, "#results .disc-shared"), [
    "Paylaşan: Ana · WhatsApp",
    "Paylaşan: Deniz · WhatsApp",
    "Paylaşan: Ben · Discord",
  ]);
  $("#include-context").click();
  await until(() => !$("#person").disabled, "context loaded");
  $("#query").value = "lake";
  $("#search-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(
    () => root.querySelectorAll("#memory-list a").length === 2,
    "both memories match",
  );

  [...root.querySelectorAll("#source-filter button")]
    .find((button) => button.textContent === "Discord")
    .click();
  await until(
    () => root.querySelectorAll("#results article").length === 1,
    "Discord photographs only",
  );
  assert.equal(searches(requests).at(-1).get("source"), "discord");
  assert.deepEqual(texts(root, "#results h3"), ["Lake by Ben"]);
  assert.deepEqual(texts(root, "#memory-list .result-title"), []);
  assert.deepEqual(texts(root, "#chat-list b"), []);
  assert.equal($("#date-scope").hidden, false);
  assert.deepEqual(texts(root, "#source-filter button[aria-pressed=true]"), [
    "Discord",
  ]);
  assert.equal(window.location.hash, "#/search?q=lake&source=discord");

  root.querySelector("#source-filter button[data-source='']").click();
  $("#shared-by").value = "Ana";
  $("#shared-by").dispatchEvent(new window.Event("change", { bubbles: true }));
  await until(
    () => searches(requests).at(-1).get("shared_by") === "Ana",
    "Shared by requested",
  );
  await until(
    () => texts(root, "#results h3").join() === "Lake by Ana",
    "Ana's photograph only",
  );
  assert.equal(searches(requests).at(-1).get("source"), "");
  assert.deepEqual(texts(root, "#memory-list .result-title"), []);
  assert.equal(window.location.hash, "#/search?q=lake&by=Ana");
});

test("Search restores its query and filters from the URL it left behind", async (t) => {
  const requests = [];
  const feature = await mountFeature(t, "discovery", archive(requests), {
    url: "http://localhost/#/search?q=lake&place=Kyrenia&source=discord&by=Ben",
  });
  const { $, root } = feature;
  await until(() => !$("#search-filters").hidden, "filters offered");
  const [first] = searches(requests);
  assert.deepEqual(
    ["query", "place", "source", "shared_by"].map((key) => first.get(key)),
    ["lake", "Kyrenia", "discord", "Ben"],
  );
  assert.equal($("#query").value, "lake");
  assert.equal($("#clear-query").hidden, false);
  assert.equal($(".disc-refine").open, true);
  assert.equal($("#shared-by").value, "Ben");
  assert.deepEqual(texts(root, "#source-filter button[aria-pressed=true]"), [
    "Discord",
  ]);
});

test("A filter from the URL stays selectable when no visible photograph carries it", async (t) => {
  const requests = [];
  const feature = await mountFeature(t, "discovery", archive(requests), {
    url: "http://localhost/#/search?source=messenger&by=Former%20member",
  });
  const { $, root } = feature;
  await until(() => !$("#search-filters").hidden, "filters offered");
  assert.deepEqual(texts(root, "#source-filter button"), [
    "Tümü",
    "WhatsApp",
    "Discord",
    "Messenger",
  ]);
  assert.equal($("#shared-by").value, "Former member");
  assert.equal(root.querySelectorAll("#results article").length, 0);
});
