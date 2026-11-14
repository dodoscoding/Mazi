import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { flushSync } from "react-dom";

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
  if (path === "/ask") {
    if (!params.has("q") && params.has("question"))
      params.set("q", params.get("question")!);
    params.delete("question");
    params.delete("recap");
    params.set("retired", "answers");
    history.replaceState(history.state, "", `#/photos?${params}`);
    return readRoute();
  }
  let alias: string | undefined;
  const section = params.get("section");
  if (path === "/atlas") alias = "/";
  if (
    ["/timeline", "/memories", "/search", "/discover", "/explore"].includes(
      path,
    )
  )
    alias = "/photos";
  if (
    path === "/memories" &&
    (params.has("story") ||
      params.has("capsule") ||
      ["stories", "capsules"].includes(section || ""))
  ) {
    alias = "/past-creations";
    params.delete("section");
  } else if (path === "/memories" && section === "recap") {
    if (!params.has("recap") && /^\d{4}$/.test(params.get("year") || ""))
      params.set("recap", params.get("year")!);
  }
  if (["/search", "/discover"].includes(path)) params.set("search", "1");
  if (path === "/people" || (path === "/discover" && section === "people")) {
    alias = "/settings";
    params.set("unavailable", "people");
  }
  if (path === "/imports") alias = "/add";
  if (path === "/circle") {
    alias = "/settings";
    if (section === "plans" || params.has("plan"))
      params.set("unavailable", "plans");
    else params.set("section", "members");
  }
  if (path === "/about") alias = "/settings";
  if (path === "/places") {
    alias =
      section === "sources" ||
      params.has("code") ||
      params.has("error") ||
      new URLSearchParams(location.search).has("code") ||
      new URLSearchParams(location.search).has("error")
        ? "/add"
        : "/";
    if (alias === "/add") params.set("section", "sources");
  }
  if (path === "/review") {
    if (["export", "departure", "account"].includes(section || ""))
      alias = "/settings";
    else {
      alias = "/add";
      params.set("section", "suggestions");
    }
  }

  if (alias) {
    if (path === "/places")
      for (const key of ["code", "state", "error"]) params.delete(key);
    const [target, defaults] = alias.split("?");
    new URLSearchParams(defaults).forEach((value, key) =>
      params.set(key, value),
    );
    const canonical = target + (params.size ? `?${params}` : "");
    history.replaceState(history.state, "", `#${canonical}`);
    return readRoute();
  }
  return {
    path: path || "/",
    search: query ? `?${query}` : "",
    selected: params.get("selected") || "last-ferry",
    notebook: params.get("notebook") === "1",
    photo: params.has("photo") ? Number(params.get("photo")) : 0,
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
