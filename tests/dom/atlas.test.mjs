import assert from "node:assert/strict";
import test from "node:test";
import { atlasHarness, deferred } from "./atlas-harness.mjs";

test("the globe renders while the optional land request is stalled", async (t) => {
  const request = deferred();
  const h = await atlasHarness(t, { fetch: () => request.promise });
  await h.render();
  assert.ok(
    h.$('[data-testid="globe"]'),
    "globe is visible before land resolves",
  );
  assert.equal(h.scene.props.land, null);
  assert.equal(h.$(".scene-loading"), null);
});

test("retrying a failed scene loads it again while ordinary rerenders do not", async (t) => {
  let attempts = 0;
  const h = await atlasHarness(t, {
    loadGlobe: (module) =>
      ++attempts === 1
        ? Promise.reject(new Error("Synthetic chunk failure"))
        : Promise.resolve(module),
  });
  await h.render();
  assert.ok(h.$(".flat-map"));
  assert.deepEqual(h.failures, [false, true]);
  assert.equal(h.scene.calls, 1);
  await h.render({ day: true });
  assert.equal(h.scene.calls, 1, "rerender alone does not retry a failure");
  await h.click(h.$(".flat-note button"));
  assert.ok(
    h.$('[data-testid="globe"]'),
    "explicit retry can recover the scene",
  );
  assert.equal(h.scene.calls, 2);
  assert.equal(h.$(".flat-note"), null);
  assert.deepEqual(h.views, ["globe"]);
  assert.deepEqual(h.failures, [false, true, false]);
  const mounts = h.scene.mounts;
  await h.render({ year: 2026, reduced: true });
  assert.equal(h.scene.calls, 2, "successful scene keeps its loaded identity");
  assert.equal(h.scene.mounts, mounts);
  assert.equal(h.scene.props.reduced, true);
  assert.equal(h.scene.props.year, 2026);
});

test("a scene retry cancels old land work and late results cannot replace recovered land", async (t) => {
  const oldRequest = deferred();
  const signals = [];
  const data = (longitude) => ({
    features: [
      {
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [longitude, 0],
              [longitude + 1, 0],
              [longitude, 1],
              [longitude, 0],
            ],
          ],
        },
      },
    ],
  });
  const h = await atlasHarness(t, {
    fetch: (path, options) => {
      signals.push(options?.signal);
      return signals.length === 1
        ? oldRequest.promise
        : Promise.resolve(Response.json(data(10)));
    },
  });
  await h.render();
  await h.render({ retryKey: 1 });
  assert.equal(
    signals[0]?.aborted,
    true,
    "retry releases previous land request",
  );
  assert.equal(signals.length, 2);
  assert.equal(
    h.scene.props.land?.path,
    "M190.0 90.0L191.0 90.0L190.0 89.0L190.0 90.0Z",
  );
  const recovered = h.scene.props.land;
  await h.flush(() => oldRequest.resolve(Response.json(data(0))));
  assert.equal(h.scene.props.land, recovered);
  const { loadLand } = await h.server.ssrLoadModule("/src/atlas/land.ts");
  assert.equal(
    await loadLand(),
    recovered,
    "obsolete result cannot poison successful cache",
  );
});

test("globe startup does not wait for page load and unmount removes deferred land work", async (t) => {
  let requests = 0;
  const h = await atlasHarness(t, {
    readyState: "loading",
    fetch: async () => {
      requests++;
      return new Response(null, { status: 503 });
    },
  });
  await h.render();
  assert.ok(h.$('[data-testid="globe"]'));
  assert.equal(requests, 0);
  await h.unmount();
  await h.flush(() => h.window.dispatchEvent(new h.window.Event("load")));
  assert.equal(requests, 0);
  assert.equal(h.intersections[0].disconnected, true);
});

test("unmount aborts land and ignores a late transport success", async (t) => {
  const oldRequest = deferred();
  let signal;
  let requests = 0;
  const data = {
    features: [
      {
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  };
  const h = await atlasHarness(t, {
    fetch: (path, options) => {
      requests++;
      signal = options.signal;
      return requests === 1
        ? oldRequest.promise
        : Promise.resolve(Response.json(data));
    },
  });
  await h.render();
  await h.unmount();
  assert.equal(signal.aborted, true);
  await h.flush(() => oldRequest.resolve(Response.json(data)));
  assert.equal(h.host.children.length, 0);
  const { loadLand } = await h.server.ssrLoadModule("/src/atlas/land.ts");
  assert.ok(await loadLand());
  assert.equal(requests, 2, "late result was not cached after cancellation");
});

test("visibility, reduced motion, compact framing and context loss survive recovery", async (t) => {
  const h = await atlasHarness(t);
  await h.render({ reduced: true, compact: true });
  assert.equal(h.scene.props.reduced, true);
  assert.equal(h.scene.props.framing, "panel");
  assert.equal(h.scene.props.interactive, false);
  assert.equal(h.scene.props.active, true);
  await h.flush(() => h.intersections[0].callback([{ isIntersecting: false }]));
  assert.equal(h.scene.props.active, false);
  await h.flush(() => {
    h.window.document.hidden = true;
    h.intersections[0].callback([{ isIntersecting: true }]);
  });
  assert.equal(h.scene.props.active, false);
  await h.flush(() => {
    h.window.document.hidden = false;
    h.window.document.dispatchEvent(new h.window.Event("visibilitychange"));
  });
  assert.equal(h.scene.props.active, true);
  await h.flush(() => h.scene.props.onLost());
  assert.ok(h.$(".flat-map"));
  assert.ok(h.$(".flat-note.is-compact"));
  await h.render({ retryKey: 1 });
  assert.ok(h.$('[data-testid="globe"]'));
  assert.equal(h.scene.props.reduced, true);
  assert.equal(h.scene.props.framing, "panel");
  assert.equal(h.scene.props.interactive, false);
  assert.deepEqual(h.failures, [false, true, false]);
});

test("repeated scene failures remain usable in flat view with reload guidance", async (t) => {
  const h = await atlasHarness(t, {
    loadGlobe: () => Promise.reject(new Error("Synthetic missing chunk")),
  });
  await h.render();
  await h.click(h.$(".flat-note button"));
  assert.ok(h.$(".flat-map"));
  assert.equal(h.$(".scene-loading"), null);
  assert.equal(h.scene.calls, 2, "no automatic retry loop");
  assert.match(h.$(".flat-note").textContent, /reload the page/i);
});
