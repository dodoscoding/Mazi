import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { photoEvidenceMemory } from "../helpers/photo-evidence.ts";
import { group, mountFeature, until } from "./feature-harness.mjs";
import { atlasHarness } from "./atlas-harness.mjs";

test("both gallery modes render each photo's date and place under its thumbnail", async (t) => {
  const { $, root } = await mountFeature(t, "memories", (path) => {
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/atlas"))
      return { memories: [photoEvidenceMemory] };
    if (path.startsWith("/api/memories/recap"))
      return { year: 2024, coverage: "Synthetic", memories: [] };
    if (path.startsWith("/api/memories/notifications"))
      return { enabled: false, items: [] };
    return [];
  });
  await until(() => $(".mem-photo-facts"), "per-photo facts");
  const check = () => {
    const facts = [...root.querySelectorAll(".mem-photo-facts")].map(
      (node) => node.textContent,
    );
    assert.match(facts[0], /2 Oca 2020 · Çekildi.*Istanbul, TR/);
    assert.match(facts[1], /2 Oca 2024 · Paylaşıldı · UTC.*Yer bilinmiyor/);
    assert.doesNotMatch(facts[1], /Istanbul|Çekildi/);
  };
  check();
  $('[data-view="all"]').click();
  check();
  assert.equal(root.querySelectorAll(".mem-moment").length, 0);
});

test("Viewer changes the facts with the selected photo instead of copying the memory summary", async (t) => {
  let root;
  t.after(async () => {
    if (root) await act(async () => root.unmount());
  });
  const harness = await atlasHarness(t);
  const { Viewer } = await harness.server.ssrLoadModule(
    "/src/memory/Viewer.tsx",
  );
  const host = harness.window.document.createElement("div");
  harness.window.document.body.append(host);
  root = createRoot(host);
  const render = async (index) =>
    act(async () =>
      root.render(
        createElement(Viewer, {
          memory: photoEvidenceMemory,
          index,
          meta: "Wrong memory-wide metadata",
          reduced: true,
          go() {},
        }),
      ),
    );
  await render(0);
  assert.match(
    host.querySelector(".viewer-caption-text").textContent,
    /2 Oca 2020 · Çekildi.*Istanbul, TR/,
  );
  await render(1);
  const caption = host.querySelector(".viewer-caption-text").textContent;
  assert.match(caption, /2 Oca 2024 · Paylaşıldı · UTC.*Yer bilinmiyor/);
  assert.doesNotMatch(caption, /Istanbul|2020|Wrong memory/);
});
