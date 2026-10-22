import { useCallback, useEffect, useRef, useState } from "react";
export type Profile = {
  user_id: string;
  display_name: string;
  group_id: string;
  introduced: boolean;
};
type EntryState = (
  | { status: "loading" }
  | { status: "signed-out"; error: string }
  | { status: "error"; error: string }
  | { status: "onboarding" | "ready"; profile: Profile }
) & { pending?: boolean; error?: string };
export function useEntry() {
  const [state, setState] = useState<EntryState>({ status: "loading" });
  const generation = useRef(0);
  const accessLost = useRef(false);
  const profile = useRef<Profile | null>(null);
  const controller = useRef<AbortController | null>(null);
  const request = useCallback(
    async (path: string, body?: object, retainReady = false) => {
      const current = ++generation.current;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      if (path === "/api/session" || path === "/api/logout")
        setState((previous) =>
          retainReady && previous.status === "ready"
            ? previous
            : { status: "loading" },
        );
      else setState((previous) => ({ ...previous, pending: true, error: "" }));
      try {
        const response = await fetch(path, {
          signal: abort.signal,
          ...(body
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            : {}),
        });
        const value = await response.json();
        if (current !== generation.current || abort.signal.aborted) return;
        if (!response.ok) {
          const message = value.error || "Entry unavailable. Please retry.";
          if (path === "/api/introduction/complete" && response.status !== 403)
            setState((previous) => ({
              ...previous,
              pending: false,
              error: message,
            }));
          else if (
            path === "/api/session" &&
            response.status !== 403 &&
            response.status !== 401
          )
            setState({ status: "error", error: message });
          else
            setState({
              status: "signed-out",
              error: path === "/api/session" ? "" : message,
            });
          return false;
        }
        if (path === "/api/logout") {
          setState({ status: "signed-out", error: "" });
          return true;
        }
        if (
          retainReady &&
          profile.current &&
          (profile.current.user_id !== value.user_id ||
            profile.current.group_id !== value.group_id)
        ) {
          window.dispatchEvent(new Event("mazi:access-lost"));
          return false;
        }
        accessLost.current = false;
        profile.current = value;
        sessionStorage.setItem("mazi.group", value.group_id);
        setState({
          status: value.introduced ? "ready" : "onboarding",
          profile: value,
        });
        return true;
      } catch {
        if (current === generation.current && !abort.signal.aborted) {
          if (path === "/api/introduction/complete")
            setState((previous) => ({
              ...previous,
              pending: false,
              error: "Mazi could not connect. Please retry.",
            }));
          else
            setState({
              status: "error",
              error: "Mazi could not connect. Please retry.",
            });
        }
        return false;
      }
    },
    [],
  );
  const refresh = useCallback(() => {
    void request("/api/session");
  }, [request]);
  useEffect(() => {
    refresh();
    const clear = () => {
      generation.current++;
      controller.current?.abort();
      setState({ status: "loading" });
    };
    const lost = () => {
      accessLost.current = true;
      clear();
      setState({
        status: "signed-out",
        error: "Your access changed. Enter again to check your circle.",
      });
    };
    const visibility = () => {
      if (accessLost.current) return;
      const path = location.hash.split("?")[0];
      const retainImport = path === "#/imports" || path === "#/circle";
      if (document.hidden) {
        if (!retainImport) clear();
      } else if (retainImport) void request("/api/session", undefined, true);
      else refresh();
    };
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("mazi:session", refresh);
    window.addEventListener("mazi:access-lost", lost);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      generation.current++;
      controller.current?.abort();
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("mazi:session", refresh);
      window.removeEventListener("mazi:access-lost", lost);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh, request]);
  return {
    state,
    refresh,
    enter: (name: string, code: string) =>
      request("/api/entry", { name, code }),
    complete: () => request("/api/introduction/complete", {}),
    logout: () => request("/api/logout", {}),
  };
}
