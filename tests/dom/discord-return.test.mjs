import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "vite";
import { Window } from "happy-dom";
import { group, until } from "./feature-harness.mjs";

test("Discord return completes once across the React effect lifecycle", async (t) => {
  const window = new Window({
    url: "http://localhost/places?code=synthetic-code&state=synthetic-state",
  });
  const saved = new Map();
  for (const name of [
    "window",
    "document",
    "location",
    "MutationObserver",
    "Event",
    "FormData",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "sessionStorage",
    "navigator",
  ]) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value: name === "window" ? window : window[name],
      configurable: true,
      writable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  const posts = [];
  let linked = false;
  window.fetch = async (input, options) => {
    const path = String(input);
    let value;
    if (path === "/api/groups") value = [group];
    else if (path === "/api/sources/discord/link") {
      posts.push(JSON.parse(options.body));
      linked = true;
      value = { guild: { id: "77", name: "Lake house" } };
    } else if (path.startsWith("/api/sources/discord/guilds?"))
      value = linked ? [{ id: "77", name: "Lake house" }] : [];
    else if (path.startsWith("/api/sources/discord/channels?"))
      value = [{ id: "71", name: "photos" }];
    else if (path.startsWith("/api/places?"))
      value = { points: [], countries: [], cities: [], paths: [] };
    else if (path === "/land.geojson") value = { features: [] };
    else value = [];
    return Response.json(value);
  };
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const { FeaturePage } = await vite.ssrLoadModule("/src/features/index.tsx");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  t.after(async () => {
    await act(async () => root.unmount());
    await vite.close();
    window.happyDOM.abort();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  await act(async () =>
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(FeaturePage, {
          path: "/places?code=synthetic-code&state=synthetic-state",
        }),
      ),
    ),
  );
  await until(
    () => host.querySelector("#channel-list")?.textContent.includes("#photos"),
    "Discord channels appear after React effect replay",
  );
  assert.deepEqual(posts, [
    { code: "synthetic-code", state: "synthetic-state" },
  ]);
  assert.equal(window.location.search, "");
});
