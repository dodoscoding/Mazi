import { photoMatches } from "../helpers/photo-match.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until } from "./feature-harness.mjs";
import { photoEvidenceMemory } from "../helpers/photo-evidence.ts";

function memory(count = 2) {
  return {
    ...photoEvidenceMemory,
    photos: Array.from({ length: count }, (_, index) => ({
      ...photoEvidenceMemory.photos[index % 2],
      assetId: `asset-${index}`,
      labels: index === 0 ? { screenshot: "yes", ai: "edited" } : undefined,
    })),
  };
}
const button = (root, name) =>
  [...root.querySelectorAll("button")].find(
    (node) => node.textContent === name,
  );

test("Gallery badges come from its read and explicit selection loads one bounded editor request", async (t) => {
  const reads = [];
  const { root } = await mountFeature(t, "photos", (path) => {
    reads.push(path);
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/atlas")) return { memories: [memory()] };
    if (path.startsWith("/api/discovery/matches"))
      return photoMatches(memory().photos.map((photo) => photo.assetId));
    if (path.startsWith("/api/social/labels?")) return { items: [] };
    return [];
  });
  await until(() => root.querySelector(".mem-photo-facts"), "gallery");
  assert.match(
    [...root.querySelectorAll(".mem-photo-facts")]
      .map((node) => node.textContent)
      .join(" "),
    /Ekran görüntüsü.*AI ile düzenlendi/,
  );
  assert.equal(
    reads.filter((path) => path.includes("social/labels")).length,
    0,
  );
  button(root, "Fotoğraf seç").click();
  const boxes = root.querySelectorAll(".mem-photo-select input");
  boxes[0].click();
  boxes[1].click();
  assert.match(
    root.querySelector(".mem-label-tools").textContent,
    /2 fotoğraf seçildi/,
  );
  button(root, "Seçili etiketleri düzenle").click();
  await until(
    () => reads.some((path) => path.includes("social/labels")),
    "bounded editor read",
  );
  const read = new URL(
    reads.find((path) => path.includes("social/labels")),
    "http://localhost",
  );
  assert.deepEqual(JSON.parse(read.searchParams.get("assets")).sort(), [
    "asset-0",
    "asset-1",
  ]);
});

test("Gallery selection stops at fifty stable asset IDs", async (t) => {
  const { root } = await mountFeature(t, "photos", (path) => {
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/atlas")) return { memories: [memory(51)] };
    if (path.startsWith("/api/discovery/matches"))
      return photoMatches(memory(51).photos.map((photo) => photo.assetId));
    return [];
  });
  await until(() => root.querySelector(".mem-tile"), "gallery");
  button(root, "Fotoğraf seç").click();
  const boxes = root.querySelectorAll(".mem-photo-select input");
  for (const input of [...boxes].slice(0, 50)) input.click();
  assert.equal(boxes[50].disabled, true);
  assert.match(
    root.querySelector(".mem-label-tools").textContent,
    /50 fotoğraf seçildi/,
  );
  boxes[0].click();
  assert.equal(boxes[50].disabled, false);
});

for (const action of ["deselect", "clear", "toggle"]) {
  test(`Gallery ${action} cancels an editor whose lazy import is pending`, async (t) => {
    const reads = [];
    const { root } = await mountFeature(t, "photos", (path) => {
      reads.push(path);
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/atlas")) return { memories: [memory()] };
      if (path.startsWith("/api/discovery/matches"))
        return photoMatches(memory().photos.map((photo) => photo.assetId));
      if (path.startsWith("/api/social/labels?")) return { items: [] };
      return [];
    });
    await until(() => root.querySelector(".mem-tile"), "gallery");
    button(root, "Fotoğraf seç").click();
    const checkbox = root.querySelector(".mem-photo-select input");
    checkbox.click();
    button(root, "Seçili etiketleri düzenle").click();
    if (action === "deselect") checkbox.click();
    else
      button(
        root,
        action === "clear" ? "Seçimi temizle" : "Fotoğraf seç",
      ).click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.match(
      root.querySelector(".mem-label-tools").textContent,
      /0 fotoğraf seçildi/,
    );
    assert.equal(
      reads.filter((path) => path.includes("social/labels")).length,
      0,
    );
    assert.equal(root.querySelector(".photo-label-editor"), null);
  });
}
