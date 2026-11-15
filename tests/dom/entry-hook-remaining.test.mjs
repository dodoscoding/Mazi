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
    location: window.location,
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
  const { useEntry } = await vite.ssrLoadModule("/src/useEntry.ts");
  let current;
  function Probe() {
    current = useEntry();
    return createElement("p", null, current.state.status);
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
    render: () => act(async () => root.render(createElement(Probe))),
  };
}
const profile = {
  user_id: "member",
  group_id: "circle",
  introduced: true,
  display_name: "Synthetic",
};
async function visibility(h, hidden) {
  await act(async () => {
    Object.defineProperty(h.window.document, "hidden", {
      value: hidden,
      configurable: true,
    });
    h.window.document.dispatchEvent(new h.window.Event("visibilitychange"));
  });
}

test("ordinary route stays ready while hidden and during pending foreground recheck", async (t) => {
  const pending = deferred();
  let calls = 0;
  const h = await harness(t, async () =>
    ++calls === 1 ? Response.json(profile) : pending.promise,
  );
  await h.render();
  await visibility(h, true);
  assert.equal(h.current.state.status, "ready");
  await visibility(h, false);
  assert.equal(calls, 2);
  assert.equal(h.current.state.status, "ready");
  await act(async () => pending.resolve(Response.json(profile)));
  assert.equal(h.current.state.status, "ready");
});

for (const failure of ["network", "503"]) {
  test(`quiet foreground ${failure} failure retains authenticated view`, async (t) => {
    let calls = 0;
    const h = await harness(t, async () => {
      if (++calls === 1) return Response.json(profile);
      if (failure === "network") throw Error("offline");
      return Response.json({ error: "Unavailable" }, { status: 503 });
    });
    await h.render();
    await visibility(h, false);
    assert.equal(h.current.state.status, "ready");
    assert.equal(h.current.state.profile.user_id, "member");
  });
}

for (const change of ["401", "403", "identity", "group"]) {
  test(`foreground ${change} broadcasts access loss and clears authentication`, async (t) => {
    let calls = 0,
      lost = 0;
    const h = await harness(t, async () => {
      if (++calls === 1) return Response.json(profile);
      if (change === "401" || change === "403")
        return Response.json({ error: "Denied" }, { status: Number(change) });
      return Response.json({
        ...profile,
        ...(change === "identity"
          ? { user_id: "other" }
          : { group_id: "other" }),
      });
    });
    h.window.addEventListener("mazi:access-lost", () => lost++);
    await h.render();
    await visibility(h, false);
    assert.equal(lost, 1);
    assert.equal(h.current.state.status, "signed-out");
    assert.equal(h.window.sessionStorage.getItem("mazi.group"), null);
  });
}

test("late session success cannot restore access after explicit denial", async (t) => {
  const pending = deferred();
  let calls = 0,
    signal;
  const h = await harness(t, async (_path, options) => {
    if (++calls === 1) return Response.json(profile);
    signal = options.signal;
    return pending.promise;
  });
  await h.render();
  await visibility(h, false);
  await act(async () =>
    h.window.dispatchEvent(new h.window.Event("mazi:access-lost")),
  );
  assert.equal(signal.aborted, true);
  await act(async () => pending.resolve(Response.json(profile)));
  assert.equal(h.current.state.status, "signed-out");
});

test("pagehide retains entry while a quiet session response finishes", async (t) => {
  const pending = deferred();
  let calls = 0;
  const h = await harness(t, async () =>
    ++calls === 1 ? Response.json(profile) : pending.promise,
  );
  await h.render();
  await visibility(h, false);
  await act(async () => h.window.dispatchEvent(new h.window.Event("pagehide")));
  assert.equal(h.current.state.status, "ready");
  await act(async () => pending.resolve(Response.json(profile)));
  assert.equal(h.current.state.status, "ready");
});

for (const status of [401, 403]) {
  test(`non-JSON ${status} during quiet recheck still invalidates access`, async (t) => {
    let calls = 0,
      lost = 0;
    const h = await harness(t, async () =>
      ++calls === 1
        ? Response.json(profile)
        : new Response("<html>Denied</html>", {
            status,
            headers: { "Content-Type": "text/html" },
          }),
    );
    h.window.addEventListener("mazi:access-lost", () => lost++);
    await h.render();
    await visibility(h, false);
    assert.equal(lost, 1);
    assert.equal(h.current.state.status, "signed-out");
    assert.equal(h.window.sessionStorage.getItem("mazi.group"), null);
  });
}

