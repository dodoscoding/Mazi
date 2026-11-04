import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, StrictMode } from "react";
import { createServer } from "vite";
import { Window } from "happy-dom";

async function mount(
  t,
  modulePath,
  exportName,
  props,
  boundary = async () => Response.json({ items: [], next_cursor: null }),
) {
  const window = new Window({ url: "http://localhost/#/circle?section=plans" });
  const saved = new Map();
  const calls = [];
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    location: window.location,
    history: window.history,
    sessionStorage: window.sessionStorage,
    localStorage: window.localStorage,
    Event: window.Event,
    HTMLElement: window.HTMLElement,
    HTMLSelectElement: window.HTMLSelectElement,
    matchMedia: window.matchMedia.bind(window),
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (path, options) => {
      calls.push({ path: String(path), options });
      return boundary(String(path), options);
    },
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
  const module = await vite.ssrLoadModule(modulePath);
  const host = document.createElement("div");
  document.body.append(host);
  const { createRoot } = await import("react-dom/client");
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
  await act(async () =>
    root.render(
      createElement(StrictMode, null, createElement(module[exportName], props)),
    ),
  );
  return {
    window,
    host,
    calls,
    click: (element) => act(async () => element.click()),
    dispatch: (type) =>
      act(async () => window.dispatchEvent(new window.Event(type))),
  };
}

const target = { kind: "photo", id: "selected-asset" };
const props = { group: "circle", target, focus: true };
const comment = { id: "comment-1", target, author: { id: "alice", name: "Alice" }, text: "<img src=x onerror=alert(1)>", revision: 1, created_at: 1900000000, updated_at: 1900000000, editable: true };
const reaction = (target) => ({ target, total: 1, reactions: ["👍", "❤️", "😂", "🎉"].map((emoji) => ({ emoji, count: emoji === "❤️" ? 1 : 0, mine: emoji === "❤️", members: emoji === "❤️" ? [{ id: "ben", name: "Ben" }] : [], members_truncated: false })) });
const boundary = async (path) => path.startsWith("/api/social/comments?")
  ? Response.json({ items: [comment], total: 1, next_cursor: null })
  : Response.json({ items: [reaction(target), reaction({ kind: "comment", id: comment.id })] });
const button = (h, text) => [...h.host.querySelectorAll("button")].find((node) => node.textContent.trim() === text);

test("selected photo conversation batches only its visible page reactions and escapes plain text", async (t) => {
  const h = await mount(t, "/src/social/ConversationPanel.tsx", "default", props, boundary);
  assert.equal(h.host.querySelector("img"), null);
  assert.match(h.host.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(h.host.textContent, /Alice/);
  const batches = h.calls.filter(({ path }) => path.startsWith("/api/social/reactions/batch?"));
  assert.ok(batches.length);
  assert.deepEqual(JSON.parse(new URL(batches.at(-1).path, "http://localhost").searchParams.get("targets")), [target, { kind: "comment", id: "comment-1" }]);
  assert.equal(h.calls.some(({ path }) => path.startsWith("/api/social/reactions?")), false);
  assert.ok(h.host.querySelector('[aria-pressed="true"]'));
});

test("session loss clears conversation text, counts and private draft", async (t) => {
  const h = await mount(t, "/src/social/ConversationPanel.tsx", "default", props, boundary);
  assert.match(h.host.textContent, /Alice/);
  await h.dispatch("mazi:session");
  assert.doesNotMatch(h.host.textContent, /Alice|Ben|onerror/);
  assert.equal(h.host.querySelector("textarea"), null);
  assert.equal(h.host.querySelector('[aria-pressed]'), null);
});
