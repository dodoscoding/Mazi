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
  t.after(() => vite.close());
  const module = await vite.ssrLoadModule(modulePath);
  const host = document.createElement("div");
  document.body.append(host);
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(host);
  t.after(async () => {
    await act(async () => root.unmount());
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
const comment = {
  id: "comment-1",
  target,
  author: { id: "alice", name: "Alice" },
  text: "<img src=x onerror=alert(1)>",
  revision: 1,
  created_at: 1900000000,
  updated_at: 1900000000,
  editable: true,
};
const reaction = (target) => ({
  target,
  total: 1,
  reactions: ["👍", "❤️", "😂", "🎉"].map((emoji) => ({
    emoji,
    count: emoji === "❤️" ? 1 : 0,
    mine: emoji === "❤️",
    members: emoji === "❤️" ? [{ id: "ben", name: "Ben" }] : [],
    members_truncated: false,
  })),
});
const boundary = async (path) =>
  path.startsWith("/api/social/comments?")
    ? Response.json({ items: [comment], total: 1, next_cursor: null })
    : Response.json({
        items: [
          reaction(target),
          reaction({ kind: "comment", id: comment.id }),
        ],
      });
const button = (h, text) =>
  [...h.host.querySelectorAll("button")].find(
    (node) => node.textContent.trim() === text,
  );

test("selected photo conversation batches only its visible page reactions and escapes plain text", async (t) => {
  const h = await mount(
    t,
    "/src/social/ConversationPanel.tsx",
    "default",
    props,
    boundary,
  );
  assert.equal(h.host.querySelector("img"), null);
  assert.match(h.host.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(h.host.textContent, /Alice/);
  const batches = h.calls.filter(({ path }) =>
    path.startsWith("/api/social/reactions/batch?"),
  );
  assert.ok(batches.length);
  assert.deepEqual(
    JSON.parse(
      new URL(batches.at(-1).path, "http://localhost").searchParams.get(
        "targets",
      ),
    ),
    [target, { kind: "comment", id: "comment-1" }],
  );
  assert.equal(
    h.calls.some(({ path }) => path.startsWith("/api/social/reactions?")),
    false,
  );
  assert.ok(h.host.querySelector('[aria-pressed="true"]'));
});

test("session loss clears conversation text, counts and private draft", async (t) => {
  const h = await mount(
    t,
    "/src/social/ConversationPanel.tsx",
    "default",
    props,
    boundary,
  );
  assert.match(h.host.textContent, /Alice/);
  await h.dispatch("mazi:session");
  assert.doesNotMatch(h.host.textContent, /Alice|Ben|onerror/);
  assert.equal(h.host.querySelector("textarea"), null);
  assert.equal(h.host.querySelector("[aria-pressed]"), null);
});

async function fill(h, text) {
  await act(async () => {
    const input = h.host.querySelector("textarea");
    Object.getOwnPropertyDescriptor(
      h.window.HTMLTextAreaElement.prototype,
      "value",
    ).set.call(input, text);
    input.dispatchEvent(new h.window.Event("input", { bubbles: true }));
    input.dispatchEvent(new h.window.Event("change", { bubbles: true }));
  });
}
const submit = (h) =>
  act(async () =>
    h.host
      .querySelector("form")
      .dispatchEvent(
        new h.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
  );

test("a lost write keeps its text and retries the identical command", async (t) => {
  let writes = 0;
  const h = await mount(
    t,
    "/src/social/ConversationPanel.tsx",
    "default",
    props,
    async (path, options) => {
      if (options.method === "POST") {
        if (++writes === 1) throw new TypeError("Lost response");
        return Response.json(comment);
      }
      return boundary(path);
    },
  );
  await fill(h, "Taslak burada");
  await submit(h);
  assert.equal(h.host.querySelector("textarea").value, "Taslak burada");
  assert.equal(h.host.querySelector("textarea").disabled, true);
  await h.click(button(h, "Aynı işlemi yeniden dene"));
  const writesSent = h.calls.filter(({ options }) => options.method === "POST");
  assert.equal(writesSent.length, 2);
  assert.equal(writesSent[0].options.body, writesSent[1].options.body);
  assert.equal(h.host.querySelector("textarea").value, "");
});

test("late reads and writes cannot restore comments after group or access loss", async (t) => {
  await t.test("late read", async (scope) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const h = await mount(
      scope,
      "/src/social/ConversationPanel.tsx",
      "default",
      props,
      async (path) => {
        await gate;
        return boundary(path);
      },
    );
    await h.dispatch("mazi:group");
    await act(async () => release());
    assert.doesNotMatch(h.host.textContent, /Alice|onerror/);
    assert.equal(h.host.querySelector("textarea"), null);
    assert.equal(h.host.querySelector("[aria-pressed]"), null);
  });
  await t.test("late write", async (scope) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const h = await mount(
      scope,
      "/src/social/ConversationPanel.tsx",
      "default",
      props,
      async (path, options) => {
        if (options.method === "POST") {
          await gate;
          return Response.json(comment);
        }
        return boundary(path);
      },
    );
    await fill(h, "Özel taslak");
    await submit(h);
    await h.dispatch("mazi:access-lost");
    await act(async () => release());
    assert.doesNotMatch(h.host.textContent, /Alice|Özel taslak|Kaydedildi/);
    assert.equal(h.host.querySelector("textarea"), null);
  });
});

test("a stale edit reloads current text without replacing its private draft", async (t) => {
  let changed = false;
  const h = await mount(
    t,
    "/src/social/ConversationPanel.tsx",
    "default",
    props,
    async (path, options) => {
      if (options.method === "POST") {
        changed = true;
        return Response.json({}, { status: 409 });
      }
      if (path.startsWith("/api/social/comments?"))
        return Response.json({
          items: [
            {
              ...comment,
              revision: changed ? 2 : 1,
              text: changed ? "Diğer sekme" : "İlk söz",
            },
          ],
          total: 1,
          next_cursor: null,
        });
      return boundary(path);
    },
  );
  await h.click(button(h, "Düzenle"));
  await fill(h, "Benim taslağım");
  await submit(h);
  await h.click(button(h, "Güncel yorumları yükle"));
  assert.match(h.host.textContent, /Diğer sekme/);
  assert.equal(h.host.querySelector("textarea").value, "Benim taslağım");
  await submit(h);
  const write = h.calls
    .filter(({ options }) => options.method === "POST")
    .at(-1);
  assert.equal(JSON.parse(write.options.body).revision, 2);
});

test("denied reaction batches discard a previously visible comment and every reaction", async (t) => {
  let gone = false;
  const h = await mount(
    t,
    "/src/social/ConversationPanel.tsx",
    "default",
    props,
    async (path) => {
      if (gone && path.startsWith("/api/social/reactions/batch"))
        return Response.json({}, { status: 403 });
      return boundary(path);
    },
  );
  gone = true;
  await h.dispatch("pageshow");
  assert.equal(h.host.querySelector("textarea"), null);
  assert.equal(h.host.querySelector("[aria-pressed]"), null);
  assert.doesNotMatch(h.host.textContent, /Alice|Ben|onerror/);
});
