// Pure Atlas model. No runtime imports, so `node --test` can run it with type stripping.
import type { Memory } from "../memories";

export type PlaceNode = {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  count: number;
  years: Record<number, number>;
  memories: string[];
};
export type Journey = { id: string; from: string; to: string; year: number };
export type AtlasModel = {
  places: PlaceNode[];
  journeys: Journey[];
  years: number[];
  unplaced: Memory[];
};

export function placeIdOf(memory: Memory): string | null {
  return memory.place ? `${memory.place.country}:${memory.place.name}` : null;
}

export function buildAtlas(memories: Memory[]): AtlasModel {
  const byId = new Map<string, PlaceNode>();
  const sums = new Map<string, { latitude: number; longitude: number }>();
  const unplaced: Memory[] = [];
  const years = new Set<number>();
  for (const memory of memories) {
    if (memory.year !== null) years.add(memory.year);
    const id = placeIdOf(memory);
    if (!id || !memory.place) {
      unplaced.push(memory);
      continue;
    }
    let node = byId.get(id);
    if (!node) {
      node = {
        id,
        name: memory.place.name,
        country: memory.place.country,
        latitude: 0,
        longitude: 0,
        count: 0,
        years: {},
        memories: [],
      };
      byId.set(id, node);
      sums.set(id, { latitude: 0, longitude: 0 });
    }
    const sum = sums.get(id)!;
    sum.latitude += memory.place.latitude;
    sum.longitude += memory.place.longitude;
    node.count++;
    node.memories.push(memory.id);
    if (memory.year !== null)
      node.years[memory.year] = (node.years[memory.year] || 0) + 1;
  }
  const places = [...byId.values()];
  for (const node of places) {
    const sum = sums.get(node.id)!;
    node.latitude = sum.latitude / node.count;
    node.longitude = sum.longitude / node.count;
  }
  // Array.prototype.sort is stable, so equal years keep the API order.
  const dated = memories
    .filter((memory) => memory.year !== null && memory.place)
    .sort((a, b) => a.year! - b.year!);
  const journeys: Journey[] = [];
  const seen = new Set<string>();
  for (let index = 1; index < dated.length; index++) {
    const from = placeIdOf(dated[index - 1])!;
    const to = placeIdOf(dated[index])!;
    const id = `${from}>${to}`;
    if (from === to || seen.has(id)) continue;
    seen.add(id);
    journeys.push({ id, from, to, year: dated[index].year! });
  }
  return {
    places,
    journeys,
    years: [...years].sort((a, b) => a - b),
    unplaced,
  };
}

export function firstMemoryOfYear(memories: Memory[], year: number) {
  return memories.find((memory) => memory.year === year);
}

/** Memories per year across the whole archive, for the scrubber ticks. */
export function yearCounts(memories: Memory[]) {
  const counts: Record<number, number> = {};
  for (const memory of memories)
    if (memory.year !== null)
      counts[memory.year] = (counts[memory.year] || 0) + 1;
  return counts;
}
