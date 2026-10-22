import type { Memory } from "../memories";

export type ChronologyDate =
  | {
      basis: "capture" | "shared";
      year: number;
      sortKey: string;
      label: string;
    }
  | { basis: "unknown"; year: null; sortKey: null; label: string };
export type ChronologyEntry = { memory: Memory; date: ChronologyDate };

function calendarDay(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/.exec(value || "");
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? match[0].slice(0, 10)
    : null;
}
function readable(day: string) {
  return new Intl.DateTimeFormat(
    typeof navigator === "undefined" ? "en" : navigator.language,
    { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
  ).format(new Date(`${day}T00:00:00Z`));
}
export function chronologyDate(memory: Memory): ChronologyDate {
  if (memory.year !== null) {
    const day = calendarDay(memory.date.split(" · ")[0].split(" to ")[0]);
    return {
      basis: "capture",
      year: memory.year,
      sortKey:
        day && Number(day.slice(0, 4)) === memory.year
          ? day
          : String(memory.year),
      label: memory.date,
    };
  }
  const capture = /\d{4}|conflict|some dates unknown/i.test(
    `${memory.date} ${memory.dateBasis || ""}`,
  )
    ? "Capture date incomplete"
    : "Capture date unknown";
  const days = memory.photos.map(
    (photo) =>
      (photo.provenance || [])
        .flatMap((item) => {
          const day =
            !item.sharedAt.ambiguous && calendarDay(item.sharedAt.local);
          return day ? [day] : [];
        })
        .sort()[0],
  );
  if (!days.length || days.some((day) => !day))
    return {
      basis: "unknown",
      year: null,
      sortKey: null,
      label:
        capture === "Capture date incomplete"
          ? `${memory.date} · ${capture}`
          : capture,
    };
  const sorted = (days as string[]).sort();
  const first = sorted[0],
    last = sorted[sorted.length - 1];
  return {
    basis: "shared",
    year: Number(first.slice(0, 4)),
    sortKey: first,
    label: `${first === last ? `Shared on ${readable(first)}` : `Shared between ${readable(first)} and ${readable(last)}`} · ${capture === "Capture date incomplete" ? `${memory.date} · ${capture}` : capture}`,
  };
}
export function buildChronology(memories: Memory[]) {
  const entries: ChronologyEntry[] = memories.map((memory) => ({
    memory,
    date: chronologyDate(memory),
  }));
  const ordered = entries
    .filter((entry) => entry.date.sortKey !== null)
    .sort((a, b) => a.date.sortKey!.localeCompare(b.date.sortKey!));
  return {
    entries,
    ordered,
    byId: new Map(entries.map((entry) => [entry.memory.id, entry])),
  };
}
