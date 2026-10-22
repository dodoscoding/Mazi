import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";
import { deferred } from "./feature-harness.mjs";

async function harness(t, boundary) {
  const window = new Window({ url: "http://localhost/" });
  const saved = new Map();
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    sessionStorage: window.sessionStorage,
    Event: window.Event,
    fetch: boundary,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const { useArchive } = await vite.ssrLoadModule("/src/useArchive.ts");
  let current;
  function Probe({ path, demo, groupId }) {
    current = useArchive(path, demo, groupId);
    return createElement("p", null, current.group);
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
  return {
    window,
    get current() {
      return current;
    },
    render: (path, demo = false, groupId = "circle") =>
      act(async () =>
        root.render(createElement(Probe, { path, demo, groupId })),
      ),
  };
}
const groups = [{ id: "circle", name: "Our circle", role: "admin" }];

test("independent feature routes load circle context without requesting Atlas", async (t) => {
  const calls = [];
  const h = await harness(t, async (path) => {
    calls.push(String(path));
    return Response.json(path === "/api/groups" ? groups : { memories: [] });
  });
  for (const path of [
    "/imports",
    "/circle",
    "/review",
    "/places",
    "/discover",
    "/ask",
    "/answer-evidence",
    "/memories",
    "/search",
  ]) {
    await h.render(path);
    assert.equal(h.current.group, "circle");
    assert.deepEqual(h.current.groups, groups);
    assert.equal(h.current.status, "ready");
    assert.deepEqual(h.current.memories, []);
  }
  assert.equal(calls.filter((path) => path.startsWith("/api/atlas")).length, 0);
  assert.equal(calls.filter((path) => path === "/api/groups").length, 1);
});

test("Atlas routes still load current memories and demo search remains local", async (t) => {
  const calls = [];
  const h = await harness(t, async (path) => {
    calls.push(String(path));
    return Response.json(
      path === "/api/groups" ? groups : { memories: [{ id: "photo" }] },
    );
  });
  for (const path of ["/", "/timeline", "/memory/photo"]) {
    await h.render(path);
    assert.equal(h.current.memories[0].id, "photo");
  }
  assert.equal(calls.filter((path) => path.startsWith("/api/atlas")).length, 1);
  const before = calls.length;
  await h.render("/search", true);
  assert.equal(calls.length, before);
  assert.ok(h.current.memories.length);
});

test("leaving Atlas aborts and ignores late data; returning fetches again", async (t) => {
  const pending = deferred();
  let calls = 0;
  let signal;
  const h = await harness(t, async (path, options) => {
    if (path === "/api/groups") return Response.json(groups);
    calls++;
    if (calls === 1) {
      signal = options.signal;
      return pending.promise;
    }
    return Response.json({ memories: [{ id: "fresh" }] });
  });
  await h.render("/");
  await h.render("/imports");
  assert.equal(signal.aborted, true);
  await act(async () =>
    pending.resolve(Response.json({ memories: [{ id: "stale" }] })),
  );
  assert.deepEqual(h.current.memories, []);
  assert.equal(calls, 1);
  await h.render("/timeline");
  assert.equal(calls, 2);
  assert.equal(h.current.memories[0].id, "fresh");
});

test("feature routes retain group access denial and pagehide cleanup", async (t) => {
  let denied = false;
  let accessLost = 0;
  const h = await harness(t, async () =>
    denied
      ? Response.json({ error: "Denied" }, { status: 403 })
      : Response.json(groups),
  );
  h.window.addEventListener("mazi:access-lost", () => accessLost++);
  await h.render("/imports");
  await act(async () => h.window.dispatchEvent(new h.window.Event("pagehide")));
  assert.deepEqual(h.current.groups, []);
  denied = true;
  await act(async () => h.window.dispatchEvent(new h.window.Event("pageshow")));
  assert.equal(accessLost, 1);
  assert.equal(h.current.status, "signed-out");
  assert.deepEqual(h.current.memories, []);
  assert.equal(h.window.sessionStorage.getItem("mazi.group"), null);
});

test("without an authenticated profile no archive requests are made", async (t) => {
  const calls = [];
  const h = await harness(t, async (path) => {
    calls.push(path);
    return Response.json(groups);
  });
  await h.render("/imports", false, null);
  assert.deepEqual(calls, []);
  assert.deepEqual(h.current.groups, []);
  await h.render("/", false, null);
  assert.deepEqual(calls, []);
});


test("superseded visibility loads abort and pagehide cancels private work", async (t) => {
  const pending = deferred();
  const signals = [];
  let calls = 0;
  const h = await harness(t, async (path, options) => {
    signals.push(options.signal);
    if (++calls === 1) return pending.promise;
    return Response.json(path === "/api/groups" ? groups : { memories: [{ id: "fresh" }] });
  });
  await h.render("/");
  await act(async () => h.window.dispatchEvent(new h.window.Event("pageshow")));
  assert.equal(signals[0].aborted, true);
  assert.equal(h.current.memories[0].id, "fresh");
  await act(async () => pending.resolve(Response.json(groups)));
  assert.equal(h.current.memories[0].id, "fresh");
  await act(async () => h.window.dispatchEvent(new h.window.Event("pagehide")));
  assert.equal(signals.at(-1).aborted, true);
  assert.deepEqual(h.current.memories, []);
});
