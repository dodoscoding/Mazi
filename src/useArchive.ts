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
  /** `memories` hold the Atlas of `group`. */
  atlas: boolean;
  error: string;
};
const empty: ArchiveState = {
  status: "loading",
  groups: [],
  group: "",
  memories: [],
  atlas: false,
  error: "",
};
const failure = (error: unknown): ArchiveState => ({
  ...empty,
  status: "error",
  error: error instanceof Error ? error.message : "Archive unavailable",
});
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
      setState({ ...empty, status: "ready", memories: samples, atlas: true });
      return;
    }
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setState(empty);
      try {
        const response = await fetch("/api/groups", {
          signal: request.signal,
        });
        if (request.signal.aborted) return;
        if (response.status === 403 || response.status === 401) {
          sessionStorage.removeItem("mazi.group");
          window.dispatchEvent(new Event("mazi:access-lost"));
          setState({ ...empty, status: "signed-out" });
          return;
        }
        if (!response.ok)
          throw Error("Your archive could not load. Please retry.");
        const groups: Circle[] = await response.json();
        if (request.signal.aborted) return;
        const group =
          [sessionStorage.getItem("mazi.group"), groupId].find((id) =>
            groups.some((item) => item.id === id),
          ) || "";
        if (group) sessionStorage.setItem("mazi.group", group);
        setState({ ...empty, status: "ready", groups, group });
      } catch (error) {
        if (!request.signal.aborted) setState(failure(error));
      }
    }
    void load();
    const clear = () => {
      controller?.abort();
      setState(empty);
    };
    window.addEventListener("mazi:session", load);
    window.addEventListener("mazi:group", load);
    window.addEventListener("mazi:access-lost", clear);
    return () => {
      controller?.abort();
      window.removeEventListener("mazi:session", load);
      window.removeEventListener("mazi:group", load);
      window.removeEventListener("mazi:access-lost", clear);
    };
  }, [demo, groupId, version]);
  const loadAtlas =
    path !== "/parallel" &&
    path !== "/explore" &&
    path !== "/explore/parallel" &&
    !isFeaturePath(path, demo) &&
    state.status === "ready" &&
    !!state.group &&
    !state.atlas;
  const { group } = state;
  useEffect(() => {
    if (!loadAtlas) return;
    const request = new AbortController();
    void (async () => {
      try {
        const result = await fetch(
          "/api/atlas?" + new URLSearchParams({ group }),
          { signal: request.signal },
        );
        if (request.signal.aborted) return;
        if (result.status === 403 || result.status === 401) {
          window.dispatchEvent(new Event("mazi:access-lost"));
          return;
        }
        if (!result.ok)
          throw Error(
            "Your archive changed or is unavailable. Refresh to check access.",
          );
        const { memories } = await result.json();
        if (!request.signal.aborted)
          setState((previous) => ({ ...previous, memories, atlas: true }));
      } catch (error) {
        if (!request.signal.aborted) setState(failure(error));
      }
    })();
    return () => request.abort();
  }, [loadAtlas, group]);
  const chooseGroup = (id: string) => {
    sessionStorage.setItem("mazi.group", id);
    window.dispatchEvent(new Event("mazi:group"));
  };
  return {
    ...state,
    status: loadAtlas ? ("loading" as const) : state.status,
    refresh,
    chooseGroup,
  };
}
