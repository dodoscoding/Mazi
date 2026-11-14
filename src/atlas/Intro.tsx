import { useEffect, useRef } from "react";
import { readRoute } from "../useRoute";

export const INTRO_KEY = "mazi.intro";
export const INTRO_MS = 4200;
export const INTRO_REDUCED_MS = 1800;

let decided: boolean | undefined;

/**
 * True on the first Atlas mount of a browser session; marks the session as introduced.
 * The answer is kept until the intro finishes so a remount (or Strict Mode) agrees with it.
 */
export function claimIntro() {
  if (decided !== undefined) return decided;
  try {
    decided = !sessionStorage.getItem(INTRO_KEY);
    sessionStorage.setItem(INTRO_KEY, "seen");
  } catch {
    // Without session storage the intro would replay on every visit, so skip it.
    decided = false;
  }
  return decided;
}

export function finishIntro() {
  decided = false;
}

/**
 * The first-visit title sequence over the rising globe. The globe's own beats run in
 * the scene from the same start time; this layer holds the title, wipe line and skip.
 */
export function Intro({
  kicker,
  summary,
  reduced,
  onDone,
}: {
  kicker: string;
  summary: string;
  reduced: boolean;
  /** Called once; `skipped` is true when a key, tap or the Skip button ended it early. */
  onDone: (skipped: boolean) => void;
}) {
  const done = useRef((skipped = true) => {
    finishIntro();
    onDone(skipped);
  });
  useEffect(() => {
    const timer = setTimeout(
      () => done.current(false),
      reduced ? INTRO_REDUCED_MS : INTRO_MS,
    );
    // Any key or tap skips. Esc and Enter on the page itself are consumed so they do
    // not also act on the atlas; on a control they keep their usual meaning.
    const key = (event: KeyboardEvent) => {
      const onControl =
        event.target instanceof Element &&
        !!event.target.closest("a, button, input, select, textarea, [role]");
      if ((event.key === "Escape" || event.key === "Enter") && !onControl) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      done.current();
    };
    const tap = () => done.current();
    addEventListener("keydown", key, true);
    addEventListener("pointerdown", tap, true);
    return () => {
      clearTimeout(timer);
      removeEventListener("keydown", key, true);
      removeEventListener("pointerdown", tap, true);
      // Leaving the atlas mid-intro still counts as seeing it, so the return visit does
      // not replay it. A remount on the atlas itself (data arriving) keeps the claim.
      if (readRoute().path !== "/") finishIntro();
    };
  }, [reduced]);
  return (
    <div className={`atlas-intro ${reduced ? "is-reduced" : ""}`}>
      <div className="intro-title" aria-hidden="true">
        <p className="hud-label intro-kicker">{kicker}</p>
        <p className="intro-heading">
          <span className="intro-line">Bizim</span>{" "}
          <em className="intro-line">Atlas’ımız</em>
        </p>
        <span className="intro-wipe">
          <i />
        </span>
        <p className="intro-summary">{summary}</p>
      </div>
      <button
        type="button"
        className="button button--secondary intro-skip"
        onClick={() => done.current()}
      >
        Tanıtımı atla <kbd aria-hidden="true">Esc</kbd>
      </button>
    </div>
  );
}
