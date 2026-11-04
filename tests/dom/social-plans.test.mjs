import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, StrictMode } from "react";
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

const plan = {
  id: "meeting",
  title: "Cumartesi birlikte",
  revision: 1,
  status: "active",
  start_local: "2030-06-01T18:00:00",
  start_offset: "+02:00",
  starts_at: "2030-06-01T16:00:00Z",
  timezone: "Europe/Copenhagen",
  end_local: null,
  end_offset: null,
  ends_at: null,
  place: "Liman",
  description: "Birlikte yürüyelim.",
  editable: true,
  organizer: { id: "alice", name: "Alice" },
  attendance: { yes: 0, maybe: 0, no: 0, mine: null, revision: 0 },
  participants: [],
  memory: null,
};
const plansProps = {
  group: "circle",
  search: "?section=plans",
  demo: false,
  navigate() {},
};
const findButton = (h, label) =>
  [...h.host.querySelectorAll("button")].find(
    (button) => button.textContent.trim() === label,
  );

test("empty plans work under StrictMode without loading Atlas", async (t) => {
  const h = await mount(t, "/src/social/Plans.tsx", "default", plansProps);
  assert.match(h.host.textContent, /Yaklaşan bir buluşma yok/);
  assert.equal(
    h.calls.some(({ path }) => path.startsWith("/api/atlas")),
    false,
  );
  assert.ok(h.calls.every(({ path }) => path.startsWith("/api/social/plans?")));
});

test("demo and another group's plan never request private social data", async (t) => {
  const h = await mount(t, "/src/social/Plans.tsx", "default", {
    ...plansProps,
    demo: true,
    search: "?section=plans&new=1",
  });
  assert.match(h.host.textContent, /Örnek arşivde plan oluşturulmaz/);
  assert.equal(h.host.querySelector("form"), null);
  assert.equal(h.calls.length, 0);
});

test("a deep link for another group is denied before reading", async (t) => {
  const h = await mount(t, "/src/social/Plans.tsx", "default", {
    ...plansProps,
    search: "?section=plans&group=other&plan=meeting",
  });
  assert.match(h.host.textContent, /Bu plan kullanılamıyor/);
  assert.equal(h.calls.length, 0);
});

