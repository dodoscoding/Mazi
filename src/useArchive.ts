import { useCallback, useEffect, useState } from "react";
import { memories as samples } from "./memories";
import { isFeaturePath } from "./featureRoutes";
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
  const needsAtlas = !isFeaturePath(path, demo);
  useEffect(() => {
    if (!groupId) {
      setState(empty);
      return;
    }
    if (demo) {
      setState({ ...empty, status: "ready", memories: samples });
      return;
    }
    let controller: AbortController | undefined;
    let generation = 0;
    let accessDenied = false;
    const invalidate = () => {
      generation++;
      controller?.abort();
    };
    const lost = () => {
      accessDenied = true;
      invalidate();
      sessionStorage.removeItem("mazi.group");
      setState({ ...empty, status: "signed-out" });
    };
    const deny = () => {
      lost();
      window.dispatchEvent(new Event("mazi:access-lost"));
    };
    async function load(quiet = false) {
      const current = ++generation;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setState((previous) =>
        quiet && previous.status === "ready" && previous.group === groupId
          ? previous
          : empty,
      );
      if (document.hidden || accessDenied) return;
      try {
        const response = await fetch("/api/groups", {
          signal: request.signal,
        });
        if (current !== generation || request.signal.aborted) return;
        if (response.status === 403 || response.status === 401) {
          deny();
          return;
        }
        if (!response.ok)
          throw Error("Your archive could not load. Please retry.");
        const groups: Circle[] = await response.json();
        if (current !== generation || request.signal.aborted) return;
        const group = groups.find((item) => item.id === groupId)?.id || "";
        if (!group) {
          deny();
          return;
        }
        if (group) sessionStorage.setItem("mazi.group", group);
        let memories: Memory[] = [];
        if (group && needsAtlas) {
          const result = await fetch(
            "/api/atlas?" + new URLSearchParams({ group }),
            { signal: request.signal },
          );
          if (current !== generation || request.signal.aborted) return;
          if (result.status === 403 || result.status === 401) {
            deny();
            return;
          }
          if (!result.ok)
            throw Error(
              "Your archive changed or is unavailable. Refresh to check access.",
            );
          memories = (await result.json()).memories;
        }
        if (current === generation && !request.signal.aborted)
          setState({ status: "ready", groups, group, memories, error: "" });
      } catch (error) {
        if (current === generation && !request.signal.aborted)
          setState((previous) =>
            quiet && previous.status === "ready" && previous.group === groupId
              ? previous
              : {
                  ...empty,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Archive unavailable",
                },
          );
      }
    }
    void load();
    const visibility = () => {
      if (document.hidden) invalidate();
      else void load(true);
    };
    const reload = () => {
      void load();
    };
    const clear = () => {
      invalidate();
      setState(empty);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", visibility);
    window.addEventListener("mazi:session", reload);
    window.addEventListener("mazi:group", reload);
    window.addEventListener("mazi:access-lost", lost);
    return () => {
      generation++;
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", visibility);
      window.removeEventListener("mazi:session", reload);
      window.removeEventListener("mazi:group", reload);
      window.removeEventListener("mazi:access-lost", lost);
    };
  }, [needsAtlas, demo, groupId, version]);
  const chooseGroup = (id: string) => {
    sessionStorage.setItem("mazi.group", id);
    window.dispatchEvent(new Event("mazi:group"));
  };
  return { ...state, refresh, chooseGroup };
}
