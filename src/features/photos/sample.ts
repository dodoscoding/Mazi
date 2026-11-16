import { memories } from "../../memories";

// Explicit sample mode never reads a member's live archive. These fictional
// records have approximate memory dates, not reliable photo capture dates.
const samples = memories.map((memory) => ({
  ...memory,
  photos: memory.photos.map((photo, index) => ({
    ...photo,
    assetId: `sample-${memory.id}-${index}`,
  })),
}));
export async function sampleRead(path: string) {
  const url = new URL(path, location.origin);
  if (url.pathname === "/api/atlas") return { memories: samples };
  if (url.pathname === "/api/discovery/conversations")
    return { items: [], next_cursor: null, complete: true };
  if (url.pathname !== "/api/discovery/matches")
    throw Error("Sample mode only reads fictional photographs.");
  const query = (url.searchParams.get("query") || "").toLocaleLowerCase();
  const unsupported = [
    "years",
    "places",
    "place",
    "country",
    "object_query",
    "start",
    "end",
    "source",
    "person",
    "people_present",
    "screenshot",
    "ai",
  ].some((key) => url.searchParams.has(key));
  const matched = unsupported
    ? []
    : samples.filter((memory) =>
        [
          memory.title,
          memory.description,
          memory.by,
          ...memory.photos.map((photo) => photo.alt),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
      );
  const ids = matched.flatMap((memory) =>
    memory.photos.map((photo) => photo.assetId),
  );
  return {
    asset_ids: ids,
    total: ids.length,
    facets: { shared_by: [], sources: [] },
    photo_facets: {
      denominator: samples.reduce((n, memory) => n + memory.photos.length, 0),
      years: [],
      places: [],
    },
  };
}
