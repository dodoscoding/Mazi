// Measures WCAG contrast of HUD text drawn over the globe and the flat map.
// For each label it screenshots the page with and without the glyphs, takes the pixels
// that change as the glyph mask, and compares the text colour with every background pixel
// in a 2 px ring around the glyphs (the minimum is reported) and in the whole text box.
// Usage: MAZI_IMPORT_PORT=5312 .venv/bin/python -m tests.browser.sample_server, then
// node work/poteto/luminous-night/evidence/pr3/contrast-probe.mjs [baseURL]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:5312";
const targets = [
  ".readout-year",
  ".readout-summary",
  ".globe-label > span",
  ".scrubber-years span",
  ".atlas-hints span",
  ".flat-label",
  ".atlas-index .index-name",
  ".atlas-index .index-meta",
];
const scenarios = [];
for (const theme of ["night", "day"])
  for (const [size, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["phone", { width: 390, height: 844 }],
  ])
    for (const view of ["globe", "flat"])
      scenarios.push({ theme, size, viewport, view });

const browser = await chromium.launch({
  channel: "chromium",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const results = [];
for (const { theme, size, viewport, view } of scenarios) {
  const phone = size === "phone";
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.request.post(base + "/api/entry", {
    data: { name: "Sample", code: "synthetic-shared-code" },
  });
  await context.addInitScript((value) => {
    localStorage.setItem("mazi.theme", value);
    sessionStorage.setItem("mazi.intro", "seen");
  }, theme);
  await page.goto(base + "/?demo=1" + (view === "flat" ? "&scene=off" : ""));
  await page.waitForTimeout(3000);
  // Hover a second place so a focused label and the preview state are measured too.
  if (!phone && view === "globe")
    await page
      .getByRole("navigation", { name: "Places and moments" })
      .getByRole("button", { name: /^Bohinj/ })
      .hover();
  await page.waitForTimeout(1500);
  const boxes = await page.evaluate((selectors) => {
    const list = [];
    for (const selector of selectors)
      document.querySelectorAll(selector).forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        let opacity = 1;
        for (let node = element; node; node = node.parentElement)
          opacity *= Number(getComputedStyle(node).opacity);
        if (!rect.width || opacity < 0.5 || style.visibility === "hidden")
          return;
        if (
          rect.right < 0 ||
          rect.bottom < 0 ||
          rect.left > innerWidth ||
          rect.top > innerHeight
        )
          return;
        list.push({
          selector,
          index,
          text: element.textContent.trim().slice(0, 24),
          color: element instanceof SVGElement ? style.fill : style.color,
          fontPx:
            parseFloat(style.fontSize) *
            (element instanceof SVGElement ? element.getScreenCTM().a : 1),
          x: Math.floor(rect.left),
          y: Math.floor(rect.top),
          w: Math.ceil(rect.width),
          h: Math.ceil(rect.height),
        });
      });
    return list;
  }, targets);
  const shown = await page.screenshot({ type: "png" });
  await page.addStyleTag({
    content: `${targets.join(",")} { color: transparent !important; -webkit-text-fill-color: transparent !important; fill: transparent !important; }`,
  });
  await page.waitForTimeout(400);
  const hidden = await page.screenshot({ type: "png" });
  const analysis = await page.evaluate(
    async ({ shown, hidden, boxes }) => {
      const load = async (b64) => {
        const image = new Image();
        image.src = "data:image/png;base64," + b64;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
      };
      const a = await load(shown);
      const b = await load(hidden);
      const linear = (c) => {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (r, g, bl) =>
        0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(bl);
      const ratio = (l1, l2) =>
        (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const scale = a.width / innerWidth;
      return boxes.map((box) => {
        const [r, g, bl] = box.color.match(/[\d.]+/g).map(Number);
        const text = luminance(r, g, bl);
        const x0 = Math.max(0, Math.round(box.x * scale) - 2);
        const y0 = Math.max(0, Math.round(box.y * scale) - 2);
        const x1 = Math.min(a.width, Math.round((box.x + box.w) * scale) + 2);
        const y1 = Math.min(a.height, Math.round((box.y + box.h) * scale) + 2);
        const w = x1 - x0;
        const mask = new Uint8Array(w * (y1 - y0));
        const at = (x, y) => (y * a.width + x) * 4;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const i = at(x, y);
            const d =
              Math.abs(a.data[i] - b.data[i]) +
              Math.abs(a.data[i + 1] - b.data[i + 1]) +
              Math.abs(a.data[i + 2] - b.data[i + 2]);
            if (d > 60) mask[(y - y0) * w + (x - x0)] = 1;
          }
        let ringMin = Infinity;
        let boxMin = Infinity;
        const ring = 2 * Math.round(scale);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            if (mask[(y - y0) * w + (x - x0)]) continue;
            const i = at(x, y);
            const c = ratio(
              text,
              luminance(b.data[i], b.data[i + 1], b.data[i + 2]),
            );
            boxMin = Math.min(boxMin, c);
            let near = false;
            for (let dy = -ring; dy <= ring && !near; dy++)
              for (let dx = -ring; dx <= ring && !near; dx++) {
                const yy = y + dy - y0;
                const xx = x + dx - x0;
                if (
                  yy >= 0 &&
                  xx >= 0 &&
                  yy < y1 - y0 &&
                  xx < w &&
                  mask[yy * w + xx]
                )
                  near = true;
              }
            if (near) ringMin = Math.min(ringMin, c);
          }
        const large = box.fontPx >= 24;
        return {
          label: `${box.selector} "${box.text}"`,
          fontPx: +box.fontPx.toFixed(1),
          required: large ? 3 : 4.5,
          ringMin: +ringMin.toFixed(2),
          boxMin: +boxMin.toFixed(2),
          pass: ringMin >= (large ? 3 : 4.5),
        };
      });
    },
    {
      shown: shown.toString("base64"),
      hidden: hidden.toString("base64"),
      boxes,
    },
  );
  results.push({ theme, size, view, labels: analysis });
  await context.close();
}
await browser.close();
writeFileSync(
  new URL("./contrast-results.json", import.meta.url),
  JSON.stringify(results, null, 2) + "\n",
);
for (const result of results) {
  const worst = result.labels.reduce(
    (low, label) =>
      label.ringMin / label.required < low.ringMin / low.required ? label : low,
    result.labels[0],
  );
  const failing = result.labels.filter((label) => !label.pass);
  console.log(
    `${result.theme} ${result.size} ${result.view}: ${result.labels.length} labels, ${failing.length} below AA; tightest ${worst.label} ${worst.ringMin}:1 (needs ${worst.required})`,
  );
  for (const label of failing)
    console.log("   FAIL", label.label, label.ringMin, "box", label.boxMin);
}
