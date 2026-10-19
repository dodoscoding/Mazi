import assert from "node:assert/strict";
import test from "node:test";
import { atlasHarness, deferred } from "./atlas-harness.mjs";

const coastline = {
  features: [
    {
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [1, 2],
            [0, 0],
          ],
        ],
      },
    },
  ],
};

test("failed land requests can retry and only usable land is cached", async (t) => {
  let requests = 0;
  const h = await atlasHarness(t, {
    fetch: async () => {
      requests++;
      return requests === 1
        ? new Response(null, { status: 503 })
        : Response.json(coastline);
    },
  });
  const { loadLand } = await h.server.ssrLoadModule("/src/atlas/land.ts");
  assert.equal(await loadLand(), null);
  const land = await loadLand();
  assert.equal(land?.path, "M180.0 90.0L182.0 90.0L181.0 88.0L180.0 90.0Z");
  assert.equal(await loadLand(), land);
  assert.equal(requests, 2);
});

test("a stalled land request is aborted within ten seconds and can retry", async (t) => {
  const stalled = deferred();
  let signal;
  let requests = 0;
  const h = await atlasHarness(t, {
    fetch: (path, options) => {
      requests++;
      signal = options?.signal;
      return requests === 1
        ? stalled.promise
        : Promise.resolve(Response.json(coastline));
    },
  });
  const { loadLand } = await h.server.ssrLoadModule("/src/atlas/land.ts");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const request = loadLand();
    let result;
    void request.then((value) => {
      result = value;
    });
    t.mock.timers.tick(10_000);
    assert.equal(signal?.aborted, true, "timeout aborts the transport");
    for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.equal(
      result,
      null,
      "timeout settles even if transport ignores its signal",
    );
    assert.ok(await loadLand());
    assert.equal(requests, 2);
  } finally {
    t.mock.timers.reset();
  }
});

test("a stalled response body is also bounded and cannot populate the cache late", async (t) => {
  const body = deferred();
  let signal;
  let requests = 0;
  const h = await atlasHarness(t, {
    fetch: async (path, options) => {
      requests++;
      signal = options.signal;
      return requests === 1
        ? { ok: true, json: () => body.promise }
        : Response.json(coastline);
    },
  });
  const { loadLand } = await h.server.ssrLoadModule("/src/atlas/land.ts");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const request = loadLand();
    await Promise.resolve();
    t.mock.timers.tick(10_000);
    assert.equal(signal.aborted, true);
    assert.equal(await request, null);
    body.resolve(coastline);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.ok(await loadLand());
    assert.equal(requests, 2);
    const successfulSignal = signal;
    t.mock.timers.tick(10_000);
    assert.equal(
      successfulSignal.aborted,
      false,
      "success cleans up its deadline",
    );
  } finally {
    t.mock.timers.reset();
  }
});

for (const [name, fail] of [
  ["network rejection", () => Promise.reject(new Error("Synthetic offline"))],
  ["invalid JSON", async () => new Response("not JSON")],
  ["empty geometry", async () => Response.json({ features: [] })],
  [
    "malformed geometry",
    async () =>
      Response.json({
        features: [{ geometry: { type: "Polygon", coordinates: null } }],
      }),
  ],
]) {
  test(`land recovers from ${name} without caching failure`, async (t) => {
    let requests = 0;
    const h = await atlasHarness(t, {
      fetch: () =>
        ++requests === 1 ? fail() : Promise.resolve(Response.json(coastline)),
    });
    const { loadLand } = await h.server.ssrLoadModule("/src/atlas/land.ts");
    assert.equal(await loadLand(), null);
    assert.ok(await loadLand());
    assert.equal(requests, 2);
  });
}

test("an already cancelled land caller does not start a request", async (t) => {
  let requests = 0;
  const h = await atlasHarness(t, {
    fetch: async () => {
      requests++;
      return Response.json(coastline);
    },
  });
  const { loadLand } = await h.server.ssrLoadModule("/src/atlas/land.ts");
  const controller = new AbortController();
  controller.abort();
  assert.equal(await loadLand(controller.signal), null);
  assert.equal(requests, 0);
});
