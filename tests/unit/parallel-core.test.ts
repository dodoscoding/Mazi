import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDeltas,
  addChild,
  childOf,
  pathTo,
  stubs,
  endingsFound,
  removeBranch,
} from "../../src/parallel/tree.ts";
import { fixtureChapter } from "../../src/parallel/fixtures.ts";
import { buildChapterRequest } from "../../src/parallel/request.ts";
import { layout } from "../../src/parallel/layout.ts";
import {
  load,
  save,
  clear,
  removeUniverse,
} from "../../src/parallel/storage.ts";
import type { StoryNode, Universe } from "../../src/parallel/model.ts";
const universe: Universe = {
  id: "u",
  rootNodeId: "root",
  createdAt: "2026-11-14T00:00:00Z",
  origin: {
    about: "Student",
    startYear: 2022,
    whatIf: "I moved abroad",
    tone: "cinematic",
  },
};
const root: StoryNode = {
  ...fixtureChapter(buildChapterRequest(universe, {}, null, null)),
  id: "root",
  universeId: "u",
  parentId: null,
  choiceIndex: null,
  depth: 0,
};
function child(
  parent: StoryNode,
  index: number,
  nodes: Record<string, StoryNode>,
) {
  return {
    ...fixtureChapter(buildChapterRequest(universe, nodes, parent.id, index)),
    id: `${parent.id}-${index}`,
    universeId: "u",
    parentId: parent.id,
    choiceIndex: index,
    depth: (parent.depth + 1) as StoryNode["depth"],
  };
}
test("tree rejects duplicates, invalid branches, cycles and mutation", () => {
  const nodes = addChild({}, root);
  const next = child(root, 0, nodes);
  const branch = addChild(nodes, next);
  assert.equal(Object.keys(nodes).length, 1);
  assert.equal(childOf(branch, "root", 0)?.id, next.id);
  for (const bad of [
    next,
    { ...next, id: "other" },
    { ...next, id: "x", choiceIndex: 0.5 },
    { ...next, id: "x", universeId: "other" },
    { ...next, id: "x", depth: 3 as const },
  ])
    assert.throws(() => addChild(branch, bad));
  assert.deepEqual(
    pathTo(branch, next.id).map((n) => n.id),
    ["root", next.id],
  );
  assert.throws(() => pathTo({ root: { ...root, parentId: "root" } }, "root"));
  assert.equal(stubs(branch, "u").length, 4);
  assert.deepEqual(removeBranch(branch, next.id), nodes);
});
test("full tree has 22 chapters, 12 endings and distinct layout leaves", () => {
  let nodes = addChild({}, root);
  for (let depth = 0; depth < 3; depth++)
    for (const parent of Object.values(nodes).filter((n) => n.depth === depth))
      for (let i = 0; i < parent.choices.length; i++)
        nodes = addChild(nodes, child(parent, i, nodes));
  assert.equal(Object.keys(nodes).length, 22);
  assert.equal(endingsFound(nodes, "u"), 12);
  assert.equal(stubs(nodes, "u").length, 0);
  const map = layout(nodes, "root");
  assert.equal(map.rows, 12);
  assert.equal(
    new Set(map.items.filter((n) => n.x === 3).map((n) => n.y)).size,
    12,
  );
  assert.deepEqual(layout(nodes, "root"), map);
});
test("meter changes are bounded and finite", () => {
  assert.deepEqual(
    applyDeltas(
      { finances: 99, relationships: 0, freedom: 50, wellbeing: 50 },
      { finances: 90, relationships: -90, freedom: 2.6, wellbeing: -2.6 },
    ),
    { finances: 100, relationships: 0, freedom: 53, wellbeing: 47 },
  );
  assert.throws(() =>
    applyDeltas(root.meters, { ...root.deltas, finances: NaN }),
  );
});
test("requests contain only ancestor path and fixture endings stop", () => {
  let nodes = addChild({}, root);
  let parent = root;
  for (let i = 0; i < 3; i++) {
    const request = buildChapterRequest(universe, nodes, parent.id, 0);
    assert.equal(request.path.length, i + 1);
    const next = child(parent, 0, nodes);
    nodes = addChild(nodes, next);
    parent = next;
  }
  assert.equal(parent.choices.length, 0);
  assert.ok(parent.ending);
  assert.throws(() => buildChapterRequest(universe, nodes, parent.id, 0));
});
class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
test("storage isolates members, validates structure and reports failures", () => {
  const storage = new MemoryStorage();
  const data = { version: 1 as const, universes: [universe], nodes: { root } };
  assert.equal(save(storage, "alice", data), null);
  assert.equal(load(storage, "bob").data.universes.length, 0);
  assert.deepEqual(load(storage, "alice").data, data);
  storage.setItem("mazi.parallel.v1.alice", "broken");
  assert.equal(load(storage, "alice").warning, "corrupt");
  storage.setItem(
    "mazi.parallel.v1.alice",
    JSON.stringify({
      ...data,
      nodes: { root: { ...root, meters: { ...root.meters, finances: 101 } } },
    }),
  );
  assert.equal(load(storage, "alice").data.universes.length, 0);
  assert.equal(
    save(storage, "alice", { ...data, universes: Array(21).fill(universe) }),
    "limit",
  );
  assert.equal(
    save(
      {
        ...storage,
        setItem() {
          throw Error("full");
        },
      },
      "alice",
      data,
    ),
    "full",
  );
  assert.equal(removeUniverse(data, "u").universes.length, 0);
  clear(storage, "alice");
  assert.equal(storage.getItem("mazi.parallel.v1.alice"), null);
});
