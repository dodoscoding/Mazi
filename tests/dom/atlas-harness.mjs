import assert from "node:assert/strict";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export async function atlasHarness(
  t,
  { fetch, loadGlobe, readyState = "complete" } = {},
) {
  const window = new Window({ url: "http://localhost/" });
  const saved = new Map();
  const intersections = [];
  const restore = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  };
  for (const name of ["window", "document", "location", "HTMLElement", "Event"])
    restore(name, name === "window" ? window : window[name]);
  restore("addEventListener", window.addEventListener.bind(window));
  restore("removeEventListener", window.removeEventListener.bind(window));
  restore("fetch", fetch ?? (async () => new Response(null, { status: 503 })));
  restore("IS_REACT_ACT_ENVIRONMENT", true);
  restore(
    "IntersectionObserver",
    class {
      constructor(callback) {
        this.callback = callback;
        intersections.push(this);
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
    },
  );
  restore(
    "ResizeObserver",
    class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width: 720, height: 360 } }]);
      }
      disconnect() {}
    },
  );
  Object.defineProperty(window.document, "readyState", {
    configurable: true,
    value: readyState,
  });
  Object.defineProperty(window.document, "hidden", {
    configurable: true,
    value: false,
    writable: true,
  });
  window.HTMLCanvasElement.prototype.getContext = () => ({
    fillRect() {},
    beginPath() {},
    lineTo() {},
    moveTo() {},
    closePath() {},
    fill() {},
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(1024 * 512 * 4) }),
  });
  const scene = { calls: 0, props: null, mounts: 0 };
  function Globe(props) {
    scene.props = props;
    useEffect(() => {
      scene.mounts++;
      props.onReady();
    }, []);
    return createElement("div", {
      "data-testid": "globe",
      "data-land": !!props.land,
    });
  }
  restore("__atlasTestLoadGlobe", () => {
    scene.calls++;
    return loadGlobe
      ? loadGlobe({ default: Globe })
      : Promise.resolve({ default: Globe });
  });
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [
      {
        name: "atlas-resource-test-boundary",
        transform(source, id) {
          if (!id.endsWith("/src/atlas/AtlasStage.tsx")) return;
          const seam = /import\(["']\.\/Globe["']\)/g;
          assert.equal(
            [...source.matchAll(seam)].length,
            1,
            "one dynamic chunk boundary",
          );
          return source.replace(seam, "globalThis.__atlasTestLoadGlobe()");
        },
      },
    ],
  });
  const host = window.document.createElement("main");
  window.document.body.append(host);
  const root = createRoot(host, { onCaughtError() {} });
  const { AtlasStage } = await server.ssrLoadModule(
    "/src/atlas/AtlasStage.tsx",
  );
  const failures = [];
  const views = [];
  const picks = [];
  let props = {
    atlas: { places: [], journeys: [], years: [] },
    selectedPlace: null,
    focusPlace: null,
    year: null,
    day: false,
    reduced: false,
    layout: "wide",
    portal: false,
    introStart: null,
    born: {},
    thumbnails: {},
    view: "globe",
    onView: (view) => {
      views.push(view);
    },
    onPick: (id) => {
      picks.push(id);
    },
    onFailedChange: (failed) => {
      failures.push(failed);
    },
    retryKey: 0,
  };
  let mounted = false;
  async function render(changes = {}) {
    props = { ...props, ...changes };
    await act(async () => {
      root.render(createElement(AtlasStage, props));
    });
    mounted = true;
  }
  async function unmount() {
    if (mounted) {
      await act(async () => root.unmount());
      mounted = false;
    }
  }
  t.after(async () => {
    await unmount();
    window.happyDOM.abort();
    await server.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return {
    window,
    host,
    scene,
    failures,
    views,
    picks,
    render,
    unmount,
    intersections,
    server,
    click: async (element) => act(async () => element.click()),
    flush: async (callback = () => {}) =>
      act(async () => {
        await callback();
      }),
    $: (selector) => host.querySelector(selector),
  };
}
