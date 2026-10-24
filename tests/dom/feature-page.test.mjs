import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";

test("a feature page keeps its mounted view while the tab is hidden", async (t) => {
  const window = new Window({ url: "http://localhost/#/review" });
  const saved = new Map();
  const calls = [];
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    location: window.location,
    sessionStorage: window.sessionStorage,
    MutationObserver: window.MutationObserver,
    HTMLElement: window.HTMLElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLInputElement: window.HTMLInputElement,
    Event: window.Event,
    matchMedia: window.matchMedia.bind(window),
    fetch: async (path) => {
      calls.push(String(path));
      return Response.json({ error: "Unavailable" }, { status: 503 });
    },
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
  const { FeaturePage } = await vite.ssrLoadModule("/src/features/index.tsx");
  const host = window.document.createElement("div");
  window.document.body.append(host);
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
  await act(async () =>
    root.render(createElement(FeaturePage, { path: "/review" })),
  );
  const mounted = host.querySelector(".feature-content");
  assert.ok(mounted);
  const before = calls.length;
  for (const hidden of [true, false]) {
    await act(async () => {
      Object.defineProperty(window.document, "hidden", {
        value: hidden,
        configurable: true,
      });
      window.document.dispatchEvent(new window.Event("visibilitychange"));
    });
    assert.equal(host.querySelector(".feature-content"), mounted);
  }
  for (const type of ["pagehide", "pageshow"]) {
    await act(async () => {
      const event = new window.Event(type);
      Object.defineProperty(event, "persisted", { value: true });
      window.dispatchEvent(event);
    });
    assert.equal(host.querySelector(".feature-content"), mounted);
  }
  assert.equal(calls.length, before);
});
