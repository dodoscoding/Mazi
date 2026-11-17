import { CHOICES_AT_DEPTH, MAX_DELTA, METERS } from "./model.ts";
import type { Meters, StoryNode } from "./model.ts";
export type Nodes = Record<string, StoryNode>;
export function clampMeter(value: number) {
  if (!Number.isFinite(value)) throw Error("Invalid meter");
  return Math.min(100, Math.max(0, Math.round(value)));
}
export function applyDeltas(meters: Meters, deltas: Meters): Meters {
  const next = { ...meters };
  for (const meter of METERS) {
    if (!Number.isFinite(deltas[meter])) throw Error("Invalid change");
    next[meter] = clampMeter(
      meters[meter] + Math.max(-MAX_DELTA, Math.min(MAX_DELTA, deltas[meter])),
    );
  }
  return next;
}
export const childOf = (nodes: Nodes, parentId: string, choiceIndex: number) =>
  Object.values(nodes).find(
    (n) => n.parentId === parentId && n.choiceIndex === choiceIndex,
  );
export function addChild(nodes: Nodes, node: StoryNode): Nodes {
  if (Object.hasOwn(nodes, node.id)) throw Error("Chapter already exists");
  if (!Number.isInteger(node.depth) || node.depth < 0 || node.depth > 3)
    throw Error("Invalid depth");
  const parent = node.parentId === null ? null : nodes[node.parentId];
  if (node.parentId !== null && !parent) throw Error("Unknown parent");
  if (parent) {
    if (parent.universeId !== node.universeId) throw Error("Universe mismatch");
    if (node.depth !== parent.depth + 1) throw Error("Wrong depth");
    if (
      node.choiceIndex === null ||
      !Number.isInteger(node.choiceIndex) ||
      node.choiceIndex < 0 ||
      node.choiceIndex >= parent.choices.length
    )
      throw Error("Unknown choice");
    if (childOf(nodes, parent.id, node.choiceIndex))
      throw Error("Branch exists");
    if (node.year < parent.year || node.year > parent.year + 6)
      throw Error("Invalid year");
  } else if (
    node.depth !== 0 ||
    node.choiceIndex !== null ||
    Object.values(nodes).some(
      (n) => n.universeId === node.universeId && n.parentId === null,
    )
  )
    throw Error("Invalid root");
  if (
    node.choices.length !== CHOICES_AT_DEPTH[node.depth] ||
    Boolean(node.ending) !== (node.depth === 3)
  )
    throw Error("Invalid chapter shape");
  return { ...nodes, [node.id]: node };
}
export function pathTo(nodes: Nodes, id: string): StoryNode[] {
  const path: StoryNode[] = [];
  const seen = new Set<string>();
  let current = nodes[id];
  if (!current) throw Error("Unknown chapter");
  while (current) {
    if (seen.has(current.id) || path.length > 3)
      throw Error("Invalid ancestry");
    seen.add(current.id);
    path.unshift(current);
    if (current.parentId === null) break;
    const parent = nodes[current.parentId];
    if (!parent || parent.universeId !== current.universeId)
      throw Error("Missing ancestor");
    current = parent;
  }
  return path;
}
export const stubs = (nodes: Nodes, universeId: string) =>
  Object.values(nodes)
    .filter((n) => n.universeId === universeId)
    .flatMap((n) =>
      n.choices.map((_, choiceIndex) => ({ parentId: n.id, choiceIndex })),
    )
    .filter((s) => !childOf(nodes, s.parentId, s.choiceIndex));
export const endingsFound = (nodes: Nodes, universeId: string) =>
  Object.values(nodes).filter(
    (n) => n.universeId === universeId && n.depth === 3,
  ).length;
export function removeBranch(nodes: Nodes, id: string): Nodes {
  const removed = new Set([id]);
  for (let i = 0; i < 4; i++)
    for (const n of Object.values(nodes))
      if (n.parentId && removed.has(n.parentId)) removed.add(n.id);
  return Object.fromEntries(
    Object.entries(nodes).filter(([key]) => !removed.has(key)),
  );
}
