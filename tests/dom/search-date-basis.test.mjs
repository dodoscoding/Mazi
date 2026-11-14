import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until } from "./feature-harness.mjs";
import { photoEvidenceMemory } from "../helpers/photo-evidence.ts";

function boundary(requests) {
  return (path) => {
    requests.push(path);
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/discovery/search"))
      return {
        items: [
          {
            id: "sharing-only",
            assetId: "sharing-only",
            title: "Synthetic Discord",
            date: null,
            place: "",
            evidence: photoEvidenceMemory.photos[1].evidence,
            sources: ["discord"],
            shared_by: ["Ana"],
            people: [],
          },
        ],
        total: 1,
        next_offset:
          requests.filter((path) => path.startsWith("/api/discovery/search"))
            .length === 1
            ? 30
            : null,
        mode: "keyword / filters",
        unindexed: 0,
        facets: { sources: [], shared_by: [] },
      };
    throw Error(`Unexpected ${path}`);
  };
}
const searches = (requests) =>
  requests
    .filter((path) => path.startsWith("/api/discovery/search"))
    .map((path) => new URL(path, "http://localhost").searchParams);

test("fresh Search sends chronology and renders the photo's sharing day without Atlas", async (t) => {
  const requests = [];
  const { $, root, window } = await mountFeature(
    t,
    "discovery",
    boundary(requests),
    { route: "/search" },
  );
  await until(() => $(".disc-photo"), "photo results");
  assert.equal(searches(requests)[0].get("date_basis"), "chronology");
  assert.match(
    $(".disc-photo").textContent,
    /2 Oca 2024 · Paylaşıldı · UTC.*Yer bilinmiyor/,
  );
  assert.equal(
    requests.some(
      (path) =>
        path.startsWith("/api/atlas") ||
        path.startsWith("/api/discovery/state"),
    ),
    false,
  );
  $("#start").value = "2024-01-02";
  $("#end").value = "2024-01-02";
  $("#search-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => searches(requests).length === 2, "dated search");
  await until(() => !$("#date-scope").hidden, "dated photo scope");
  assert.equal(searches(requests).at(-1).get("start"), "2024-01-02");
  assert.equal(searches(requests).at(-1).get("end"), "2024-01-02");
  assert.match(window.location.hash, /date_basis=chronology/);
  assert.equal($("#date-scope").hidden, false);
  assert.equal(root.querySelectorAll("#memory-list a").length, 0);
});

test("old dated bookmarks keep omitted capture semantics through pagination until an explicit choice", async (t) => {
  const requests = [];
  const { $, window } = await mountFeature(t, "discovery", boundary(requests), {
    url: "http://localhost/#/search?from=2024-01-02&through=2024-01-02",
  });
  await until(() => $(".disc-photo"), "photo results");
  assert.equal($("#date-basis").value, "");
  assert.equal(searches(requests)[0].get("date_basis"), "");
  assert.doesNotMatch(window.location.hash, /date_basis/);
  $("#more").click();
  await until(() => searches(requests).length === 2, "next page");
  assert.equal(searches(requests)[1].get("offset"), "30");
  assert.equal(searches(requests)[1].get("date_basis"), "");
  $("#date-basis").value = "shared";
  $("#search-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => searches(requests).length === 3, "explicit sharing search");
  assert.equal(searches(requests)[2].get("date_basis"), "shared");
  assert.match(window.location.hash, /date_basis=shared/);
});

test("approved person links preserve the existing photo predicate without loading People management", async (t) => {
  const requests = [];
  const { root } = await mountFeature(t, "discovery", boundary(requests), {
    route: "/search?person=approved-person",
  });
  await until(
    () => requests.some((path) => path.startsWith("/api/discovery/search")),
    "photo search",
  );
  const query = new URL(
    requests.find((path) => path.startsWith("/api/discovery/search")),
    "http://localhost",
  );
  assert.equal(query.searchParams.get("person"), "approved-person");
  assert.equal(
    requests.some((path) => path.startsWith("/api/discovery/people")),
    false,
  );
  const clear = [...root.querySelectorAll("button")].find(
    (button) => button.textContent === "Onaylı kişi filtresini kaldır",
  );
  clear.click();
  await until(
    () =>
      requests.filter((path) => path.startsWith("/api/discovery/search"))
        .length === 2,
    "cleared photo search",
  );
  assert.equal(
    new URL(
      requests.filter((path) => path.startsWith("/api/discovery/search"))[1],
      "http://localhost",
    ).searchParams.get("person"),
    "",
  );
});
