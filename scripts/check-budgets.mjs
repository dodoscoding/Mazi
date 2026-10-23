import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Gzip byte ceilings for the release build; see docs/PERFORMANCE_BUDGETS.md.
const budgets = [
  { name: "Globe chunk", pattern: /^Globe-.*\.js$/, max: 256 * 1024 },
  { name: "Entry script", pattern: /^index-.*\.js$/, max: 150 * 1024 },
  { name: "Stylesheet", pattern: /^index-.*\.css$/, max: 40 * 1024 },
  { name: "All scripts", pattern: /\.js$/, max: 400 * 1024, total: true },
];

const files = readdirSync("dist/assets").map((name) => ({
  name,
  gzip: gzipSync(readFileSync(`dist/assets/${name}`), { level: 9 }).length,
}));
let failed = false;
for (const budget of budgets) {
  const matched = files.filter((file) => budget.pattern.test(file.name));
  if (!matched.length) {
    console.error(`${budget.name}: no file matches ${budget.pattern}`);
    failed = true;
    continue;
  }
  const sizes = budget.total
    ? [matched.reduce((sum, file) => sum + file.gzip, 0)]
    : matched.map((file) => file.gzip);
  for (const size of sizes) {
    const ok = size <= budget.max;
    failed ||= !ok;
    console.log(
      `${ok ? "ok  " : "OVER"} ${budget.name}: ${(size / 1024).toFixed(1)} KiB gzip / ${budget.max / 1024} KiB`,
    );
  }
}
process.exit(failed ? 1 : 0);
