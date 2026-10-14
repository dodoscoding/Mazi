// Frame-time probe for the globe Atlas (PR 3).
// Usage: start the sample server (MAZI_IMPORT_PORT=5301 .venv/bin/python -m tests.browser.sample_server),
// then: node work/poteto/luminous-night/evidence/pr3/frame-probe.mjs [baseURL]
// Samples requestAnimationFrame deltas for 5 s while the globe idles (stars, packets on the lit arc)
// and while the year scrubber steps every 1.2 s (spring turn, lit-arc change, packet restart),
// at 1440x900 and at 390x844 with 4x CPU throttling, then reads the JS heap after 30 s.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:5301";
const out = new URL("./frame-probe-results.json", import.meta.url);

// Wraps requestAnimationFrame so each frame's script work (the R3F render loop included) is timed too.
const instrument = () => {
  const native = window.requestAnimationFrame.bind(window);
  window.__work = [];
  window.requestAnimationFrame = (callback) =>
    native((time) => {
      const start = performance.now();
      callback(time);
      if (!callback.probe) window.__work.push(performance.now() - start);
    });
};

const sample = (page, ms) =>
  page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const deltas = [];
        window.__work.length = 0;
        let last = performance.now();
        const end = last + duration;
        const tick = (now) => {
          deltas.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else resolve({ deltas, work: [...window.__work] });
        };
        tick.probe = true;
        requestAnimationFrame(tick);
      }),
    ms,
  );

function percentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    median: +at(0.5).toFixed(2),
    p95: +at(0.95).toFixed(2),
    max: +sorted[sorted.length - 1].toFixed(2),
  };
}

function stats({ deltas, work }) {
  const frame = percentiles(deltas);
  const script = percentiles(work);
  return {
    frames: deltas.length,
    frameMedianMs: frame.median,
    frameP95Ms: frame.p95,
    frameMaxMs: frame.max,
    scriptMedianMs: script.median,
    scriptP95Ms: script.p95,
  };
}

async function run(name, viewport, throttle) {
  // The full Chromium build in new headless mode draws WebGL on the GPU, unlike the headless shell.
  const browser = await chromium.launch({
    channel: "chromium",
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
  const phone = viewport.width <= 600;
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: phone ? 3 : 1,
    isMobile: phone,
    hasTouch: phone,
  });
  const page = await context.newPage();
  await page.request.post(base + "/api/entry", {
    data: { name: "Sample", code: "synthetic-shared-code" },
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("mazi.intro", "seen"),
  );
  await context.addInitScript(instrument);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.goto(base + "/?demo=1");
  await page.getByText("Drawing your atlas…").waitFor({ state: "detached" });
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector("canvas")?.getContext("webgl2");
    return gl ? String(gl.getParameter(gl.RENDERER)) : "no WebGL";
  });
  if (throttle > 1)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.waitForTimeout(2000);
  const started = Date.now();
  const idle = stats(await sample(page, 5000));
  const slider = page.getByRole("slider", { name: "Year" });
  await slider.focus();
  const keys = [
    "ArrowLeft",
    "ArrowLeft",
    "ArrowRight",
    "ArrowRight",
    "ArrowLeft",
  ];
  const stepping = (async () => {
    for (const key of keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(1000);
    }
  })();
  const scrub = stats(await sample(page, 5000));
  await stepping;
  await page.waitForTimeout(Math.max(0, 30000 - (Date.now() - started)));
  const { metrics } = await cdp.send("Performance.getMetrics");
  const heap =
    metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value || 0;
  await browser.close();
  return {
    name,
    viewport,
    cpuThrottle: throttle,
    renderer,
    idle,
    packetsAndScrub: scrub,
    jsHeapAfter30sMB: +(heap / 1048576).toFixed(1),
  };
}

const results = [
  await run("desktop", { width: 1440, height: 900 }, 1),
  await run("phone-4x", { width: 390, height: 844 }, 4),
];
writeFileSync(out, JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
