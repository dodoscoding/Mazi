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
test("empty social Home offers planning before photo upload without Atlas or notebook reads", async (t) => {
  const h = await mount(
    t,
    "/src/social/SocialHome.tsx",
    "default",
    props,
    async () => Response.json(empty),
  );
  assert.match(h.host.textContent, /İlk buluşmamızı planlayalım/);
  assert.ok(
    h.host.querySelector(
      'a.button--primary[href="#/circle?section=plans&new=1"]',
    ),
  );
  assert.ok(
    h.calls.every(({ path }) => path === "/api/social/home?group=circle"),
  );
});
test("social Home uses the server's plan feature and canonical distinct activity links", async (t) => {
  const h = await mount(
    t,
    "/src/social/SocialHome.tsx",
    "default",
    props,
    async () =>
      Response.json({
        ...empty,
        featured: {
          kind: "plan",
          plan: {
            id: "meet",
            title: "Cumartesi",
            starts_at: "2030-06-01T16:00:00Z",
            timezone: "Europe/Copenhagen",
            place: "Liman",
            attendance: { yes: 2, maybe: 1, no: 0 },
          },
        },
        activity: { items: [event], next_cursor: null },
      }),
  );
  assert.match(h.host.textContent, /Cumartesi|2 kişi geliyor/);
  assert.ok(
    h.host.querySelector('a[href="#/memory/photo-asset?discussion=photo"]'),
  );
  assert.match(h.host.querySelector("time").getAttribute("datetime"), /2030/);
});
test("Home disposes a late feed and private activity on group replacement", async (t) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const h = await mount(
    t,
    "/src/social/SocialHome.tsx",
    "default",
    props,
    async () => {
      await gate;
      return Response.json({
        ...empty,
        activity: { items: [event], next_cursor: null },
      });
    },
  );
  await h.dispatch("mazi:group");
  await act(async () => release());
  assert.doesNotMatch(h.host.textContent, /Yeni söz|Ben/);
  assert.match(h.host.textContent, /Erişimin değişmiş/);
});
test("paged activity retries its exact cursor and preserves an explicit continuation when filtered", async (t) => {
  let fail = true;
  const h = await mount(
    t,
    "/src/social/SocialHome.tsx",
    "default",
    { ...props, activity: true },
    async (path) => {
      const next = new URL(path, "http://localhost").searchParams.get("cursor");
      if (next && fail) return Response.json({}, { status: 503 });
      return Response.json({
        items: next ? [] : [event],
        next_cursor: next ? "more-filtered" : "next",
        partial: !!next,
      });
    },
  );
  const find = (text) =>
    [...h.host.querySelectorAll("button")].find(
      (node) => node.textContent === text,
    );
  await h.click(find("Sonraki haberler"));
  fail = false;
  await h.click(find("Yeniden dene"));
  assert.equal(h.calls.at(-1).path, h.calls.at(-2).path);
  assert.match(h.host.textContent, /Bu aralıkta görünen bir haber yok/);
  assert.ok(find("Sonraki haberler"));
});

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

test("activity cursors without the current profile and group history scope are discarded", async (t) => {
  const h = await mount(
    t,
    "/src/social/SocialHome.tsx",
    "default",
    {
      ...props,
      activity: true,
      sessionKey: "alice",
      search: "?section=activity&group=circle&cursor=old-private-position",
    },
    async () => Response.json({ items: [], next_cursor: null }),
  );
  assert.ok(h.calls.every(({ path }) => !path.includes("cursor=")));
  assert.equal(
    h.window.location.hash,
    "#/circle?section=activity&group=circle",
  );
});
