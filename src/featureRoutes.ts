const featurePaths = ["/photos", "/add", "/settings", "/answer-evidence"];
export function isFeaturePath(path: string, _demo: boolean) {
  return featurePaths.includes(path);
}
