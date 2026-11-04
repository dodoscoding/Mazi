import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createServer } from "vite";
import { Window } from "happy-dom";

const photo = (name) => ({
  src: `/api/review/rendition/${name}`,
  alt: "",
  caption: "",
});
const memory = (id, title, photos, place = null) => ({
  id,
  kind: "memory",
  shortTitle: title,
  title,
  date: "2024-06-01",
  year: 2024,
  approximate: false,
  by: "Your circle",
  description: "",
  photos: photos.map(photo),
  messages: [],
  place,
  people: { shared: [], conversation: [] },
});
const KYRENIA = {
  name: "Kyrenia",
  country: "CY",
  latitude: 35.326,
  longitude: 33.333,
};
const VICTORIA_TX = {
  name: "Victoria",
  country: "US",
  latitude: 28.805,
  longitude: -97.003,
};
const ANSWERS = {
  Victoria: {
    place_match: "ambiguous",
    place: null,
    candidates: ["Victoria, British Columbia, CA", "Victoria, Texas, US"],
    pin: null,
  },
  "Victoria, Texas, US": {
    place_match: "matched",
    place: "Victoria, US",
    candidates: [],
    pin: VICTORIA_TX,
  },
  girne: {
    place_match: "matched",
    place: "Kyrenia, CY",
    candidates: [],
    pin: KYRENIA,
  },
  Nowhereville: {
    place_match: "missing",
    place: null,
    candidates: [],
    pin: null,
  },
  "": { place_match: "empty", place: null, candidates: [], pin: null },
};

