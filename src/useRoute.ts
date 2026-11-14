import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { flushSync } from "react-dom";
import { routeAliases } from "./navigation";
export type Route = ReturnType<typeof readRoute>;
export type LinkFor = (
  url: string,
  animate?: boolean,
  replace?: boolean,
) => (event: MouseEvent<HTMLAnchorElement>) => void;
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
export function readRoute() {
  const [path, query] = (
    location.hash.startsWith("#/")
      ? location.hash.slice(1)
      : location.pathname + location.search
  ).split("?");
  const params = new URLSearchParams(query);
  const alias = routeAliases[path];
  if (alias) {
    const [target, defaults] = alias.split("?");
    new URLSearchParams(defaults).forEach((value, key) =>
      params.set(key, value),
    );
    const canonical = `${target}?${params}`;
    history.replaceState(history.state, "", `#${canonical}`);
    return readRoute();
  }
  return {
    path:
      path === "/" &&
      (params.has("selected") || params.get("view") === "portal")
        ? "/atlas"
        : path || "/",
    search: query ? `?${query}` : "",
    selected: params.get("selected") || "last-ferry",
    notebook: params.get("notebook") === "1",
    photo: Math.max(0, Number(params.get("photo")) || 0),
  };
}
let activeTransition: ViewTransition | undefined;
let navigationVersion = 0;
/** How many in-app history entries precede the current one. */
let depth = -1;
function syncEntry() {
  const known = history.state?.depth;
  if (typeof known === "number") depth = known;
  else {
    // The first load, or an entry a plain hash link created.
    depth += 1;
    history.replaceState({ ...history.state, depth }, "");
  }
}
export const canGoBack = () => (history.state?.depth ?? 0) > 0;
export function useRoute(reduced: boolean) {
  const [route, setRoute] = useState(() => {
    syncEntry();
    return readRoute();
  });
  useEffect(() => {
    const update = () => {
      syncEntry();
      navigationVersion++;
      activeTransition?.skipTransition();
      setRoute(readRoute());
    };
    addEventListener("popstate", update);
    addEventListener("hashchange", update);
    return () => {
      removeEventListener("popstate", update);
      removeEventListener("hashchange", update);
    };
  }, []);
  useEffect(() => {
    if (reduced) activeTransition?.skipTransition();
  }, [reduced]);
  const navigate = useCallback(
    (url: string, animate = false, replace = false) => {
      activeTransition?.skipTransition();
      const version = ++navigationVersion;
      if (replace)
        history.replaceState({ ...history.state, depth }, "", `#${url}`);
      else history.pushState({ depth: ++depth }, "", `#${url}`);
      const update = () => {
        if (version === navigationVersion)
          flushSync(() => setRoute(readRoute()));
      };
      if (animate && !reduced && document.startViewTransition) {
        activeTransition = document.startViewTransition(update);
        void activeTransition.finished.catch(() => {});
        void activeTransition.ready.catch(() => {});
        void activeTransition.updateCallbackDone.catch(() => {});
      } else update();
    },
    [reduced],
  );
  return { route, navigate };
}
