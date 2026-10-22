import type { Memory, PhotoProvenance } from "../memories";

export function provenanceOf(memory: Memory) {
  const evidence = new Map<string, PhotoProvenance>();
  for (const photo of memory.photos)
    for (const item of photo.provenance || [])
      evidence.set(JSON.stringify(item), item);
  return [...evidence.values()];
}

export function sourceSenders(memory: Memory) {
  return [
    ...new Set(
      provenanceOf(memory).flatMap((item) =>
        item.sender ? [item.sender] : [],
      ),
    ),
  ];
}

export function sourceSharedLine(memory: Memory) {
  const names = sourceSenders(memory);
  if (!names.length) return "";
  const label =
    names.length <= 2
      ? names.join(" and ")
      : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
  return `Shared by ${label}`;
}

export function shareDate(item: PhotoProvenance) {
  const { local, raw, ambiguous } = item.sharedAt;
  const day = local?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (day) {
    const date = new Date(Date.UTC(+day[1], +day[2] - 1, +day[3]));
    const text = new Intl.DateTimeFormat(
      typeof navigator === "undefined" ? "en" : navigator.language,
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      },
    ).format(date);
    return `Shared on ${text}`;
  }
  return raw
    ? `Shared on ${raw} · ${ambiguous ? "date order unclear" : "date unresolved"}`
    : "";
}

export function shareDateLabel(memory: Memory) {
  const dates = [
    ...new Set(provenanceOf(memory).map(shareDate).filter(Boolean)),
  ];
  const visible = dates.slice(0, 2).join(" · ");
  return dates.length > 2
    ? `${visible} · ${dates.length - 2} more share dates`
    : visible;
}
