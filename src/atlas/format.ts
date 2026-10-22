import { shareDateLabel } from "../memory/provenance";
import type { Memory } from "../memories";

let regions: Intl.DisplayNames | undefined;

export function countryName(code: string) {
  try {
    regions ??= new Intl.DisplayNames([navigator.language], { type: "region" });
    return regions.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

const undated = (memory: Memory) =>
  memory.year === null && !/\d{4}/.test(memory.date);

const iso = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(value: string) {
  const match = iso.exec(value.trim());
  return match
    ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]))
    : undefined;
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat(navigator.language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat(navigator.language, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** The archive's date label made readable: ISO days become "Sun 14 Aug 2023". */
export function longDate(memory: Memory) {
  if (undated(memory)) return shareDateLabel(memory) || memory.date;
  const [label, note] = memory.date.split(" · ");
  const days = label.split(" to ").map((part) => parse(part));
  let text = label;
  if (days.every(Boolean))
    text = days.map((day) => formatDay(day!)).join(" to ");
  if (note) text += ` · ${note}`;
  return memory.approximate && !undated(memory) && !/^about /i.test(text)
    ? `About ${text}`
    : text;
}

/** A short month label for index rows, "Aug 2023" or "About Aug 2023". */
export function shortDate(memory: Memory) {
  const first = parse(memory.date.split(" · ")[0].split(" to ")[0]);
  if (undated(memory)) return shareDateLabel(memory) || "No date";
  const text = first ? formatMonth(first) : memory.date.split(" · ")[0];
  return memory.approximate && !/^about /i.test(text) ? `About ${text}` : text;
}

export function placeLabel(memory: Memory) {
  return memory.place
    ? `${memory.place.name}, ${countryName(memory.place.country)}`
    : "No place recorded";
}

export function coordinates(memory: Memory) {
  if (!memory.place) return "";
  const { latitude, longitude } = memory.place;
  return `${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? "N" : "S"} · ${Math.abs(longitude).toFixed(2)}° ${longitude >= 0 ? "E" : "W"}`;
}

const sourceNames: Record<string, string> = {
  apple: "Apple Photos",
  whatsapp: "WhatsApp",
  discord: "Discord",
  messenger: "Messenger",
  archive: "Shared archive",
};

export function sourceName(source: string) {
  return (
    sourceNames[source.toLowerCase()] ||
    source.charAt(0).toUpperCase() + source.slice(1)
  );
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function listNames(names: string[]) {
  try {
    return new Intl.ListFormat(navigator.language, {
      style: "long",
      type: "conjunction",
    }).format(names);
  } catch {
    return names.join(", ");
  }
}
