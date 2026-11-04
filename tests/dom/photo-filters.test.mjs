import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until } from "./feature-harness.mjs";
import { photoEvidenceMemory } from "../helpers/photo-evidence.ts";
import { photoMatches } from "../helpers/photo-match.ts";

test("Gallery renders only authoritative matched children while preserving original photo indices and URLs", async (t) => {
  const reads = [];
  const { root, window } = await mountFeature(
    t,
    "memories",
    (path) => {
      reads.push(path);
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/atlas"))
        return { memories: [photoEvidenceMemory] };
      if (path.startsWith("/api/discovery/matches"))
        return {
          ...photoMatches([photoEvidenceMemory.photos[1].assetId]),
          photo_facets: { ...photoMatches([]).photo_facets, denominator: 2 },
        };
      return [];
    },
    {
      route:
        "/memories?screenshot=yes&ai=generated,edited&view=all&from=2024-01-02&through=2024-01-02",
    },
  );
  await until(() => root.querySelector(".mem-tile"), "matched thumbnail");
  assert.equal(root.querySelectorAll(".mem-tile").length, 1);
  assert.match(
    root.querySelector(".mem-tile").getAttribute("href"),
    /\?photo=1$/,
  );
  assert.match(
    root.querySelector("#grid-summary").textContent,
    /1 eşleşen.*2 görünür/,
  );
  assert.match(window.location.hash, /screenshot=yes/);
  const query = new URL(
    reads.find((path) => path.includes("/matches")),
    "http://localhost",
  );
  assert.equal(query.searchParams.get("ai"), "edited,generated");
  assert.equal(query.searchParams.has("date_basis"), false);
});

test("Search combines label choices, restores mode and excludes unrelated context without management reads", async (t) => {
  const reads = [];
  const { root, window } = await mountFeature(
    t,
    "discovery",
    (path) => {
      reads.push(path);
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/discovery/search"))
        return {
          items: [],
          total: 0,
          next_offset: null,
          unindexed: 0,
          facets: { sources: [], shared_by: [] },
          photo_facets: photoMatches([]).photo_facets,
        };
      return [];
    },
    { route: "/search?screenshot=yes&ai=generated,edited&mode=semantic" },
  );
  await until(
    () => root.querySelector("#count").textContent.includes("0 fotoğraf"),
    "filtered total",
  );
  const query = new URL(
    reads.find((path) => path.includes("/search?")),
    "http://localhost",
  );
  assert.equal(query.searchParams.get("mode"), "semantic");
  assert.equal(query.searchParams.get("screenshot"), "yes");
  assert.equal(query.searchParams.get("ai"), "edited,generated");
  assert.equal(root.querySelector("#date-scope").hidden, false);
  assert.equal(
    reads.some(
      (path) =>
        path.startsWith("/api/atlas") ||
        path.startsWith("/api/discovery/state"),
    ),
    false,
  );
  assert.match(window.location.hash, /mode=semantic/);
});
