import { useEffect } from "react";

const IDLE_MS = 60_000;

// Hosts without an always-on worker advance queued archive work only when a
// signed-in tab asks; a server running its own worker answers mode "thread".
export function useWorkDrain(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let running = false;
    let kicked = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };
    async function tick() {
      if (stopped || document.hidden) return;
      if (running) {
        kicked = true;
        return;
      }
      running = true;
      kicked = false;
      let delay = IDLE_MS;
      try {
        const response = await fetch("/api/work", { method: "POST" });
        if (response.status === 404) stopped = true;
        else if (response.ok) {
          const value = await response.json();
          if (value.mode === "thread") stopped = true;
          else if (value.pending) delay = 0;
        }
      } catch {
        // Offline or interrupted: retry after the idle delay.
      } finally {
        running = false;
      }
      if (!stopped) schedule(kicked ? 0 : delay);
    }
    const kick = () => schedule(0);
    const visibility = () => {
      if (!document.hidden) kick();
    };
    window.addEventListener("mazi:work", kick);
    document.addEventListener("visibilitychange", visibility);
    kick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("mazi:work", kick);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active]);
}
