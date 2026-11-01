export type Cue = "dive" | "back" | "chime" | "tick";

export type SoundRoute = {
  path: string;
  portal: boolean;
  selected: string | undefined;
  year: number | null | undefined;
};

/** The one-shot sounds a route change asks for. The ambient bed follows `path` on its own. */
export function cuesFor(
  previous: SoundRoute,
  next: SoundRoute,
  reduced: boolean,
): Cue[] {
  if (next.path !== "/atlas" || previous.path !== "/atlas") return [];
  const cues: Cue[] = [];
  if (next.portal !== previous.portal) {
    // Under reduced motion the dive is a crossfade, so it gets no whoosh either.
    if (!reduced) cues.push(next.portal ? "dive" : "back");
    return cues;
  }
  // A memory that arrives with the archive is not a choice the member made.
  if (
    !previous.selected ||
    !next.selected ||
    previous.selected === next.selected
  )
    return cues;
  // A new year already says the selection moved; one sound per step stays quiet.
  if (next.year !== previous.year && next.year != null && previous.year != null)
    cues.push("tick");
  else cues.push("chime");
  return cues;
}
