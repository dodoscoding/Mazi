import { useCallback, useSyncExternalStore } from "react";

export type Sound = "on" | "off";

export const SOUND_KEY = "mazi.sound";
const listeners = new Set<() => void>();
let memory: Sound | null = null;

function read(): Sound {
  if (memory) return memory;
  try {
    return localStorage.getItem(SOUND_KEY) === "on" ? "on" : "off";
  } catch {
    return "off";
  }
}

export function currentSound(): Sound {
  return read();
}

export function setSound(sound: Sound) {
  memory = sound;
  try {
    localStorage.setItem(SOUND_KEY, sound);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice still holds for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const sync = (event: StorageEvent) => {
    if (event.key !== SOUND_KEY) return;
    memory = event.newValue === "on" ? "on" : "off";
    listeners.forEach((each) => each());
  };
  addEventListener("storage", sync);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", sync);
  };
}

export function useSound() {
  const sound = useSyncExternalStore(subscribe, read, () => "off" as const);
  const toggle = useCallback(
    () => setSound(read() === "on" ? "off" : "on"),
    [],
  );
  return { sound, toggle, setSound };
}
