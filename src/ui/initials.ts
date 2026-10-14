// Same rule as initials() in src/features/ui.js, which cannot import TypeScript.
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (
    words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
  ).toUpperCase();
}
