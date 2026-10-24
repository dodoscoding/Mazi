import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";

const ben = {
  user_id: "ben",
  display_name: "Ben",
  group_id: "circle",
  introduced: true,
};

async function harness(t, boundary) {
  const window = new Window({ url: "http://localhost/#/" });
  const saved = new Map();
  const calls = [];
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    location: window.location,
    sessionStorage: window.sessionStorage,
    Event: window.Event,
    fetch: async (path, options) => {
      calls.push(String(path));
      return boundary(String(path), options);
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
  const { useEntry } = await vite.ssrLoadModule("/src/useEntry.ts");
  const statuses = [];
  let current;
  function Probe() {
    current = useEntry();
    statuses.push(current.state.status);
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
    calls,
    statuses,
    get state() {
      return current.state;
    },
    setHidden: (hidden) =>
      act(async () => {
        Object.defineProperty(window.document, "hidden", {
          value: hidden,
          configurable: true,
        });
        window.document.dispatchEvent(new window.Event("visibilitychange"));
      }),
    dispatch: (type, persisted) =>
      act(async () => {
        const event = new window.Event(type);
        if (persisted !== undefined)
          Object.defineProperty(event, "persisted", { value: persisted });
        window.dispatchEvent(event);
      }),
  };
}

test("backgrounding keeps the signed-in view and revalidates quietly on return", async (t) => {
  const h = await harness(t, async () => Response.json(ben));
  assert.equal(h.state.status, "ready");
  h.calls.length = 0;
  h.statuses.length = 0;
  await h.setHidden(true);
  await h.dispatch("pagehide", true);
  assert.equal(h.state.status, "ready");
  assert.deepEqual(h.calls, []);
  await h.setHidden(false);
  assert.deepEqual(h.calls, ["/api/session"]);
  await h.dispatch("pageshow", true);
  assert.deepEqual(h.calls, ["/api/session", "/api/session"]);
  await h.dispatch("pageshow", false);
  assert.equal(h.calls.length, 2);
  assert.ok(h.statuses.length > 0);
  assert.deepEqual(new Set(h.statuses), new Set(["ready"]));
  assert.equal(h.state.profile.display_name, "Ben");
});

test("quiet revalidation keeps the view through outages and clears it on lost access", async (t) => {
  let reply = () => Response.json(ben);
  const h = await harness(t, async () => reply());
  for (const outage of [
    () => Promise.reject(new TypeError("offline")),
    () => Response.json({ error: "Archive is busy" }, { status: 503 }),
  ]) {
    reply = outage;
    await h.setHidden(true);
    await h.setHidden(false);
    assert.equal(h.state.status, "ready");
  }
  reply = () => Response.json({ error: "Signed out" }, { status: 401 });
  await h.setHidden(true);
  await h.setHidden(false);
  assert.equal(h.state.status, "signed-out");
  assert.equal(h.window.sessionStorage.getItem("mazi.group"), null);
});

test("a different person or circle on return clears the view", async (t) => {
  let profile = ben;
  const h = await harness(t, async () => Response.json(profile));
  profile = { ...ben, user_id: "someone-else" };
  await h.setHidden(true);
  await h.setHidden(false);
  assert.equal(h.state.status, "signed-out");
  assert.match(h.state.error, /access changed/);
  h.calls.length = 0;
  await h.setHidden(true);
  await h.setHidden(false);
  assert.deepEqual(h.calls, []);
});

test("revalidation keeps the circle the person chose", async (t) => {
  const h = await harness(t, async () => Response.json(ben));
  assert.equal(h.window.sessionStorage.getItem("mazi.group"), "circle");
  h.window.sessionStorage.setItem("mazi.group", "other-circle");
  await h.setHidden(true);
  await h.setHidden(false);
  assert.equal(h.window.sessionStorage.getItem("mazi.group"), "other-circle");
});
