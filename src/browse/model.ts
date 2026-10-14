import type { Memory, Photo, Place } from "../memories";

let regions: Intl.DisplayNames | undefined;
export function countryName(code: string) {
  try {
    regions ??= new Intl.DisplayNames([navigator.language], {
      type: "region",
    });
    return regions.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

export function placeLabel(place: Place | null | undefined) {
  return place ? `${place.name}, ${countryName(place.country)}` : "";
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function listNames(names: string[]) {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** Evidence only: who shared the photographs, never who was there. */
export function sharedLine(memory: Memory) {
  return memory.people.shared.length
    ? `Shared by ${listNames(memory.people.shared)}`
    : "";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : name.slice(0, 2)
  ).toUpperCase();
}

const sourceNames: Record<string, string> = {
  apple: "Apple Photos",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  discord: "Discord",
  manual: "Manual upload",
  archive: "Shared archive",
};
export function sourceLabel(code: string) {
  return sourceNames[code] || code.charAt(0).toUpperCase() + code.slice(1);
}
export function sourcesOf(memory: Memory) {
  return (memory.source || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/** The first calendar date a memory carries, when its label starts with one. */
export function firstDate(memory: Memory) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(memory.date);
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : null;
}

export function monthYear(date: Date) {
  return date.toLocaleDateString(navigator.language, {
    month: "short",
    year: "numeric",
  });
}

/** A memory's date as the Components sheet writes it: exact, or "About". */
export function dateLabel(memory: Memory) {
  const date = firstDate(memory);
  const text = date
    ? date.toLocaleDateString(navigator.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : memory.date;
  return memory.approximate && date ? `About ${text}` : text;
}

export type YearGroup = { year: number | null; memories: Memory[] };
export function byYear(memories: Memory[], order: "oldest" | "newest") {
  const groups = new Map<number | null, Memory[]>();
  memories.forEach((memory) => {
    const list = groups.get(memory.year) || [];
    list.push(memory);
    groups.set(memory.year, list);
  });
  const dated = [...groups.entries()]
    .filter(([year]) => year !== null)
    .sort(([a], [b]) => (order === "oldest" ? a! - b! : b! - a!))
    .map(([year, list]) => ({
      year,
      memories: order === "oldest" ? [...list].reverse() : list,
    }));
  const undated = groups.get(null);
  return undated
    ? [...dated, { year: null, memories: undated }]
    : (dated as YearGroup[]);
}

export type Snippet = { label: string; pre: string; hit: string; post: string };
export function snippet(
  text: string,
  query: string,
  label: string,
  radius = 44,
): Snippet | null {
  const index = text.toLowerCase().indexOf(query);
  if (!query || index < 0) return null;
  const start = Math.max(0, text.lastIndexOf(" ", index - radius) + 1);
  const end = Math.min(text.length, index + query.length + radius);
  const cut = text.indexOf(" ", end);
  const stop = cut < 0 ? text.length : cut;
  return {
    label,
    pre: (start > 0 ? "…" : "") + text.slice(start, index),
    hit: text.slice(index, index + query.length),
    post:
      text.slice(index + query.length, stop) + (stop < text.length ? "…" : ""),
  };
}

export type Message = Memory["messages"][number];
export type SearchResults = {
  query: string;
  memories: { memory: Memory; snippet: Snippet | null }[];
  chats: { memory: Memory; message: Message; snippet: Snippet }[];
  places: { place: Place; memories: Memory[] }[];
  people: { name: string; shared: number; conversation: number }[];
  total: number;
};

/** Text search over what the archive already says: titles, stories, places, names and chats. */
export function searchArchive(memories: Memory[], raw: string): SearchResults {
  const query = raw.trim().toLowerCase();
  const results: SearchResults = {
    query,
    memories: [],
    chats: [],
    places: [],
    people: [],
    total: 0,
  };
  if (!query) {
    results.memories = memories.map((memory) => ({ memory, snippet: null }));
    results.total = memories.length;
    return results;
  }
  const places = new Map<string, { place: Place; memories: Memory[] }>();
  const people = new Map<string, { shared: number; conversation: number }>();
  for (const memory of memories) {
    const story = memory.description;
    const fields: [string, string][] = [
      [memory.title, "Title"],
      [story, "Story"],
      [placeLabel(memory.place), "Place"],
      [`${memory.date} ${memory.year ?? ""}`, "Date"],
      [memory.people.shared.join(", "), "Shared by"],
      [memory.by, "Added by"],
    ];
    let found: Snippet | null = null;
    for (const [text, label] of fields) {
      if (!text.toLowerCase().includes(query)) continue;
      found =
        label === "Title"
          ? { label: "Title match", pre: story, hit: "", post: "" }
          : label === "Date"
            ? { label: "Date", pre: dateLabel(memory), hit: "", post: "" }
            : snippet(text, query, label);
      break;
    }
    for (const message of memory.messages) {
      const match = snippet(message.text, query, "Chat");
      if (!match) continue;
      results.chats.push({ memory, message, snippet: match });
      found ??= {
        ...match,
        label: "Chat",
        pre: `“${match.pre}`,
        post: `${match.post}”`,
      };
    }
    if (found) results.memories.push({ memory, snippet: found });
    if (
      memory.place &&
      placeLabel(memory.place).toLowerCase().includes(query)
    ) {
      const key = `${memory.place.name}|${memory.place.country}`;
      const entry = places.get(key) || { place: memory.place, memories: [] };
      entry.memories.push(memory);
      places.set(key, entry);
    }
    const names = [
      ...memory.people.shared.map((name) => [name, "shared"] as const),
      ...memory.people.conversation.map(
        (name) => [name, "conversation"] as const,
      ),
    ];
    for (const [name, role] of names) {
      if (!name.toLowerCase().includes(query)) continue;
      const entry = people.get(name) || { shared: 0, conversation: 0 };
      entry[role]++;
      people.set(name, entry);
    }
  }
  results.places = [...places.values()];
  results.people = [...people.entries()].map(([name, counts]) => ({
    name,
    ...counts,
  }));
  results.total =
    results.memories.length +
    results.chats.length +
    results.places.length +
    results.people.length;
  return results;
}

export function personLine(person: { shared: number; conversation: number }) {
  return [
    person.shared && `Shared ${plural(person.shared, "memory", "memories")}`,
    person.conversation &&
      `In the conversation of ${plural(person.conversation, "memory", "memories")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Suggestions for an empty search come from real titles, places and years. */
export function suggestions(memories: Memory[]) {
  const words = new Set<string>();
  for (const memory of memories) {
    if (memory.place) words.add(memory.place.name);
    if (memory.year) words.add(String(memory.year));
    if (words.size >= 3) break;
  }
  return [...words].slice(0, 3);
}

export type FilterState = {
  years: Set<number>;
  places: Set<string>;
  people: Set<string>;
  sources: Set<string>;
  uncertain: boolean;
};
export type FilterOption<T> = { value: T; label: string; count: number };
export function emptyFilters(): FilterState {
  return {
    years: new Set(),
    places: new Set(),
    people: new Set(),
    sources: new Set(),
    uncertain: false,
  };
}
export function peopleOf(memory: Memory) {
  return [...new Set([...memory.people.shared, ...memory.people.conversation])];
}

/** Filter choices with photo counts, built only from what the archive returned. */
export function filterOptions(memories: Memory[]) {
  const tally = <T>(entries: [T, string, number][]) => {
    const map = new Map<T, FilterOption<T>>();
    for (const [value, label, count] of entries) {
      const option = map.get(value) || { value, label, count: 0 };
      option.count += count;
      map.set(value, option);
    }
    return [...map.values()];
  };
  const photos = (memory: Memory) => memory.photos.length;
  return {
    years: tally(
      memories
        .filter((memory) => memory.year !== null)
        .map((memory) => [memory.year!, String(memory.year), photos(memory)]),
    ).sort((a, b) => a.value - b.value),
    places: tally(
      memories
        .filter((memory) => memory.place)
        .map((memory) => [
          memory.place!.name,
          placeLabel(memory.place),
          photos(memory),
        ]),
    ).sort((a, b) => b.count - a.count),
    people: tally(
      memories.flatMap((memory) =>
        peopleOf(memory).map(
          (name) => [name, name, photos(memory)] as [string, string, number],
        ),
      ),
    ).sort((a, b) => a.label.localeCompare(b.label)),
    sources: tally(
      memories.flatMap((memory) =>
        sourcesOf(memory).map(
          (code) =>
            [code, sourceLabel(code), photos(memory)] as [
              string,
              string,
              number,
            ],
        ),
      ),
    ).sort((a, b) => b.count - a.count),
    uncertain: memories.filter((memory) => memory.approximate).length,
  };
}

export function applyFilters(memories: Memory[], filters: FilterState) {
  return memories.filter(
    (memory) =>
      (!filters.years.size ||
        (memory.year !== null && filters.years.has(memory.year))) &&
      (!filters.places.size ||
        (memory.place && filters.places.has(memory.place.name))) &&
      (!filters.people.size ||
        peopleOf(memory).some((name) => filters.people.has(name))) &&
      (!filters.sources.size ||
        sourcesOf(memory).some((code) => filters.sources.has(code))) &&
      (!filters.uncertain || memory.approximate),
  );
}

/** Contiguous years read as a range ("2023 – 2025"), others as a list. */
export function yearsLabel(years: number[]) {
  const sorted = [...years].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (year, index) => index === 0 || year === sorted[index - 1] + 1,
  );
  return contiguous && sorted.length > 2
    ? `${sorted[0]} – ${sorted[sorted.length - 1]}`
    : sorted.join(", ");
}

export type Rediscovery = {
  heroes: { memory: Memory; kicker: string }[];
  places: { place: Place; last: Memory; lastDate: Date; count: number }[];
  year: {
    year: number;
    photos: { memory: Memory; photo: Photo; index: number }[];
    memories: number;
    places: string[];
  } | null;
  uncertain: number;
  first: Memory | null;
};

const dayMs = 86_400_000;
function yearsAgo(count: number) {
  const words = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
  ];
  const number = words[count] || String(count);
  return `${number} ${count === 1 ? "year" : "years"} ago`;
}

/**
 * Prompts for looking back. Anniversaries within a week lead; otherwise the
 * day of the year picks a memory, so the page changes each morning.
 */
export function rediscover(
  memories: Memory[],
  today = new Date(),
): Rediscovery {
  const dated = memories
    .map((memory) => ({ memory, date: firstDate(memory) }))
    .filter(
      (entry): entry is { memory: Memory; date: Date } =>
        entry.date !== null && entry.memory.photos.length > 0,
    );
  const past = dated.filter(
    (entry) => today.getTime() - entry.date.getTime() >= 300 * dayMs,
  );
  const result: Rediscovery = {
    heroes: [],
    places: [],
    year: null,
    uncertain: memories.filter((memory) => memory.approximate).length,
    first: null,
  };
  if (!past.length) return result;
  for (const { memory, date } of past) {
    const anniversary = new Date(date);
    anniversary.setFullYear(today.getFullYear());
    const distance = Math.abs(anniversary.getTime() - today.getTime());
    const years = today.getFullYear() - date.getFullYear();
    if (distance <= 7 * dayMs && years > 0)
      result.heroes.push({
        memory,
        kicker: `${yearsAgo(years)} this week`,
      });
  }
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / dayMs,
  );
  const rotation = past.map(
    (_, index) => past[(index + dayOfYear) % past.length],
  );
  for (const { memory, date } of rotation)
    if (!result.heroes.some((hero) => hero.memory === memory))
      result.heroes.push({
        memory,
        kicker: `From ${date.toLocaleDateString(navigator.language, { month: "long", year: "numeric" })}`,
      });
  const places = new Map<string, Rediscovery["places"][number]>();
  for (const { memory, date } of dated) {
    if (!memory.place) continue;
    const key = `${memory.place.name}|${memory.place.country}`;
    const entry = places.get(key);
    if (!entry)
      places.set(key, {
        place: memory.place,
        last: memory,
        lastDate: date,
        count: 1,
      });
    else {
      entry.count++;
      if (date > entry.lastDate)
        Object.assign(entry, { last: memory, lastDate: date });
    }
  }
  result.places = [...places.values()]
    .filter(
      (entry) => today.getTime() - entry.lastDate.getTime() >= 365 * dayMs,
    )
    .sort((a, b) => a.lastDate.getTime() - b.lastDate.getTime())
    .slice(0, 3);
  const years = new Map<number, Memory[]>();
  for (const { memory, date } of past) {
    const list = years.get(date.getFullYear()) || [];
    list.push(memory);
    years.set(date.getFullYear(), list);
  }
  const busiest = [...years.entries()].sort(
    ([, a], [, b]) =>
      b.reduce((sum, memory) => sum + memory.photos.length, 0) -
      a.reduce((sum, memory) => sum + memory.photos.length, 0),
  )[0];
  if (busiest)
    result.year = {
      year: busiest[0],
      photos: busiest[1]
        .flatMap((memory) =>
          memory.photos.map((photo, index) => ({ memory, photo, index })),
        )
        .slice(0, 5),
      memories: busiest[1].length,
      places: [
        ...new Set(
          busiest[1].flatMap((memory) =>
            memory.place ? [memory.place.name] : [],
          ),
        ),
      ],
    };
  result.first = [...past].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  )[0].memory;
  return result;
}

export function yearsSince(date: Date, today = new Date()) {
  const years = today.getFullYear() - date.getFullYear();
  return years < 1 ? "this year" : `${plural(years, "year")} ago`;
}
