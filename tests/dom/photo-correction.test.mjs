import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { atlasHarness, deferred } from "./atlas-harness.mjs";

async function mount(t, boundary) {
  let root;
  t.after(() => act(async () => root?.unmount()));
  const harness = await atlasHarness(t, { fetch: boundary });
  const { default: Editor } = await harness.server.ssrLoadModule(
    "/src/memory/PhotoCorrection.tsx",
  );
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  let closed = 0;
  await act(async () =>
    root.render(
      createElement(Editor, {
        group: "group",
        asset: "selected-child",
        field: "place",
        close: () => closed++,
      }),
    ),
  );
  return {
    host,
    get closed() {
      return closed;
    },
  };
}
const state = (snapshot) => ({
  snapshot,
  annotation: { place: "Garden", capture_date: null },
});
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("selected-photo editor preserves draft after conflict and retries only that field", async (t) => {
  const writes = [];
  let reads = 0;
  const ui = await mount(t, async (path, options) => {
    if (options.method === "POST") {
      writes.push(JSON.parse(options.body));
      return json({}, writes.length === 1 ? 409 : 200);
    }
    return json(state(++reads === 1 ? "old" : "fresh"));
  });
  await act(async () =>
    ui.host
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  assert.match(ui.host.textContent, /Taslağınız korundu/);
  assert.equal(ui.host.querySelector("input").value, "Garden");
  await act(async () =>
    ui.host
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  assert.deepEqual(
    writes.map((write) => [
      write.asset,
      write.expected_snapshot,
      write.changes,
    ]),
    [
      ["selected-child", "old", { place: "Garden" }],
      ["selected-child", "fresh", { place: "Garden" }],
    ],
  );
  assert.equal(ui.closed, 1);
});

test("access loss aborts pending save and ignores its late success", async (t) => {
  const pending = deferred();
  let signal;
  const ui = await mount(t, async (path, options) => {
    if (options.method === "POST") {
      signal = options.signal;
      return pending.promise;
    }
    return json(state("snapshot"));
  });
  await act(async () =>
    ui.host
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await act(async () => window.dispatchEvent(new Event("mazi:group")));
  assert.equal(signal.aborted, true);
  assert.equal(ui.host.querySelector("input").value, "");
  await act(async () => pending.resolve(json({})));
  assert.equal(ui.closed, 1);
});
