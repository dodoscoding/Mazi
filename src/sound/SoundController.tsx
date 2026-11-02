import { useEffect, useRef, useState } from "react";
import { cuesFor } from "./cues";
import type { SoundRoute } from "./cues";
import { ambient, audioReady, play, resume, suspend, unlock } from "./engine";
import { useSound } from "./useSound";

/**
 * Turns route changes into sound, so the Atlas itself stays silent code.
 * The bed plays only on the Atlas; one-shots follow the portal and the selection.
 */
export function SoundController({
  route,
  reduced,
}: {
  route: SoundRoute;
  reduced: boolean;
}) {
  const { sound } = useSound();
  const on = sound === "on";
  const [ready, setReady] = useState(audioReady);
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // Sound remembered from an earlier visit waits for the first gesture.
  useEffect(() => {
    if (!on) return;
    if (audioReady()) {
      setReady(true);
      return;
    }
    const gesture = () => {
      unlock();
      setReady(audioReady());
    };
    const options = { capture: true, once: true } as const;
    addEventListener("pointerdown", gesture, options);
    addEventListener("keydown", gesture, options);
    return () => {
      removeEventListener("pointerdown", gesture, options);
      removeEventListener("keydown", gesture, options);
    };
  }, [on]);

  const live = on && ready && !hidden;
  useEffect(() => {
    if (!ready) return;
    if (live) resume();
    else {
      ambient(false, true);
      suspend();
    }
  }, [live, ready]);

  const atlas = route.path === "/atlas";
  useEffect(() => {
    if (live) ambient(atlas);
  }, [live, atlas]);

  const previous = useRef(route);
  const { path, portal, selected, year } = route;
  useEffect(() => {
    const next = { path, portal, selected, year };
    const cues = cuesFor(previous.current, next, reduced);
    previous.current = next;
    if (live) cues.forEach(play);
  }, [path, portal, selected, year, reduced, live]);

  return null;
}
