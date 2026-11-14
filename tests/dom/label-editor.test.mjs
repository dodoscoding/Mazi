import assert from "node:assert/strict";
import test from "node:test";
import { atlasHarness } from "./atlas-harness.mjs";
const entry = (revision = 0) => ({
  value: "unknown",
  declared: "unknown",
  revision,
  method: null,
  actor: null,
});
function item(assetId, revision = 0) {
  return {
    assetId,
    people: [{ id: "person", name: "Ayşe" }],
    labels: {
      people_present: { ...entry(revision), value: "yes" },
      screenshot: entry(revision),
      ai: entry(revision),
    },
  };
}
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
async function mounted(t, boundary) {
  let dispose;
  t.after(() => dispose?.());
  const h = await atlasHarness(t);
  const { mountLabelEditor } = await h.server.ssrLoadModule(
    "/src/memory/labelEditor.ts",
  );
  const host = document.createElement("div");
  document.body.append(host);
  let closed = 0,
    saved = 0;
  dispose = mountLabelEditor(host, {
    group: "circle",
    assets: ["one", "two"],
    fetch: boundary,
    onClose: () => closed++,
    onSaved: () => saved++,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return {
    host,
    get closed() {
      return closed;
    },
    get saved() {
      return saved;
    },
  };
}
function choose(host) {
  const select = host.querySelectorAll("select")[1];
  select.value = "yes";
  select.dispatchEvent(new Event("change"));
}
async function save(host) {
  host
    .querySelector("form")
    .dispatchEvent(new Event("submit", { cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("atomic selection sends only chosen dimensions and retries an identical receipt after lost response", async (t) => {
  const writes = [];
  const ui = await mounted(t, async (path, options) => {
    if (options.method === "POST") {
      writes.push(options.body);
      if (writes.length === 1) throw Error("Lost response");
      return json({});
    }
    return json({ items: [item("one"), item("two")] });
  });
  assert.match(ui.host.textContent, /2 fotoğrafın etiketleri/);
  assert.match(ui.host.textContent, /İnsan var.*Beyan: Bilinmiyor/);
  assert.match(ui.host.textContent, /onaylı kişi etiketlerinden/);
  assert.equal(
    ui.host.querySelector("a").getAttribute("href"),
    "#/photos?person=person",
  );
  choose(ui.host);
  await save(ui.host);
  await save(ui.host);
  assert.equal(writes[0], writes[1]);
  assert.deepEqual(
    JSON.parse(writes[0]).items,
    ["one", "two"].map((asset) => ({
      asset,
      changes: { screenshot: "yes" },
      expected: { screenshot: 0 },
    })),
  );
  assert.equal(ui.saved, 1);
});

test("conflict reloads all selected revisions without discarding the draft", async (t) => {
  let reads = 0;
  const writes = [];
  const ui = await mounted(t, async (path, options) => {
    if (options.method === "POST") {
      writes.push(JSON.parse(options.body));
      return json({}, writes.length === 1 ? 409 : 200);
    }
    return json({ items: [item("one", reads), item("two", reads++)] });
  });
  choose(ui.host);
  await save(ui.host);
  assert.equal(ui.host.querySelectorAll("select")[1].value, "yes");
  assert.match(ui.host.textContent, /taslağınız korundu/);
  await save(ui.host);
  assert.equal(writes[1].items[0].expected.screenshot, 1);
  assert.notEqual(writes[0].request_key, writes[1].request_key);
});

test("group change clears selection drafts and ignores late write results", async (t) => {
  let resolve, signal;
  const ui = await mounted(t, async (path, options) => {
    if (options.method === "POST") {
      signal = options.signal;
      return new Promise((done) => (resolve = done));
    }
    return json({ items: [item("one"), item("two")] });
  });
  choose(ui.host);
  await save(ui.host);
  window.dispatchEvent(new Event("mazi:group"));
  assert.equal(signal.aborted, true);
  assert.equal(ui.host.textContent, "");
  resolve(json({}));
  await new Promise((done) => setTimeout(done, 0));
  assert.equal(ui.saved, 0);
});

test("access denial rereads the whole selection and removes drafts", async (t) => {
  let reads = 0;
  const ui = await mounted(t, async (path, options) => {
    if (options.method === "POST") return json({}, 403);
    return ++reads === 1
      ? json({ items: [item("one"), item("two")] })
      : json({}, 403);
  });
  choose(ui.host);
  await save(ui.host);
  assert.equal(reads, 2);
  assert.equal(ui.host.textContent, "");
  assert.equal(ui.saved, 0);
  assert.equal(ui.closed, 1);
});
