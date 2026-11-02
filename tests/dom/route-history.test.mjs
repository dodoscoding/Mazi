import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";

async function harness(t, url) {
  const window = new Window({ url });
  const saved = new Map();
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    location: window.location,
    history: window.history,
    matchMedia: window.matchMedia.bind(window),
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const { useRoute, canGoBack } = await vite.ssrLoadModule("/src/useRoute.ts");
  let current;
  function Probe() {
    current = useRoute(true);
    return null;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  t.after(async () => {
    await act(async () => root.unmount());
    await vite.close();
    window.happyDOM.abort();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  await act(async () => root.render(createElement(Probe)));
  return {
    window,
    canGoBack,
    get route() {
      return current.route;
    },
    navigate: (...args) => act(async () => current.navigate(...args)),
  };
}

test("a memory opened by a direct link has no in-app entry to go back to", async (t) => {
  const h = await harness(t, "http://localhost/#/memory/a");
  assert.equal(h.route.path, "/memory/a");
  assert.equal(h.canGoBack(), false);
  await h.navigate("/memory/a?photo=1", false, true);
  assert.equal(h.canGoBack(), false);
});

test("a memory opened from inside the app can go back, across photo changes", async (t) => {
  const h = await harness(t, "http://localhost/#/");
  await h.navigate("/timeline");
  await h.navigate("/memory/a");
  assert.equal(h.canGoBack(), true);
  await h.navigate("/memory/a?photo=2", false, true);
  assert.equal(h.canGoBack(), true);
});

test("a plain hash link from a feature page counts as an in-app entry", async (t) => {
  const h = await harness(t, "http://localhost/#/search");
  assert.equal(h.canGoBack(), false);
  await act(async () => {
    h.window.history.pushState(null, "", "#/memory/a");
    h.window.dispatchEvent(new h.window.Event("hashchange"));
  });
  assert.equal(h.route.path, "/memory/a");
  assert.equal(h.canGoBack(), true);
});

test("Home and Atlas have separate canonical routes", async (t) => {
  const home = await harness(t, "http://localhost/?demo=1#/");
  assert.equal(home.route.path, "/");
  await home.navigate("/atlas?selected=lake-days&view=portal");
  assert.equal(home.route.path, "/atlas");
  assert.equal(home.route.selected, "lake-days");
  assert.equal(home.route.search, "?selected=lake-days&view=portal");
});

test("legacy root selection links retain their Atlas state", async (t) => {
  const h = await harness(
    t,
    "http://localhost/?demo=1#/?selected=lake-days&view=portal",
  );
  assert.equal(h.route.path, "/atlas");
  assert.equal(h.route.selected, "lake-days");
  assert.equal(h.route.search, "?selected=lake-days&view=portal");
  assert.equal(h.canGoBack(), false);
});
