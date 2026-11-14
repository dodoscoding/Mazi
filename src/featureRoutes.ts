const featurePaths = [
  "/add",
  "/imports",
  "/circle",
  "/review",
  "/places",
  "/discover",
  "/ask",
  "/answer-evidence",
  "/memories",
];

export function isFeaturePath(path: string, demo: boolean) {
  return featurePaths.includes(path) || (path === "/search" && !demo);
}
