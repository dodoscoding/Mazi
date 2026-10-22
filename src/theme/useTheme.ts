export type Theme = "night" | "day";

/** Mazi has one theme; `theme.js` pins night before first paint. */
export function useTheme(): { theme: Theme } {
  return { theme: "night" };
}
