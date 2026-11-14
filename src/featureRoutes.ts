const featurePaths = [
  "/photos",
  "/add",
  "/imports",
  "/circle",
  "/settings",
  "/review",
  "/places",
  "/discover",
  "/answer-evidence",
  "/memories",
];

export function isFeaturePath(path: string, demo: boolean) {
  return featurePaths.includes(path) || (path === "/search" && !demo);
}
