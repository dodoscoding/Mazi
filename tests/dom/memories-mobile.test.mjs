import { photoMatches } from "../helpers/photo-match.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { group, mountFeature, until } from "./feature-harness.mjs";

const memory = (id, year) => ({
  id,
  year,
  title: id,
  date: `${year}-01-02`,
  approximate: false,
  source: "manual",
  place: null,
  people: { shared: [], conversation: [] },
  photos: [{ assetId: id, src: `/synthetic/${id}.jpg`, alt: id }],
});
function response(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/discovery/matches"))
    return photoMatches(["Newer", "Older"]);
  if (path.startsWith("/api/atlas"))
    return { memories: [memory("Newer", 2025), memory("Older", 2024)] };
  if (path.startsWith("/api/memories/recap"))
    return { year: 2024, coverage: "Synthetic", memories: [] };
  if (
    path.startsWith("/api/memories/stories") ||
    path.startsWith("/api/memories/capsules")
  )
    return [];
  if (path.startsWith("/api/memories/notifications"))
    return { enabled: false, items: [] };
  throw Error(`Unexpected ${path}`);
}

test("phone gallery keeps native view and ordering controls visible, selected and focusable", async (t) => {
  const { $, root, window } = await mountFeature(t, "memories", response);
  window.happyDOM.setViewport({ width: 390, height: 844 });
  root.className = "feature-content";
  for (const path of [
    "styles/browse.css",
    "features/features.css",
    "features/memories/memories.css",
    "features/workspace.css",
  ]) {
    const style = window.document.createElement("style");
    style.textContent = await readFile(
      new URL(`../../src/${path}`, import.meta.url),
      "utf8",
    );
    window.document.head.append(style);
  }
  await until(() => $(".mem-moment-title"), "photographic moments");
  assert.equal(window.getComputedStyle($("#grid-view")).display, "flex");
  assert.equal(
    window.getComputedStyle($("#grid-order")).display,
    "inline-flex",
  );
  const titles = () =>
    [...root.querySelectorAll(".mem-moment-title")].map(
      (node) => node.textContent,
    );
  assert.deepEqual(titles(), ["Newer", "Older"]);
  $("#grid-order").focus();
  $("#grid-order").click();
  assert.equal(window.document.activeElement, $("#grid-order"));
  assert.equal($("#grid-order-label").textContent, "Önce en eski");
  assert.deepEqual(titles(), ["Older", "Newer"]);
  const all = $('[data-view="all"]');
  all.focus();
  all.click();
  assert.equal(all.getAttribute("aria-pressed"), "true");
  assert.equal($('[data-view="moment"]').getAttribute("aria-pressed"), "false");
  assert.equal(window.document.activeElement, all);
  assert.equal(root.querySelectorAll(".mem-moment").length, 0);
  assert.deepEqual(
    [...root.querySelectorAll(".mem-tile img")].map((img) => img.alt),
    ["Older", "Newer"],
  );
  $('[data-view="moment"]').click();
  assert.deepEqual(titles(), ["Older", "Newer"]);
  window.happyDOM.setViewport({ width: 320, height: 740 });
  assert.equal(window.getComputedStyle($("#grid-view")).display, "flex");
  assert.equal(
    window.getComputedStyle($("#grid-order")).display,
    "inline-flex",
  );
});
