import { CHOICES_AT_DEPTH, LIMITS, METERS, emptyData } from "./model.ts";
import type { StoryData, StoryNode, Universe } from "./model.ts";
import { addChild } from "./tree.ts";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (member: string) => `mazi.parallel.v1.${member}`;
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const id = (v: unknown) =>
  text(v, 100) &&
  !["__proto__", "constructor", "prototype"].includes(v as string);
const integer = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
export function isUniverse(v: unknown): v is Universe {
  if (!object(v) || !object(v.origin)) return false;
  const o = v.origin;
  return (
    id(v.id) &&
    id(v.rootNodeId) &&
    typeof v.createdAt === "string" &&
    Number.isFinite(Date.parse(v.createdAt)) &&
    text(o.about, 280) &&
    text(o.whatIf, 280) &&
    integer(o.startYear, 1900, 2100) &&
    ["realistic", "cinematic", "chaotic"].includes(o.tone as string)
  );
}
export function isNode(v: unknown): v is StoryNode {
  if (!object(v) || !object(v.meters) || !object(v.deltas)) return false;
  return (
    id(v.id) &&
    id(v.universeId) &&
    (v.parentId === null || id(v.parentId)) &&
    (v.choiceIndex === null || integer(v.choiceIndex, 0, 2)) &&
    integer(v.depth, 0, 3) &&
    integer(v.year, 1900, 2124) &&
    text(v.title, 120) &&
    text(v.narrative, 4000) &&
    text(v.location, 120) &&
    text(v.career, 120) &&
    METERS.every(
      (m) =>
        integer((v.meters as Record<string, unknown>)[m], 0, 100) &&
        integer((v.deltas as Record<string, unknown>)[m], -15, 15),
    ) &&
    typeof v.twist === "boolean" &&
    Array.isArray(v.keyEvents) &&
    v.keyEvents.length >= 1 &&
    v.keyEvents.length <= 3 &&
    v.keyEvents.every((e) => text(e, 200)) &&
    Array.isArray(v.choices) &&
    v.choices.length === CHOICES_AT_DEPTH[v.depth as 0 | 1 | 2 | 3] &&
    v.choices.every(
      (c) => object(c) && text(c.label, 80) && text(c.description, 200),
    ) &&
    (v.depth === 3
      ? object(v.ending) &&
        text(v.ending.title, 120) &&
        text(v.ending.epilogue, 280)
      : v.ending === null)
  );
}
export function load(
  storage: Pick<StorageLike, "getItem">,
  member: string,
): { data: StoryData; warning: string | null } {
  try {
    const raw = storage.getItem(key(member));
    if (!raw) return { data: emptyData(), warning: null };
    if (raw.length > 4_000_000) throw Error();
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.version !== 1 ||
      !Array.isArray(value.universes) ||
      !object(value.nodes)
    )
      throw Error();
    const data = emptyData();
    const candidates = Object.values(value.nodes)
      .filter(isNode)
      .sort((a, b) => a.depth - b.depth);
    for (const universe of value.universes) {
      if (
        !isUniverse(universe) ||
        data.universes.length === LIMITS.universes ||
        data.universes.some((u) => u.id === universe.id)
      )
        continue;
      let nodes = { ...data.nodes };
      for (const node of candidates.filter(
        (n) => n.universeId === universe.id,
      )) {
        if (
          node.depth === 0 &&
          (node.id !== universe.rootNodeId ||
            node.year < universe.origin.startYear ||
            node.year > universe.origin.startYear + 6)
        )
          continue;
        try {
          nodes = addChild(nodes, node);
        } catch {
          /* Drop invalid branches, including descendants. */
        }
      }
      if (nodes[universe.rootNodeId]?.universeId === universe.id) {
        data.universes.push(universe);
        data.nodes = nodes;
      }
    }
    const dropped =
      value.universes.length -
      data.universes.length +
      Object.keys(value.nodes).length -
      Object.keys(data.nodes).length;
    return {
      data,
      warning: dropped
        ? `${dropped} invalid stored records were removed.`
        : null,
    };
  } catch {
    return { data: emptyData(), warning: "corrupt" };
  }
}
export function save(
  storage: Pick<StorageLike, "setItem">,
  member: string,
  data: StoryData,
): "limit" | "full" | null {
  if (data.universes.length > LIMITS.universes) return "limit";
  try {
    storage.setItem(key(member), JSON.stringify(data));
    return null;
  } catch {
    return "full";
  }
}
export function clear(
  storage: Pick<StorageLike, "removeItem">,
  member: string,
) {
  storage.removeItem(key(member));
}
export function removeUniverse(data: StoryData, id: string): StoryData {
  return {
    ...data,
    universes: data.universes.filter((u) => u.id !== id),
    nodes: Object.fromEntries(
      Object.entries(data.nodes).filter(([, n]) => n.universeId !== id),
    ),
  };
}
