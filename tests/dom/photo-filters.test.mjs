import assert from "node:assert/strict";
import test from "node:test";
import { deferred, group, mountFeature, until } from "./feature-harness.mjs";
import { photoEvidenceMemory } from "../helpers/photo-evidence.ts";
import { photoMatches } from "../helpers/photo-match.ts";

test("Gallery renders only authoritative matched children while preserving original photo indices and URLs", async (t) => {
  const reads = [];
  const { root, window } = await mountFeature(
    t,
    "photos",
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

test("Photos restores archive and label predicates and reset clears the complete selection", async (t) => {
  const reads = [];
  const { root, window } = await mountFeature(
    t,
    "photos",
    (path) => {
      reads.push(path);
      if (path.startsWith("/api/atlas")) return { memories: [] };
      if (path.startsWith("/api/discovery/matches")) return photoMatches([]);
      return [];
    },
    {
      route:
        "/photos?years=2024&places=%5B%22Doe%2C%20City%22%5D&uncertain=true&screenshot=yes&ai=generated,edited&source=apple&by=Ana",
    },
  );
  await until(
    () => reads.some((path) => path.includes("/matches?")),
    "restored predicates",
  );
  const query = new URL(
    reads.find((path) => path.includes("/matches?")),
    "http://localhost",
  ).searchParams;
  for (const [key, value] of Object.entries({
    years: "2024",
    places: '["Doe, City"]',
    uncertain: "true",
    screenshot: "yes",
    ai: "edited,generated",
    source: "apple",
    shared_by: '["Ana"]',
  }))
    assert.equal(query.get(key), value);
  root.querySelector("#filters-reset").click();
  await until(
    () => reads.filter((path) => path.includes("/matches?")).length === 2,
    "cleared predicates",
  );
  const reset = new URL(
    reads.filter((path) => path.includes("/matches?"))[1],
    "http://localhost",
  ).searchParams;
  for (const key of [
    "years",
    "places",
    "uncertain",
    "screenshot",
    "ai",
    "source",
    "shared_by",
  ])
    assert.equal(reset.get(key), null);
  assert.equal(window.location.hash, "#/photos");
});

test("pending and failed Gallery matches clear stale thumbnails and totals while retaining the filter", async (t) => {
  const pending = deferred();
  let calls = 0;
  const { root } = await mountFeature(t, "photos", (path) => {
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/atlas"))
      return { memories: [photoEvidenceMemory] };
    if (path.startsWith("/api/discovery/matches"))
      return ++calls === 1
        ? photoMatches(photoEvidenceMemory.photos.map((photo) => photo.assetId))
        : pending.promise;
    return [];
  });
  await until(
    () => root.querySelectorAll(".mem-tile").length === 2,
    "initial matched photos",
  );
  const field = [...root.querySelectorAll(".photo-filters fieldset")].find(
    (node) => node.querySelector("legend").textContent === "Ekran görüntüsü",
  );
  field.querySelector('input[value="yes"]').click();
  assert.equal(root.querySelectorAll(".mem-tile").length, 0);
  assert.match(root.querySelector("#grid-summary").textContent, /aranıyor/);
  pending.resolve(
    Object.assign(Error("Synthetic metadata limit"), {
      code: "capacity_exceeded",
      status: 400,
    }),
  );
  await until(() => root.querySelector("#grid button"), "retry action");
  assert.doesNotMatch(root.querySelector("#grid-summary").textContent, /[0-9]/);
  assert.equal(root.querySelectorAll(".mem-tile").length, 0);
  const current = [...root.querySelectorAll(".photo-filters fieldset")].find(
    (node) => node.querySelector("legend").textContent === "Ekran görüntüsü",
  );
  assert.equal(current.querySelector('input[value="yes"]').checked, true);
});

function changePresentation(root, action) {
  if (action === "view")
    root.querySelector('#grid-view [data-view="all"]').click();
  else if (action === "order") root.querySelector("#grid-order").click();
  else
    [...root.querySelectorAll("button")]
      .find((button) => button.textContent === "Fotoğraf seç")
      .click();
}

for (const action of ["selection"]) {
  for (const status of [400, 503]) {
    test(`Gallery keeps failed authority after ${action} changes (HTTP ${status}) and retries the filter`, async (t) => {
      const reads = [];
      const ids = photoEvidenceMemory.photos.map((photo) => photo.assetId);
      let calls = 0;
      const { root } = await mountFeature(t, "photos", (path) => {
        if (path === "/api/groups") return [group];
        if (path.startsWith("/api/atlas"))
          return { memories: [photoEvidenceMemory] };
        if (path.startsWith("/api/discovery/matches")) {
          reads.push(new URL(path, "http://localhost"));
          if (++calls === 1) return photoMatches(ids);
          if (calls === 2)
            return Object.assign(Error("Synthetic unavailable read"), {
              status,
              ...(status === 400 ? { code: "capacity_exceeded" } : {}),
            });
          return {
            ...photoMatches([ids[1]]),
            photo_facets: {
              ...photoMatches(ids).photo_facets,
              screenshot: [
                { value: "yes", count: 1 },
                { value: "unknown", count: 1 },
              ],
            },
          };
        }
        return [];
      });
      await until(
        () => root.querySelectorAll(".mem-tile").length === 2,
        "initial authority",
      );
      const screenshot = [
        ...root.querySelectorAll(".photo-filters fieldset"),
      ].find(
        (field) =>
          field.querySelector("legend").textContent === "Ekran görüntüsü",
      );
      screenshot.querySelector('input[value="yes"]').click();
      await until(
        () => root.querySelector("#grid button"),
        "failed read recovery",
      );
      const retry = root.querySelector("#grid button");
      const error = root.querySelector("#grid").textContent;
      changePresentation(root, action);
      assert.equal(
        root.querySelector("#grid-summary").textContent,
        "Eşleşmeler yüklenemedi.",
      );
      assert.equal(root.querySelector("#grid button"), retry);
      assert.equal(root.querySelector("#grid").textContent, error);
      assert.equal(root.querySelectorAll(".mem-empty").length, 0);
      assert.equal(reads.length, 2);
      retry.click();
      await until(
        () => root.querySelectorAll(".mem-tile").length === 1,
        "successful authoritative retry",
      );
      assert.equal(reads[2].searchParams.get("screenshot"), "yes");
      assert.equal(
        root.querySelector("#grid-summary").textContent,
        "1 eşleşen fotoğraf · 2 görünür fotoğraf",
      );
      assert.equal(
        root.querySelector(".mem-tile").getAttribute("href"),
        `#/memory/${photoEvidenceMemory.id}?photo=1`,
      );
    });
  }

  test(`Gallery keeps an initial archive failure after ${action} changes`, async (t) => {
    const { root } = await mountFeature(t, "photos", (path) => {
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/atlas"))
        return Object.assign(Error("Synthetic archive unavailable"), {
          status: 503,
        });
      return [];
    });
    await until(() => root.querySelector("#grid button"), "archive retry");
    const before = root.querySelector("#grid").textContent;
    changePresentation(root, action);
    assert.equal(root.querySelector("#grid").textContent, before);
    assert.equal(
      root.querySelector("#grid button").textContent,
      "Yeniden dene",
    );
    assert.doesNotMatch(
      root.querySelector("#grid-summary").textContent,
      /[0-9]/,
    );
  });
}
