import type { IconName } from "./ui/icons";
export type MainSection = "globe" | "photos" | "add" | "settings";
type PrimaryDestination = {
  section: MainSection;
  path: string;
  label: string;
  icon: IconName;
};
export const primaryDestinations: readonly PrimaryDestination[] = [
  { section: "globe", path: "/", label: "Globe", icon: "globe" },
  { section: "photos", path: "/photos", label: "Photos", icon: "image" },
  { section: "add", path: "/add", label: "Add", icon: "plus" },
  {
    section: "settings",
    path: "/settings",
    label: "Settings",
    icon: "settings",
  },
];
export const isGlobePath = (path: string) => path === "/" || path === "/atlas";
export function sectionFor(url: string): MainSection | undefined {
  const path = url.split("?")[0];
  if (isGlobePath(path)) return "globe";
  if (path === "/photos" || path.startsWith("/memory/")) return "photos";
  if (path === "/add") return "add";
  if (["/settings", "/past-creations", "/introduction"].includes(path))
    return "settings";
}
