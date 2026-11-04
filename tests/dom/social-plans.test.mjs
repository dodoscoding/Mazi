import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";

async function mount(
  t,
  modulePath,
  exportName,
  props,
  boundary = async () => Response.json({ items: [], next_cursor: null }),
) {
  const window = new Window({ url: "http://localhost/#/circle?section=plans" });
  const saved = new Map();
  const calls = [];
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    location: window.location,
    history: window.history,
    sessionStorage: window.sessionStorage,
    localStorage: window.localStorage,
    Event: window.Event,
    HTMLElement: window.HTMLElement,
    HTMLSelectElement: window.HTMLSelectElement,
    matchMedia: window.matchMedia.bind(window),
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (path, options) => {
      calls.push({ path: String(path), options });
      return boundary(String(path), options);
    },
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
  const module = await vite.ssrLoadModule(modulePath);
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
  await act(async () => root.render(createElement(module[exportName], props)));
  return {
    window,
    host,
    calls,
    click: (element) => act(async () => element.click()),
    dispatch: (type) =>
      act(async () => window.dispatchEvent(new window.Event(type))),
  };
}

test("Ekle exposes separate photo and meeting actions without changing the three destinations", async (t) => {
  const h = await mount(t, "/src/Shell.tsx", "Shell", {
    path: "/circle",
    demo: false,
    archive: {
      groups: [{ id: "circle", name: "Friends" }],
      group: "circle",
      chooseGroup() {},
    },
    profileName: "Alice",
    link: () => () => {},
    onSignOut() {},
  });
  const add = [...h.host.querySelectorAll("button")].find((button) =>
    button.textContent.includes("Ekle"),
  );
  assert.ok(add, "Ekle must open a contribution menu");
  await h.click(add);
  assert.equal(
    h.host.querySelector('a[href="#/imports"]').textContent.trim(),
    "Fotoğraf veya arşiv",
  );
  assert.equal(
    h.host
      .querySelector('a[href="#/circle?section=plans&new=1"]')
      .textContent.trim(),
    "Buluşma planla",
  );
  assert.equal(h.host.querySelectorAll(".primary-nav a").length, 3);
});
