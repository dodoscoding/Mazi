import assert from "node:assert/strict";
import test from "node:test";
import { deferred, mountFeature, until } from "./feature-harness.mjs";
import { photoEvidenceMemory } from "../helpers/photo-evidence.ts";
import { photoMatches } from "../helpers/photo-match.ts";
const ready = (path) =>
  path.startsWith("/api/atlas")
    ? { memories: [photoEvidenceMemory] }
    : path.startsWith("/api/discovery/conversations")
      ? { items: [], next_cursor: null, complete: true }
      : photoMatches(photoEvidenceMemory.photos.map((photo) => photo.assetId));
for (const status of [400, 503])
  test(`Photos search ${status} clears stale matches, retains query and retries`, async (t) => {
    let fail = false;
    const reads = [];
    const f = await mountFeature(
      t,
      "photos",
      (path) => {
        reads.push(path);
        return fail && path.startsWith("/api/discovery/matches")
          ? Object.assign(Error("Synthetic failure"), { status })
          : ready(path);
      },
      {
        route:
          "/photos?q=ferry&source=discord&by=Ana&person=person-id&from=2024-01-02&through=2024-01-02",
      },
    );
    await until(() => f.$(".mem-tile"), "initial photographs");
    const params = new URL(
      reads.find((path) => path.includes("/matches?")),
      "http://localhost",
    ).searchParams;
    for (const [key, value] of Object.entries({
      query: "ferry",
      source: "discord",
      shared_by: '["Ana"]',
      person: "person-id",
      start: "2024-01-02",
      end: "2024-01-02",
    }))
      assert.equal(params.get(key), value);
    assert.equal(params.has("date_basis"), false);
    fail = true;
    f.$("#photos-query").value = "retry";
    f.$("#photos-search").dispatchEvent(
      new f.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await until(
      () => f.$("#grid-summary").textContent === "Eşleşmeler yüklenemedi.",
      "failed search",
    );
    assert.equal(f.root.querySelectorAll(".mem-tile").length, 0);
    assert.equal(f.$("#photos-query").value, "retry");
    fail = false;
    [...f.$("#grid").querySelectorAll("button")]
      .find((node) => node.textContent === "Yeniden dene")
      .click();
    await until(() => f.$(".mem-tile"), "recovered photographs");
    assert.match(f.window.location.hash, /q=retry/);
  });

test("Photos displays photographs while secondary conversations fail and retry independently", async (t) => {
  let fail = true;
  const f = await mountFeature(
    t,
    "photos",
    (path) =>
      path.startsWith("/api/discovery/conversations") && fail
        ? Error("Synthetic context failure")
        : ready(path),
    { route: "/photos?q=ferry" },
  );
  await until(() => f.$(".mem-tile"), "photographs");
  await until(() => !f.$("#conversation-retry").hidden, "secondary retry");
  assert.equal(f.root.querySelectorAll(".mem-tile").length, 2);
  fail = false;
  f.$("#conversation-retry").click();
  await until(
    () => f.$("#conversation-status").textContent === "Eşleşen konuşma yok.",
    "recovered secondary search",
  );
  assert.equal(f.root.querySelectorAll(".mem-tile").length, 2);
});

test("late Photos matching response cannot replace a newer query", async (t) => {
  const pending = deferred();
  let requests = 0;
  const f = await mountFeature(t, "photos", (path) =>
    path.startsWith("/api/discovery/matches") && ++requests === 1
      ? pending.promise
      : ready(path),
  );
  await until(() => requests === 1, "held search");
  f.$("#photos-query").value = "newer";
  f.$("#photos-search").dispatchEvent(
    new f.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => f.$(".mem-tile"), "new search");
  pending.resolve(photoMatches([]));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(f.root.querySelectorAll(".mem-tile").length, 2);
  assert.equal(f.$("#photos-query").value, "newer");
});

test("Photos preserves legacy place, country and object predicates plus opaque bookmark context", async (t) => {
  const reads = [];
  const f = await mountFeature(
    t,
    "photos",
    (path) => {
      reads.push(path);
      return ready(path);
    },
    {
      route:
        "/photos?q=ferry&place=Lake&country=TR&object=boat&bookmark=keep-me",
    },
  );
  await until(() => f.$(".mem-tile"), "restored archive");
  const params = new URL(
    reads.find((path) => path.includes("/matches?")),
    "http://localhost",
  ).searchParams;
  assert.equal(params.get("place"), "Lake");
  assert.equal(params.get("country"), "TR");
  assert.equal(params.get("object_query"), "boat");
  const restored = new URLSearchParams(f.window.location.hash.split("?")[1]);
  for (const [key, value] of Object.entries({
    place: "Lake",
    country: "TR",
    object: "boat",
    bookmark: "keep-me",
  }))
    assert.equal(restored.get(key), value);
  assert.match(f.$("#memory-filters").textContent, /Lake.*TR.*boat/);
});
