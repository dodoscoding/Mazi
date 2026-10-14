import { useSyncExternalStore } from "react";
import type { Layout } from "./Globe";

const queries: [Layout, string][] = [
  ["phone", "(max-width: 600px)"],
  ["tablet", "(max-width: 800px)"],
  ["medium", "(max-width: 1150px)"],
];

function current(): Layout {
  for (const [layout, query] of queries)
    if (matchMedia(query).matches) return layout;
  return "wide";
}

function subscribe(listener: () => void) {
  const lists = queries.map(([, query]) => matchMedia(query));
  lists.forEach((list) => list.addEventListener("change", listener));
  return () =>
    lists.forEach((list) => list.removeEventListener("change", listener));
}

/** The Responsive sheet's four widths: 1600+/1440, 1150, 800 and 390. */
export function useLayout() {
  return useSyncExternalStore(subscribe, current, () => "wide" as Layout);
}
