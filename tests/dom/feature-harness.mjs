import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "vite";
import { Window } from "happy-dom";

export const group = {
  id: "synthetic-circle",
  name: "Synthetic circle",
  role: "member",
};
export function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
export async function until(predicate, message) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail(message);
}
export async function mountFeature(
  t,
  name,
  boundary,
  { realLifecycle = false } = {},
) {
  const window = new Window({ url: `http://localhost/#/${name}` });
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
    "matchMedia",
  ]) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value:
        name === "window"
          ? window
          : name === "matchMedia"
            ? window.matchMedia.bind(window)
            : window[name],
      configurable: true,
      writable: true,
    });
  }
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const root = window.document.createElement("main");
  root.innerHTML = await readFile(
    new URL(`../../src/features/${name}/template.html`, import.meta.url),
    "utf8",
  );
  window.document.body.append(root);
  const dispose = [];
  const module = await server.ssrLoadModule(`/src/features/${name}/mount.js`);
  let lifecycle = {
    groupId: group.id,
    fetch: async (path, options) => {
      const value = await boundary(
        String(path),
        options?.body && JSON.parse(options.body),
      );
      return new Response(
        JSON.stringify(
          value instanceof Error
            ? { error: value.message, code: value.code }
            : value,
        ),
        {
          status: value instanceof Error ? value.status || 503 : 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
    selectGroup: (select) => {
      select.value = group.id;
      return select.value;
    },
    setInterval: () => 0,
    setTimeout: window.setTimeout.bind(window),
    URL: window.URL,
    onDispose: (callback) => dispose.push(callback),
  };
  if (realLifecycle) {
    window.fetch = lifecycle.fetch;
    window.sessionStorage.setItem("mazi.group", group.id);
    const { createLifecycle } = await server.ssrLoadModule(
      "/src/features/lifecycle.ts",
    );
    lifecycle = createLifecycle(root, "", () => {});
  }
  module.mount(root, lifecycle);
  t.after(async () => {
    lifecycle.dispose?.();
    dispose.forEach((callback) => callback());
    window.happyDOM.abort();
    await server.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return {
    window,
    root,
    lifecycle,
    $: (selector) => root.querySelector(selector),
  };
}
