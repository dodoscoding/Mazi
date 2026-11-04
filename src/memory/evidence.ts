import type { DateEvidence, Memory, Photo, Place } from "../memories.ts";

function dayLabel(day: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

export function evidenceDateLabel(date: DateEvidence) {
  if (date.status === "ambiguous") return "Gün ve ay belirsiz";
  if (!date.start) return "Tarih bilinmiyor";
  const dates =
    date.status === "conflict"
      ? date.days.map(dayLabel).join(" / ")
      : date.start === date.through
        ? dayLabel(date.start)
        : `${dayLabel(date.start)} – ${dayLabel(date.through!)}`;
  const basis =
    date.status === "conflict"
      ? "Çekim tarihi çelişkili"
      : date.basis === "capture"
        ? "Çekildi"
        : "Paylaşıldı";
  return `${date.status === "approximate" ? "Yaklaşık " : ""}${dates} · ${basis}${date.timezone === "UTC" ? " · UTC" : ""}`;
}

export function photoDateLabel(photo: Photo, memory?: Memory) {
  if (!photo.evidence) return memory?.date || "Tarih bilinmiyor";
  const { chronology, capture } = photo.evidence;
  const label = evidenceDateLabel(chronology);
  return chronology.basis === "shared" && capture.status === "unknown"
    ? `${label} · Çekim tarihi bilinmiyor`
    : label;
}

export function photoPlaceLabel(photo: Photo, memory?: Memory) {
  const place = photo.evidence?.place;
  if (!place)
    return memory?.place
      ? `${memory.place.name}, ${memory.place.country}`
      : "Yer bilinmiyor";
  if (place.status === "conflict") return "Yer çelişkili";
  if (place.status === "unmapped")
    return `${place.text} · Haritada işaretlenemiyor`;
  return place.text || "Yer bilinmiyor";
}

export function evidenceChronology(memory: Memory) {
  if (!memory.photos.length || !memory.photos.every((photo) => photo.evidence))
    return null;
  const dates = memory.photos.map((photo) => photo.evidence!.chronology);
  const known = dates.filter((date) => date.start);
  if (!known.length)
    return {
      basis: "unknown" as const,
      year: null,
      sortKey: null,
      label: dates.some((date) => date.status === "ambiguous")
        ? "Gün ve ay belirsiz"
        : "Tarih bilinmiyor",
    };
  const days = known.flatMap((date) => [date.start!, date.through!]).sort();
  const first = days[0],
    last = days[days.length - 1];
  const basis = known.every((date) => date.basis === "shared")
    ? ("shared" as const)
    : ("capture" as const);
  const label =
    memory.photos.length === 1
      ? photoDateLabel(memory.photos[0])
      : `${first === last ? dayLabel(first) : `${dayLabel(first)} – ${dayLabel(last)}`} · ${
          known.some((date) => date.status === "conflict")
            ? "Çekim tarihi çelişkili"
            : known.every((date) => date.basis === "capture")
              ? "Çekildi"
              : basis === "shared"
                ? "Paylaşıldı"
                : "Çekim ve paylaşım tarihleri"
        }${known.some((date) => date.timezone === "UTC") ? " · UTC" : ""}${known.length < dates.length ? " · Bazı tarihler bilinmiyor" : ""}`;
  return { basis, year: Number(first.slice(0, 4)), sortKey: first, label };
}

export function evidencePlaceLabel(memory: Memory) {
  if (!memory.photos.length || !memory.photos.every((photo) => photo.evidence))
    return null;
  const places = memory.photos.map((photo) => photo.evidence!.place);
  const names = new Set(
    places.flatMap((place) =>
      place.pin ? [pinIdentity(place.pin)] : place.text ? [place.text] : [],
    ),
  );
  if (places.some((place) => place.status === "conflict"))
    return "Yer çelişkili";
  if (names.size > 1) return "Birden fazla yer";
  if (!names.size) return "Yer bilinmiyor";
  const label = photoPlaceLabel(
    memory.photos.find((photo) => photo.evidence!.place.text)!,
  );
  return `${label}${places.some((place) => place.status === "unknown") ? " · Bazı yerler bilinmiyor" : ""}`;
}

export function evidencePin(memory: Memory): Place | null {
  if (!memory.photos.every((photo) => photo.evidence)) return memory.place;
  const pins = memory.photos.map((photo) => photo.evidence!.place.pin);
  const first = pins[0];
  return first &&
    pins.every((pin) => pin !== null && pinIdentity(pin) === pinIdentity(first))
    ? first
    : null;
}

export function pinIdentity(place: Place) {
  return `${place.country}:${place.name}:${place.latitude}:${place.longitude}`;
}