async function harness(t, atlas = async () => ({ memories: [] })) {
  const window = new Window({ url: "http://localhost/" });
  const saved = new Map();
  const requests = [];
  const define = (name, value) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  };
  for (const name of ["window", "document", "HTMLElement", "Event"])
    define(name, name === "window" ? window : window[name]);
  define("IS_REACT_ACT_ENVIRONMENT", true);
  define("fetch", async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    requests.push({ url, body });
    if (url === "/api/atlas/place")
      return Response.json({ ok: true, ...ANSWERS[body.place] });
    if (String(url).startsWith("/api/atlas?"))
      return Response.json(await atlas());
    return new Response(null, { status: 404 });
  });
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const module = await server.ssrLoadModule("/src/atlas/PlaceMemories.tsx");
  // React decides at import whether the DOM supports input events, so load it after the window exists.
  const { createRoot } = await import("react-dom/client");
  const host = window.document.createElement("main");
  window.document.body.append(host);
  const root = createRoot(host);
  t.after(async () => {
    await act(async () => root.unmount());
    window.happyDOM.abort();
    await server.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const flush = () =>
    act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return {
    module,
    requests,
    $: (selector) => host.querySelector(selector),
    $$: (selector) => [...host.querySelectorAll(selector)],
    render: (element) => act(async () => root.render(element)),
    click: async (element) => {
      await act(async () => element.click());
      await flush();
    },
    type: async (text) => {
      const input = host.querySelector(".place-field input");
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      await act(async () => {
        setter.call(input, text);
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
      await act(async () =>
        host
          .querySelector(".place-form")
          .dispatchEvent(
            new window.Event("submit", { bubbles: true, cancelable: true }),
          ),
      );
      await flush();
    },
  };
}

test("the tray opens, asks which Victoria, and pins every photo of the chosen memory", async (t) => {
  const h = await harness(t);
  const placed = [];
  const selected = [];
  const props = {
    group: "circle-1",
    onPlaced: (id, pin) => placed.push([id, pin]),
    onSelect: (id) => selected.push(id),
    defaultOpen: false,
  };
  const memories = [
    memory("trip", "Lake weekend", ["a", "b"]),
    memory("photo-c", "Photo shared by Ana", ["c"]),
  ];
  await h.render(createElement(h.module.UnplacedTray, { ...props, memories }));
  const toggle = h.$(".place-tray-toggle");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(h.$(".place-tray-count").textContent, "2");
  assert.equal(h.$(".place-tray-body").hidden, true);

  await h.click(toggle);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.deepEqual(
    h
      .$$(".place-tray-row")
      .map((row) => [
        row.querySelector("img").getAttribute("src"),
        row.textContent,
      ]),
    [
      [
        "/api/review/rendition/a",
        "Lake weekendJun 2024 · No place recorded · 2 photos",
      ],
      [
        "/api/review/rendition/c",
        "Photo shared by AnaJun 2024 · No place recorded · 1 photo",
      ],
    ],
  );

  await h.click(h.$$(".place-tray-row")[0]);
  assert.deepEqual(selected, ["trip"]);
  await h.type("Victoria");
  assert.deepEqual(h.requests.at(-1), {
    url: "/api/atlas/place",
    body: { group: "circle-1", memory: "trip", place: "Victoria" },
  });
  assert.deepEqual(
    h.$$(".place-candidate").map((button) => button.textContent),
    ["Victoria, British Columbia, CA", "Victoria, Texas, US"],
  );
  assert.deepEqual(placed, [], "an ambiguous name pins nothing");

  await h.click(h.$$(".place-candidate")[1]);
  assert.deepEqual(h.requests.at(-1).body, {
    group: "circle-1",
    memory: "trip",
    place: "Victoria, Texas, US",
  });
  assert.deepEqual(placed, [["trip", VICTORIA_TX]]);
  assert.equal(h.$(".place-form"), null, "the form closes after a pin");

  await h.render(
    createElement(h.module.UnplacedTray, {
      ...props,
      memories: memories.slice(1),
    }),
  );
  assert.deepEqual(
    h.$$(".place-tray-name").map((name) => name.textContent),
    ["Photo shared by Ana"],
  );
  assert.equal(h.$(".place-tray-count").textContent, "1");
});

test("an unknown city is reported, writes nothing and keeps the memory in the tray", async (t) => {
  const h = await harness(t);
  const placed = [];
  await h.render(
    createElement(h.module.UnplacedTray, {
      group: "circle-1",
      memories: [memory("photo-c", "Harbour", ["c"])],
      onPlaced: (id, pin) => placed.push([id, pin]),
      onSelect: () => {},
      defaultOpen: true,
    }),
  );
  await h.click(h.$(".place-tray-row"));
  await h.type("Nowhereville");
  assert.equal(
    h.$(".place-status").textContent,
    "“Nowhereville” isn't on the map. Check the spelling or add the country, e.g. “Victoria, CA”.",
  );
  assert.equal(h.$(".place-field input").getAttribute("aria-invalid"), "true");
  assert.deepEqual(placed, []);
  assert.equal(h.$$(".place-tray-row").length, 1);
});

test("on a phone the tray closes after a pin so the globe shows it", async (t) => {
  const h = await harness(t);
  await h.render(
    createElement(h.module.UnplacedTray, {
      group: "circle-1",
      memories: [memory("photo-c", "Harbour", ["c"])],
      onPlaced: () => {},
      onSelect: () => {},
      defaultOpen: true,
      closeOnPlace: true,
    }),
  );
  await h.click(h.$(".place-tray-row"));
  await h.type("girne");
  assert.equal(
    h.$(".place-tray-toggle").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(h.$(".place-tray-body").hidden, true);
});

test("a placed memory can be cleared, and placed memories update at once then from the server", async (t) => {
  const fresh = memory("trip", "Lake weekend", ["a"], {
    ...KYRENIA,
    latitude: 35.33,
  });
  let reread;
  const h = await harness(
    t,
    () =>
      new Promise((resolve) => (reread = () => resolve({ memories: [fresh] }))),
  );
  const cleared = [];
  await h.render(
    createElement(h.module.PlaceForm, {
      group: "circle-1",
      memory: memory("trip", "Lake weekend", ["a"], KYRENIA),
      onPlaced: (id, pin) => cleared.push([id, pin]),
    }),
  );
  await h.click(h.$(".place-clear"));
  assert.deepEqual(h.requests.at(-1).body, {
    group: "circle-1",
    memory: "trip",
    place: "",
  });
  assert.deepEqual(cleared, [["trip", null]]);

  let api;
  const source = [
    memory("trip", "Lake weekend", ["a"]),
    memory("other", "Other", ["b"]),
  ];
  function Probe() {
    api = h.module.usePlacedMemories(source, "circle-1");
    return createElement(
      "p",
      { id: "places" },
      api.memories
        .map(
          (item) => `${item.id}:${item.place ? item.place.latitude : "none"}`,
        )
        .join(" "),
    );
  }
  await h.render(createElement(Probe));
  assert.equal(h.$("#places").textContent, "trip:none other:none");
  await act(async () => api.placed("trip", KYRENIA));
  assert.equal(
    h.$("#places").textContent,
    "trip:35.326 other:none",
    "the pin shows before the reread",
  );
  await act(async () => {
    reread();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(
    h.$("#places").textContent,
    "trip:35.33",
    "the server's Atlas replaces the local pin",
  );
  assert.equal(h.requests.at(-1).url, "/api/atlas?group=circle-1");
});

test("a saved whole-memory place updates each child's evidence before a failed reread", async (t) => {
  const { photoEvidenceMemory } = await import("../helpers/photo-evidence.ts");
  const source = [structuredClone(photoEvidenceMemory)];
  const h = await harness(t, async () => {
    throw Error("Synthetic reread failure");
  });
  let api;
  function Probe() {
    api = h.module.usePlacedMemories(source, "circle-1");
    return null;
  }
  await h.render(createElement(Probe));
  await act(async () => api.placed(source[0].id, KYRENIA));
  assert.deepEqual(
    api.memories[0].photos.map((photo) => photo.evidence.place.text),
    ["Kyrenia, CY", "Kyrenia, CY"],
  );
  assert.deepEqual(
    api.memories[0].photos.map((photo) => photo.evidence.place.pin),
    [KYRENIA, KYRENIA],
  );
  assert.equal(source[0].photos[1].evidence.place.status, "unknown");
});
