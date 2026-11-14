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
  const active = useRef<{ path: string; controller: AbortController } | null>(
    null,
  );
  const request = useCallback(
    async (path: string, body?: object, retainReady = false) => {
      if (
        retainReady &&
        active.current &&
        active.current.path !== "/api/session"
      )
        return;
      const current = ++generation.current;
      active.current?.controller.abort();
      const abort = new AbortController();
      active.current = { path, controller: abort };
      if (path === "/api/session" || path === "/api/logout")
        setState((previous) =>
          retainReady && previous.status !== "loading"
            ? previous
            : { status: "loading" },
        );
      else setState((previous) => ({ ...previous, pending: true, error: "" }));
      const unavailable = (error: string) =>
        setState((previous) =>
          retainReady && previous.status !== "loading"
            ? previous
            : { status: "error", error },
        );
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
        if (current !== generation.current || abort.signal.aborted) return;
        if (
          path === "/api/session" &&
          (response.status === 401 || response.status === 403)
        ) {
          if (profile.current)
            window.dispatchEvent(new Event("mazi:access-lost"));
          else
            setState((previous) =>
              retainReady && previous.status === "signed-out"
                ? previous
                : { status: "signed-out", error: "" },
            );
          return false;
        }
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
            unavailable(message);
          else
            setState({
              status: "signed-out",
              error: path === "/api/session" ? "" : message,
            });
          return false;
        }
        if (path === "/api/logout") {
          profile.current = null;
          sessionStorage.removeItem("mazi.group");
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
        if (!retainReady || !sessionStorage.getItem("mazi.group"))
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
          else unavailable("Mazi could not connect. Please retry.");
        }
        return false;
      } finally {
        if (active.current?.controller === abort) active.current = null;
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
      active.current?.controller.abort();
      setState({ status: "loading" });
    };
    const lost = () => {
      accessLost.current = true;
      profile.current = null;
      sessionStorage.removeItem("mazi.group");
      clear();
      setState({
        status: "signed-out",
        error: "Your access changed. Enter again to check your circle.",
      });
    };
    const visibility = () => {
      if (accessLost.current) return;
      if (!document.hidden) void request("/api/session", undefined, true);
    };
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("mazi:session", refresh);
    window.addEventListener("mazi:access-lost", lost);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      generation.current++;
      active.current?.controller.abort();
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
