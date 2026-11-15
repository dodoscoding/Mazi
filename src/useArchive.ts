import { useCallback, useEffect, useRef, useState } from "react";
import { memories as samples } from "./memories";
import { isFeaturePath } from "./featureRoutes";
import type { Memory } from "./memories";
import { evidencePin } from "./memory/evidence";

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
  const groupRequest = useRef<AbortController | undefined>(undefined);
  const currentPath = useRef(path);
  currentPath.current = path;
  const [state, setState] = useState<ArchiveState>(empty);
  const [version, setVersion] = useState(0);
  const [archiveVersion, setArchiveVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const invalidate = () => {
      if (demo) return;
      groupRequest.current?.abort();
      setState((previous) => ({ ...previous, memories: [], atlas: false }));
      setArchiveVersion((value) => value + 1);
    };
    window.addEventListener("mazi:archive-changed", invalidate);
    return () => window.removeEventListener("mazi:archive-changed", invalidate);
  }, [demo]);
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
    let accessDenied = false;
    const lost = () => {
      accessDenied = true;
      controller?.abort();
      sessionStorage.removeItem("mazi.group");
      setState({ ...empty, status: "signed-out" });
    };
    async function load(quiet = false) {
      if (accessDenied) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      groupRequest.current = request;
      if (!quiet) setState(empty);
      try {
        const response = await fetch("/api/groups", {
          signal: request.signal,
        });
        if (request.signal.aborted) return;
        if (response.status === 403 || response.status === 401) {
          lost();
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
        if (!group) {
          lost();
          window.dispatchEvent(new Event("mazi:access-lost"));
          return;
        }
        if (group) sessionStorage.setItem("mazi.group", group);
        let refreshed: Memory[] | undefined;
        if (
          quiet &&
          !currentPath.current.startsWith("/memory/") &&
          !isFeaturePath(currentPath.current, demo)
        ) {
          const result = await fetch(
            "/api/atlas?" + new URLSearchParams({ group }),
            { signal: request.signal },
          );
          if (request.signal.aborted) return;
          if (result.status === 401 || result.status === 403) {
            lost();
            window.dispatchEvent(new Event("mazi:access-lost"));
            return;
          }
          if (!result.ok) throw Error("Archive unavailable");
          refreshed = ((await result.json()).memories as Memory[]).map(
            (memory) => ({ ...memory, place: evidencePin(memory) }),
          );
          if (request.signal.aborted) return;
        }
        setState((previous) =>
          quiet && previous.status === "ready" && previous.group === group
            ? {
                ...previous,
                groups,
                ...(refreshed ? { memories: refreshed, atlas: true } : {}),
              }
            : { ...empty, status: "ready", groups, group },
        );
      } catch (error) {
        if (!request.signal.aborted && !quiet) setState(failure(error));
      }
    }
    void load();
    const reload = () => void load();
    const visibility = () => {
      if (document.hidden) controller?.abort();
      else void load(true);
    };
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) visibility();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", pageShow);
    window.addEventListener("mazi:session", reload);
    window.addEventListener("mazi:group", reload);
    window.addEventListener("mazi:access-lost", lost);
    return () => {
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", pageShow);
      window.removeEventListener("mazi:session", reload);
      window.removeEventListener("mazi:group", reload);
      window.removeEventListener("mazi:access-lost", lost);
    };
  }, [demo, groupId, version]);
  const loadAtlas =
    !path.startsWith("/memory/") &&
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
        const { memories: received } = await result.json();
        const memories = (received as Memory[]).map((memory) => ({
          ...memory,
          place: evidencePin(memory),
        }));
        if (!request.signal.aborted)
          setState((previous) => ({ ...previous, memories, atlas: true }));
      } catch (error) {
        if (!request.signal.aborted) setState(failure(error));
      }
    })();
    return () => request.abort();
  }, [loadAtlas, group, archiveVersion]);
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
