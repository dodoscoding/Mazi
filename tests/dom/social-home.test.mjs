import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, StrictMode } from "react";
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
  t.after(() => vite.close());
  const module = await vite.ssrLoadModule(modulePath);
  const host = document.createElement("div");
  document.body.append(host);
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(host);
  t.after(async () => {
    await act(async () => root.unmount());
    window.happyDOM.abort();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  await act(async () =>
    root.render(
      createElement(StrictMode, null, createElement(module[exportName], props)),
    ),
  );
  return {
    window,
    host,
    calls,
    click: (element) => act(async () => element.click()),
    dispatch: (type) =>
      act(async () => window.dispatchEvent(new window.Event(type))),
  };
}

const props = {
  group: "circle",
  circle: "Arkadaşlarımız",
  activity: false,
  link: () => () => {},
  heading: { current: null },
};
const empty = {
  featured: null,
  activity: { items: [], next_cursor: null },
  server_time: 1900000000,
  can_plan: true,
};
const event = {
  id: "activity-1",
  kind: "comment",
  action: "created",
  target: { kind: "photo", id: "asset" },
  asset_id: "asset",
  actor: { id: "ben", name: "Ben" },
  occurred_at: 1900000000,
  text: "Yeni söz",
};
const selectedProps = {
  id: "photo-asset",
  group: "circle",
  demo: false,
  sessionKey: "alice",
  search: "",
  notebook: false,
  photo: 0,
  memories: [],
  backUrl: "/",
  link: () => () => {},
  navigate() {},
  heading: { current: null },
};
const photo = {
  id: "photo-asset",
  kind: "photo",
  title: "Seçili fotoğraf",
  shortTitle: "Seçili",
  date: "Date not recorded",
  year: null,
  approximate: true,
  by: "Alice",
  description: "Sentetik fotoğraf",
  source: "manual",
  photos: [
    {
      src: "/synthetic.jpg",
      alt: "Sentetik",
      caption: "Sentetik",
      assetId: "asset",
    },
  ],
  messages: [],
  place: null,
  people: { shared: [], conversation: [] },
  dateBasis: "undated",
};
test("a grouped photo detail reads only the explicit selected-memory endpoint", async (t) => {
  const h = await mount(
    t,
    "/src/memory/SelectedMemory.tsx",
    "default",
    selectedProps,
    async () => Response.json({ memory: photo }),
  );
  assert.match(h.host.textContent, /Seçili fotoğraf/);
  assert.ok(
    h.calls.every(
      ({ path }) =>
        path === "/api/atlas/memory?group=circle&memory=photo-asset",
    ),
  );
});
test("selected memory ignores a late private response after session disposal", async (t) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const h = await mount(
    t,
    "/src/memory/SelectedMemory.tsx",
    "default",
    selectedProps,
    async () => {
      await gate;
      return Response.json({ memory: photo });
    },
  );
  await h.dispatch("mazi:session");
  await act(async () => release());
  assert.doesNotMatch(h.host.textContent, /Seçili fotoğraf/);
  assert.match(h.host.textContent, /Anı bulunamadı/);
});
