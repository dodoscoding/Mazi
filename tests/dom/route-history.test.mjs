import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";

async function harness(t, url) {
  const window = new Window({ url });
  const saved = new Map();
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    location: window.location,
    history: window.history,
    matchMedia: window.matchMedia.bind(window),
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
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
  const { useRoute, canGoBack } = await vite.ssrLoadModule("/src/useRoute.ts");
  let current;
  function Probe() {
    current = useRoute(true);
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
    canGoBack,
    get route() {
      return current.route;
    },
    navigate: (...args) => act(async () => current.navigate(...args)),
  };
}

test("a memory opened by a direct link has no in-app entry to go back to", async (t) => {
  const h = await harness(t, "http://localhost/#/memory/a");
  assert.equal(h.route.path, "/memory/a");
  assert.equal(h.canGoBack(), false);
  await h.navigate("/memory/a?photo=1", false, true);
  assert.equal(h.canGoBack(), false);
});

test("a memory opened from inside the app can go back, across photo changes", async (t) => {
  const h = await harness(t, "http://localhost/#/");
  await h.navigate("/timeline");
  await h.navigate("/memory/a");
  assert.equal(h.canGoBack(), true);
  await h.navigate("/memory/a?photo=2", false, true);
  assert.equal(h.canGoBack(), true);
});

test("a plain hash link from a feature page counts as an in-app entry", async (t) => {
  const h = await harness(t, "http://localhost/#/search");
  assert.equal(h.canGoBack(), false);
  await act(async () => {
    h.window.history.pushState(null, "", "#/memory/a");
    h.window.dispatchEvent(new h.window.Event("hashchange"));
  });
  assert.equal(h.route.path, "/memory/a");
  assert.equal(h.canGoBack(), true);
});

test("Atlas legacy links canonicalize to the opening Globe", async (t) => {
  const home = await harness(t, "http://localhost/?demo=1#/");
  assert.equal(home.route.path, "/");
  await home.navigate("/atlas?selected=lake-days&view=portal");
  assert.equal(home.route.path, "/");
  assert.equal(home.route.selected, "lake-days");
  assert.equal(home.route.search, "?selected=lake-days&view=portal");
});

test("legacy root selection links retain their Atlas state", async (t) => {
  const h = await harness(
    t,
    "http://localhost/?demo=1#/?selected=lake-days&view=portal",
  );
  assert.equal(h.route.path, "/");
  assert.equal(h.route.selected, "lake-days");
  assert.equal(h.route.search, "?selected=lake-days&view=portal");
  assert.equal(h.canGoBack(), false);
});

for (const [alias, path, search] of [
  ["people", "/settings", "?section=people"],
]) {
  for (const prefix of ["/", "/#/"]) {
    test(`${prefix}${alias} replaces the legacy entry without adding history`, async (t) => {
      const h = await harness(t, `http://localhost${prefix}${alias}`);
      assert.equal(h.route.path, path);
      assert.equal(h.route.search, search);
      assert.equal(h.window.location.hash, `#${path}${search}`);
      assert.equal(h.canGoBack(), false);
      assert.equal(h.window.history.length, 1);
    });
  }
}

test("aliases reached inside the app preserve the previous destination", async (t) => {
  const h = await harness(t, "http://localhost/#/explore");
  await h.navigate("/people");
  assert.equal(h.route.path, "/settings");
  assert.equal(h.window.history.length, 2);
  await act(async () => {
    h.window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(h.route.path, "/photos");
});

test("a People alias preserves search and sample parameters but owns its section", async (t) => {
  const h = await harness(
    t,
    "http://localhost/?demo=1#/people?q=ferry&source=discord&section=other",
  );
  assert.equal(h.route.path, "/settings");
  assert.equal(h.route.search, "?q=ferry&source=discord&section=people");
  assert.equal(h.window.location.search, "?demo=1");
  assert.equal(h.window.history.length, 1);
});

for (const prefix of ["/", "/#/"]) {
  test(`${prefix}settings is a real route without an alias history entry`, async (t) => {
    const h = await harness(t, `http://localhost${prefix}settings`);
    assert.equal(h.route.path, "/settings");
    assert.equal(h.route.search, "");
    assert.equal(h.window.history.length, 1);
  });
}

for (const [old, canonical] of [
  [
    "/timeline?year=2024&q=two%3Fwords&places=%5B%22Doe%2C+City%22%5D&photo=2",
    "/photos?year=2024&q=two%3Fwords&places=%5B%22Doe%2C+City%22%5D&photo=2&years=2024",
  ],
  [
    "/memories?story=exact-record&group=circle",
    "/past-creations?story=exact-record&group=circle",
  ],
  [
    "/memories?section=capsules&capsule=sealed",
    "/past-creations?capsule=sealed",
  ],
  [
    "/review?section=export&asset=original",
    "/settings?section=export&asset=original",
  ],
  [
    "/review?section=events&cursor=next",
    "/add?section=suggestions&cursor=next",
  ],
  [
    "/circle?section=plans&plan=actual-plan&group=foreign",
    "/settings?section=plans&plan=actual-plan&group=foreign&unavailable=plans",
  ],
])
  test(`old ${old} preserves its retained task and exact parameters`, async (t) => {
    const h = await harness(t, `http://localhost/#${old}`);
    assert.equal(h.window.location.hash, `#${canonical}`);
    assert.equal(h.canGoBack(), false);
  });

test("Discord outer query remains available to its captured controller and never enters canonical hash", async (t) => {
  const h = await harness(
    t,
    "http://localhost/places?code=private-code&state=private-state",
  );
  assert.equal(h.route.path, "/add");
  assert.equal(h.route.search, "?section=sources");
  assert.equal(
    h.window.location.search,
    "?code=private-code&state=private-state",
  );
  assert.equal(h.window.location.hash, "#/add?section=sources");
  assert.equal(h.canGoBack(), false);
});

test("a literal question mark inside a query does not truncate later bookmark parameters", async (t) => {
  const h = await harness(
    t,
    "http://localhost/#/photos?q=what?when&places=%5B%22Doe%2C+City%22%5D&bookmark=exact",
  );
  const params = new URLSearchParams(h.route.search);
  assert.equal(params.get("q"), "what?when");
  assert.equal(params.get("places"), '["Doe, City"]');
  assert.equal(params.get("bookmark"), "exact");
});
