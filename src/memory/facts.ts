import type { Memory } from "../memories";

const isoDay = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

function locale() {
  return typeof navigator === "undefined" ? "en" : navigator.language;
}

/** Archive dates arrive as ISO days; members read them as "14 Aug 2023". */
export function readableDate(date: string) {
  const format = new Intl.DateTimeFormat(locale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return date.replace(isoDay, (_, year, month, day) =>
    format.format(new Date(Date.UTC(+year, +month - 1, +day))),
  );
}

export function hasDate(memory: Memory) {
  return memory.date !== "Date not recorded";
}

/** The date as members read it, with "About" when the archive is unsure. */
export function displayDate(memory: Memory) {
  const date = readableDate(memory.date);
  return memory.approximate && hasDate(memory) ? `About ${date}` : date;
}

export function countryName(code: string) {
  try {
    return (
      new Intl.DisplayNames([locale()], { type: "region" }).of(
        code.toUpperCase(),
      ) || code
    );
  } catch {
    return code;
  }
}

export function placeLine(memory: Memory) {
  if (!memory.place) return "";
  return `${memory.place.name}, ${countryName(memory.place.country)}`;
}

export function coordinates(memory: Memory) {
  if (!memory.place) return "";
  const { latitude, longitude } = memory.place;
  const lat = `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? "S" : "N"}`;
  const lon = `${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? "W" : "E"}`;
  return `${lat} · ${lon}`;
}

const basisNotes: Record<string, string> = {
  undated: "Some photos have no capture date.",
  "date unknown": "Some photos have no capture date.",
  "conflicting source evidence":
    "The sources disagree about the date or place.",
  "conflicting source dates": "The sources disagree about the day.",
  "source capture evidence": "Dates come from the photos' capture times.",
  "source capture date": "Dates come from the photos' capture times.",
  "reviewed correction": "Someone in the circle corrected the date in review.",
};

/** Plain sentences for each recorded date basis, in the archive's order. */
export function dateBasisNotes(memory: Memory) {
  if (!memory.dateBasis) return [];
  return [
    ...new Set(
      memory.dateBasis
        .split(", ")
        .filter(Boolean)
        .map((basis) => basisNotes[basis] || `Date basis: ${basis}.`),
    ),
  ];
}

export type SourceKind = "photos" | "chat" | "discord" | "messenger";
const sourceNames: Record<string, [string, SourceKind]> = {
  whatsapp: ["WhatsApp export", "chat"],
  messenger: ["Messenger export", "messenger"],
  discord: ["Discord export", "discord"],
  manual: ["Photo upload", "photos"],
  archive: ["Shared archive", "photos"],
};

export type SourceRow = {
  app: string;
  kind: SourceKind;
  detail: string;
  count?: string;
};

export function sourceRows(memory: Memory): SourceRow[] {
  const photos = `${memory.photos.length} ${memory.photos.length === 1 ? "photo" : "photos"}`;
  if (!memory.source)
    return [
      {
        app: "Sample Atlas",
        kind: "photos",
        detail: "Fictional story and conversation · AI-generated photographs",
        count: photos,
      },
    ];
  const basis = memory.dateBasis
    ? `Dates: ${memory.dateBasis}`
    : "No date evidence recorded";
  const names = memory.source.split(", ").filter(Boolean);
  return names.map((name) => {
    const [app, kind] = sourceNames[name] || [name, "photos"];
    return {
      app,
      kind,
      detail: basis,
      count: names.length === 1 ? photos : undefined,
    };
  });
}

/** Sort key from the first ISO day in the date label, else the year; undated is null. */
function when(memory: Memory) {
  const day = memory.date.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (day) return day;
  return memory.year === null ? null : `${memory.year}`;
}

/**
 * Oldest first, undated last. The archive's own order puts approximate cards
 * (year null) at the very end, so it cannot be reversed into a timeline.
 */
export function chronology(memories: Memory[]) {
  return memories
    .map((memory, index) => ({ memory, index, key: when(memory) }))
    .sort((a, b) => {
      if (a.key === null || b.key === null)
        return a.key === b.key ? a.index - b.index : a.key === null ? 1 : -1;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : b.index - a.index;
    })
    .map(({ memory }) => memory);
}

export type Related = { memory: Memory; why: "Same place" | "Same year" };

/** Same place first, then same year, newest archive order kept; at most four. */
export function relatedMemories(memory: Memory, all: Memory[]): Related[] {
  const others = all.filter((item) => item.id !== memory.id);
  const samePlace = memory.place
    ? others.filter(
        (item) =>
          item.place?.name === memory.place!.name &&
          item.place?.country === memory.place!.country,
      )
    : [];
  const sameYear =
    memory.year === null
      ? []
      : others.filter(
          (item) => item.year === memory.year && !samePlace.includes(item),
        );
  return [
    ...samePlace.map((item) => ({ memory: item, why: "Same place" as const })),
    ...sameYear.map((item) => ({ memory: item, why: "Same year" as const })),
  ].slice(0, 4);
}

/** The same rule as the feature pages: first letters of the first two words. */
export { initials } from "../ui/initials";

/** A stable avatar tint per name, so a person keeps one colour everywhere. */
export function tint(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
}