test("an uncertain save retains the draft and retries exactly the same command", async (t) => {
  let writes = 0;
  const h = await mount(
    t,
    "/src/social/Plans.tsx",
    "default",
    { ...plansProps, search: "?section=plans&group=circle&plan=meeting" },
    async (_path, options) => {
      if (options.method === "POST" && ++writes === 1)
        throw new TypeError("Synthetic lost response");
      return Response.json(plan);
    },
  );
  await h.click(findButton(h, "Düzenle"));
  await act(async () =>
    h.host
      .querySelector("form")
      .dispatchEvent(
        new h.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
  );
  assert.equal(
    h.host.querySelector('[name="title"]').value,
    "Cumartesi birlikte",
  );
  assert.match(h.host.textContent, /İşlemin sonucu doğrulanamadı/);
  await h.click(findButton(h, "Aynı işlemi yeniden dene"));
  const commands = h.calls
    .filter(({ options }) => options.method === "POST")
    .map(({ options }) => JSON.parse(options.body));
  assert.equal(commands.length, 2);
  assert.deepEqual(commands[0], commands[1]);
  assert.equal(h.host.querySelector("form"), null);
});

test("a stale edit can reload the current revision without replacing its draft", async (t) => {
  let reloaded = false;
  const h = await mount(
    t,
    "/src/social/Plans.tsx",
    "default",
    { ...plansProps, search: "?section=plans&group=circle&plan=meeting" },
    async (_path, options) => {
      if (options.method === "POST") {
        reloaded = true;
        return Response.json({ error: "Plan changed" }, { status: 409 });
      }
      return Response.json(
        reloaded ? { ...plan, title: "Yeni ortak başlık", revision: 2 } : plan,
      );
    },
  );
  await h.click(findButton(h, "Düzenle"));
  await act(async () =>
    h.host
      .querySelector("form")
      .dispatchEvent(
        new h.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
  );
  await h.click(findButton(h, "Güncel planı yükle"));
  assert.equal(
    h.host.querySelector('[name="title"]').value,
    "Cumartesi birlikte",
  );
  assert.match(h.host.textContent, /Yeni ortak başlık/);
  await h.dispatch("mazi:group");
  assert.equal(h.host.querySelector("form"), null);
  assert.match(h.host.textContent, /Bu plan kullanılamıyor/);
});

test("late plan reads cannot restore content after access loss", async (t) => {
  let resolve;
  const response = new Promise((done) => {
    resolve = done;
  });
  const h = await mount(
    t,
    "/src/social/Plans.tsx",
    "default",
    { ...plansProps, search: "?section=plans&group=circle&plan=meeting" },
    async () => response,
  );
  await h.dispatch("mazi:access-lost");
  await act(async () => resolve(Response.json(plan)));
  assert.match(h.host.textContent, /Bu plan kullanılamıyor/);
  assert.doesNotMatch(h.host.textContent, /Cumartesi birlikte/);
});

test("plan wall times distinguish gaps, repeated hours and quarter-hour offsets", async (t) => {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  t.after(() => vite.close());
  const { wallTime } = await vite.ssrLoadModule("/src/social/time.ts");
  assert.deepEqual(wallTime("2030-03-31T02:30", "Europe/Copenhagen"), {
    kind: "gap",
    offsets: [],
  });
  assert.deepEqual(wallTime("2030-10-27T02:30", "Europe/Copenhagen"), {
    kind: "valid",
    offsets: ["+01:00", "+02:00"],
  });
  assert.deepEqual(wallTime("2030-06-01T00:15", "Asia/Kathmandu"), {
    kind: "valid",
    offsets: ["+05:45"],
  });
  assert.deepEqual(wallTime("2030-06-01T00:15", "UTC"), {
    kind: "valid",
    offsets: ["+00:00"],
  });
  assert.equal(wallTime("2030-06-01T00:15", "Unknown/Zone").kind, "invalid");
});

test("profile changes clear a pending write draft and discard its late response", async (t) => {
  let resolve;
  const response = new Promise((done) => {
    resolve = done;
  });
  const h = await mount(
    t,
    "/src/social/Plans.tsx",
    "default",
    { ...plansProps, search: "?section=plans&group=circle&plan=meeting" },
    async (_path, options) =>
      options.method === "POST" ? response : Response.json(plan),
  );
  await h.click(findButton(h, "Düzenle"));
  await act(async () =>
    h.host
      .querySelector("form")
      .dispatchEvent(
        new h.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
  );
  await h.dispatch("mazi:session");
  await act(async () => resolve(Response.json(plan)));
  assert.equal(h.host.querySelector("form"), null);
  assert.match(h.host.textContent, /Bu plan kullanılamıyor/);
  assert.doesNotMatch(h.host.textContent, /Cumartesi birlikte/);
});

test("a failed next page retains the list and retries its exact cursor", async (t) => {
  let nextRequests = 0;
  const h = await mount(
    t,
    "/src/social/Plans.tsx",
    "default",
    plansProps,
    async (path) => {
      if (new URL(path, "http://localhost").searchParams.has("cursor")) {
        if (++nextRequests === 1)
          return Response.json(
            { error: "Synthetic unavailable" },
            { status: 503 },
          );
        return Response.json({
          items: [{ ...plan, id: "second", title: "İkinci buluşma" }],
          next_cursor: null,
        });
      }
      return Response.json({ items: [plan], next_cursor: "next-page" });
    },
  );
  await h.click(findButton(h, "Diğer planlar"));
  assert.deepEqual(
    [...h.host.querySelectorAll(".plan-list h2")].map(
      (item) => item.textContent,
    ),
    ["Cumartesi birlikte"],
  );
  await h.click(findButton(h, "Diğer planlar"));
  assert.deepEqual(
    [...h.host.querySelectorAll(".plan-list h2")].map(
      (item) => item.textContent,
    ),
    ["Cumartesi birlikte", "İkinci buluşma"],
  );
  assert.deepEqual(
    h.calls
      .filter(({ path }) => path.includes("cursor="))
      .map(({ path }) =>
        new URL(path, "http://localhost").searchParams.get("cursor"),
      ),
    ["next-page", "next-page"],
  );
});

test("a denied write prevents an already-running read from restoring private content", async (t) => {
  let resolve;
  let delay = false;
  const response = new Promise((done) => {
    resolve = done;
  });
  const h = await mount(
    t,
    "/src/social/Plans.tsx",
    "default",
    { ...plansProps, search: "?section=plans&group=circle&plan=meeting" },
    async (_path, options) => {
      if (options.method === "POST")
        return Response.json({ error: "Plan unavailable" }, { status: 403 });
      return delay ? response : Response.json(plan);
    },
  );
  delay = true;
  await h.dispatch("pageshow");
  const attend = [...h.host.querySelectorAll("button")].find((button) =>
    button.textContent.startsWith("Geliyorum"),
  );
  await h.click(attend);
  assert.match(h.host.textContent, /Bu plan kullanılamıyor/);
  await act(async () => resolve(Response.json(plan)));
  assert.match(h.host.textContent, /Bu plan kullanılamıyor/);
  assert.doesNotMatch(h.host.textContent, /Cumartesi birlikte/);
});

test("unrelated edits preserve a hidden memory and visible links can be explicitly removed", async (t) => {
  const h = await mount(t, "/src/social/Plans.tsx", "default",
    { ...plansProps, search: "?section=plans&group=circle&plan=meeting" },
    async (_path, options) => Response.json(plan));
  await h.click(findButton(h, "Düzenle"));
  await act(async () => h.host.querySelector("form").dispatchEvent(
    new h.window.Event("submit", { bubbles: true, cancelable: true })));
  const body = JSON.parse(h.calls.find(({ options }) => options.method === "POST").options.body);
  assert.deepEqual(body.patch, {}, "an unchanged hidden projection must not unlink the stored memory");
});