test("same-scope quiet session success preserves the selected group", async (t) => {
  const h = await harness(t, async () => Response.json(profile));
  await h.render();
  h.window.sessionStorage.setItem("mazi.group", "selected-circle");
  await visibility(h, false);
  assert.equal(h.current.state.status, "ready");
  assert.equal(
    h.window.sessionStorage.getItem("mazi.group"),
    "selected-circle",
  );
});

test("explicit access loss forgets the selected group", async (t) => {
  const h = await harness(t, async () => Response.json(profile));
  await h.render();
  await act(async () =>
    h.window.dispatchEvent(new h.window.Event("mazi:access-lost")),
  );
  assert.equal(h.current.state.status, "signed-out");
  assert.equal(h.window.sessionStorage.getItem("mazi.group"), null);
});

test("initial session denial stays blank and allows a later quiet session check", async (t) => {
  let calls = 0,
    lost = 0;
  const h = await harness(t, async () =>
    ++calls === 1
      ? new Response("Denied", { status: 403 })
      : Response.json(profile),
  );
  h.window.addEventListener("mazi:access-lost", () => lost++);
  await h.render();
  assert.equal(h.current.state.status, "signed-out");
  assert.equal(h.current.state.error, "");
  assert.equal(lost, 0);
  await visibility(h, false);
  assert.equal(calls, 2);
  assert.equal(h.current.state.status, "ready");
});

for (const error of ["WRONG_CODE", "REMOVED"]) {
  test(`entry 403 preserves ${error} and does not broadcast access loss`, async (t) => {
    let lost = 0;
    const h = await harness(t, async (path) =>
      Response.json(
        { error: path === "/api/entry" ? error : "Denied" },
        { status: 403 },
      ),
    );
    h.window.addEventListener("mazi:access-lost", () => lost++);
    await h.render();
    await act(async () => h.current.enter("Synthetic", "wrong"));
    assert.equal(h.current.state.status, "signed-out");
    assert.equal(h.current.state.error, error);
    assert.equal(lost, 0);
    const settled = h.current.state;
    await visibility(h, false);
    assert.equal(h.current.state, settled);
  });
}

for (const screen of ["signed-out", "error", "onboarding"]) {
  test(`quiet pending recheck and outage retain settled ${screen} screen`, async (t) => {
    const pending = deferred();
    let calls = 0;
    const h = await harness(t, async () => {
      if (++calls > 1) return pending.promise;
      if (screen === "onboarding")
        return Response.json({ ...profile, introduced: false });
      return Response.json(
        { error: "Unavailable" },
        { status: screen === "signed-out" ? 403 : 503 },
      );
    });
    await h.render();
    const settled = h.current.state;
    assert.equal(settled.status, screen);
    await visibility(h, false);
    assert.equal(h.current.state, settled);
    await act(async () =>
      pending.resolve(Response.json({ error: "Unavailable" }, { status: 503 })),
    );
    assert.equal(h.current.state, settled);
  });
}

for (const outcome of ["success", "error"]) {
  for (const passive of ["401", "503", "network"]) {
    test(`passive ${passive} check cannot supersede pending entry ${outcome}`, async (t) => {
      const pending = deferred();
      let sessionCalls = 0,
        entrySignal;
      const h = await harness(t, async (path, options) => {
        if (path === "/api/entry") {
          entrySignal = options.signal;
          return pending.promise;
        }
        if (++sessionCalls === 1)
          return new Response("Denied", { status: 403 });
        if (passive === "network") throw Error("offline");
        return Response.json(
          { error: "Unavailable" },
          { status: Number(passive) },
        );
      });
      await h.render();
      let submitted;
      await act(async () => {
        submitted = h.current.enter("Synthetic", "code");
      });
      assert.equal(h.current.state.pending, true);
      await visibility(h, true);
      await visibility(h, false);
      await act(async () => {
        pending.resolve(
          outcome === "success"
            ? Response.json(profile)
            : Response.json({ error: "WRONG_CODE" }, { status: 403 }),
        );
        await submitted;
      });
      assert.equal(
        h.current.state.status,
        outcome === "success" ? "ready" : "signed-out",
      );
      assert.notEqual(h.current.state.pending, true);
      if (outcome === "error")
        assert.equal(h.current.state.error, "WRONG_CODE");
      assert.equal(entrySignal.aborted, false);
      assert.equal(sessionCalls, 1);
      await visibility(h, false);
      assert.equal(sessionCalls, 2);
    });
  }
}
