import { useCallback, useEffect, useState } from "react";
import { memories as samples } from "./memories";
import type { Memory } from "./memories";

type Circle = { id: string; name: string; role: string };
type ArchiveState = {
  status: "loading" | "ready" | "signed-out" | "error";
  groups: Circle[];
  group: string;
  memories: Memory[];
  error: string;
};
const empty: ArchiveState = {
  status: "loading",
  groups: [],
  group: "",
  memories: [],
  error: "",
};
export function useArchive(path: string, demo: boolean, groupId?: string) {
  const [state, setState] = useState<ArchiveState>(empty);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!groupId) {
      setState(empty);
      return;
    }
    if (demo) {
      setState({ ...empty, status: "ready", memories: samples });
      return;
    }
    const controller = new AbortController();
    let generation = 0;
    async function load() {
      const current = ++generation;
      setState(empty);
      if (document.hidden) return;
      try {
        const response = await fetch("/api/groups", {
          signal: controller.signal,
        });
        if (current !== generation || controller.signal.aborted) return;
        if (response.status === 403 || response.status === 401) {
          sessionStorage.removeItem("mazi.group");
          window.dispatchEvent(new Event("mazi:access-lost"));
          setState({ ...empty, status: "signed-out" });
          return;
        }
        if (!response.ok)
          throw Error("Your archive could not load. Please retry.");
        const groups: Circle[] = await response.json();
        if (current !== generation || controller.signal.aborted) return;
        const group = groups.find((item) => item.id === groupId)?.id || "";
        if (group) sessionStorage.setItem("mazi.group", group);
        let memories: Memory[] = [];
        if (group) {
          const result = await fetch(
            "/api/atlas?" + new URLSearchParams({ group }),
            { signal: controller.signal },
          );
          if (current !== generation || controller.signal.aborted) return;
          if (result.status === 403 || result.status === 401)
            window.dispatchEvent(new Event("mazi:access-lost"));
          if (!result.ok)
            throw Error(
              "Your archive changed or is unavailable. Refresh to check access.",
            );
          memories = (await result.json()).memories;
        }
        if (current === generation && !controller.signal.aborted)
          setState({ status: "ready", groups, group, memories, error: "" });
      } catch (error) {
        if (current === generation && !controller.signal.aborted)
          setState({
            ...empty,
            status: "error",
            error:
              error instanceof Error ? error.message : "Archive unavailable",
          });
      }
    }
    void load();
    const visibility = () => {
      void load();
    };
    const clear = () => {
      generation++;
      setState(empty);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", visibility);
    window.addEventListener("mazi:session", visibility);
    window.addEventListener("mazi:group", visibility);
    window.addEventListener("mazi:access-lost", clear);
    return () => {
      generation++;
      controller.abort();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", visibility);
      window.removeEventListener("mazi:session", visibility);
      window.removeEventListener("mazi:group", visibility);
      window.removeEventListener("mazi:access-lost", clear);
    };
  }, [path, demo, groupId, version]);
  const chooseGroup = (id: string) => {
    sessionStorage.setItem("mazi.group", id);
    window.dispatchEvent(new Event("mazi:group"));
  };
  return { ...state, refresh, chooseGroup };
}
