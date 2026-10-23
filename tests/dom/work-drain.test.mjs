import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";
import { until } from "./feature-harness.mjs";

async function harness(t, replies) {
  const calls = [];
  const window = new Window({ url: "http://localhost/" });
  const saved = new Map();
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    Event: window.Event,
    fetch: async (path, options) => {
      calls.push(`${options?.method} ${path}`);
      const [status, body] = replies.shift() ?? [200, { pending: false }];
      return Response.json(body, { status });
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
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const { useWorkDrain } = await vite.ssrLoadModule("/src/useWorkDrain.ts");
  function Probe({ active }) {
    useWorkDrain(active);
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
  return {
    calls,
    render: (active) =>
      act(async () => root.render(createElement(Probe, { active }))),
  };
}

test("signed-in tab drains while work is pending, then idles until kicked", async (t) => {
  const h = await harness(t, [
    [200, { pending: true }],
    [200, { pending: true }],
    [200, { pending: false }],
  ]);
  await h.render(false);
  await delay(20);
  assert.deepEqual(h.calls, []);
  await h.render(true);
  await until(() => h.calls.length === 3, "pending drains repeat at once");
  await delay(50);
  assert.equal(h.calls.length, 3);
  window.dispatchEvent(new Event("mazi:work"));
  await until(() => h.calls.length === 4, "an import action kicks a drain");
  assert.deepEqual(new Set(h.calls), new Set(["POST /api/work"]));
  await h.render(false);
  window.dispatchEvent(new Event("mazi:work"));
  await delay(50);
  assert.equal(h.calls.length, 4);
});

for (const [label, reply] of [
  [
    "a server with its own worker thread",
    [200, { pending: false, mode: "thread" }],
  ],
  ["a server without the route", [404, { error: "Not found" }]],
]) {
  test(`stops for ${label}`, async (t) => {
    const h = await harness(t, [reply]);
    await h.render(true);
    await until(() => h.calls.length === 1, "first drain request");
    window.dispatchEvent(new Event("mazi:work"));
    await delay(50);
    assert.equal(h.calls.length, 1);
  });
}
