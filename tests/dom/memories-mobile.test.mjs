import assert from "node:assert/strict";
import test from "node:test";
import { mountFeature, until } from "./feature-harness.mjs";
import { photoMatches } from "../helpers/photo-match.ts";
test("phone Photos exposes a conventional year and compact filters without alternate browse modes", async (t) => {
  const { $, root, window } = await mountFeature(t, "photos", (path) =>
    path.startsWith("/api/atlas") ? { memories: [] } : photoMatches([]),
  );
  window.happyDOM.setViewport({ width: 390, height: 844 });
  await until(
    () => $("#grid-summary").textContent.includes("0 eşleşen"),
    "loaded",
  );
  assert.ok($("#photos-year"));
  assert.ok($("#filters-open"));
  assert.equal(root.querySelectorAll("#grid-view,#grid-order").length, 0);
  $("#filters-open").click();
  assert.equal($("#memory-filters").getAttribute("role"), "dialog");
  assert.equal($("#filters-open").getAttribute("aria-expanded"), "true");
  $("#memory-filters").dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert.equal($("#filters-open").getAttribute("aria-expanded"), "false");
});
