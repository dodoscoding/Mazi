import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { mount } from "../../src/features/imports/mount.js";

import { Window } from "happy-dom";
const template = await readFile(
  new URL("../../src/features/imports/template.html", import.meta.url),
  "utf8",
);
const group = { id: "circle-a", name: "Synthetic circle", role: "admin" };
const history = {
  id: "older",
  source: "manual",
  state: "COMPLETED",
  created_at: 1,
};
function report(id, state = "COMPLETED", received = 400, size = 400) {
  return {
    id,
    source: "manual",
    state,
    received,
    size,
    discovered: 0,
    counts: {},
    unique_assets: 0,
    coverage: "Synthetic fixture",
    items: [],
    next_offset: null,
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function until(predicate, message) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail(message);
}
function setup(t, boundary) {
  const window = new Window({ url: "http://localhost/imports" });
  const saved = new Map();
  for (const name of [
    "window",
    "document",
    "location",
    "MutationObserver",
    "Event",
    "FormData",
  ]) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value: name === "window" ? window : window[name],
      configurable: true,
      writable: true,
    });
  }
  const root = window.document.createElement("main");
  root.innerHTML = template;
  window.document.body.append(root);
  const dispose = [];
  mount(root, {
    groupId: group.id,
    fetch: async (path, options) => {
      const value = await boundary(
        path,
        options?.body && JSON.parse(options.body),
      );
      return {
        ok: !(value instanceof Error),
        json: async () =>
          value instanceof Error ? { error: value.message } : value,
      };
    },
    setInterval: () => 0,
    setTimeout: window.setTimeout.bind(window),
    URL: window.URL,
    onDispose: (callback) => dispose.push(callback),
  });
  t.after(() => {
    dispose.forEach((callback) => callback());
    window.happyDOM.abort();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { window, root, $: (selector) => root.querySelector(selector) };
}
function baseResponse(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/imports?")) return [history];
  if (path.startsWith("/api/archive?")) return [];
  if (path.startsWith("/api/imports/older")) return report("older");
  throw new Error(`Unexpected request: ${path}`);
}

test("an upload uses its own resume offset while another report is selected", async (t) => {
  const uploadReport = deferred();
  let waitingForReport = false;
  let finished = false;
  const chunks = [];
  const { $, window } = setup(t, async (path, body) => {
    if (path === "/api/imports/start") return { id: "new-upload" };
    if (path.startsWith("/api/imports/new-upload")) {
      waitingForReport = true;
      await uploadReport.promise;
      return report("new-upload", "UPLOADING", 2, 6);
    }
    if (path === "/api/imports/chunk") {
      chunks.push(body);
      return { received: 6 };
    }
    if (path === "/api/imports/finish") {
      finished = true;
      return {};
    }
    return baseResponse(path);
  });
  await until(() => $(".history-row"), "history should load");
  const file = new window.File(
    [new Uint8Array([1, 2, 3, 4, 5, 6])],
    "synthetic.zip",
  );
  const transfer = new window.DataTransfer();
  transfer.items.add(file);
  $("input[name=file]").files = transfer.files;
  $("select[name=source]").value = "manual";
  $("#upload").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => waitingForReport, "upload report should be requested");
  $(".history-row").click();
  await until(
    () => $("#report-title").textContent.includes("completed"),
    "older report should remain usable during upload",
  );
  uploadReport.resolve();
  await until(() => !$("#upload-button").disabled, "upload should settle");
  assert.equal(
    finished,
    true,
    "the submitted upload must finish, regardless of the displayed report",
  );
  assert.deepEqual(chunks, [{ id: "new-upload", offset: 2, data: "AwQFBg==" }]);
  assert.match($("#report-title").textContent, /completed/);
  assert.equal($(".history-row").getAttribute("aria-current"), "true");
});

test("a workspace load failure offers a retry that restores the requested circle without duplicate history", async (t) => {
  let unavailable = true;
  const { $ } = setup(t, (path) => {
    if (path === "/api/groups")
      return unavailable
        ? new Error("Synthetic connection failure")
        : [{ id: "other", name: "Other circle" }, group];
    return baseResponse(path);
  });
  await until(
    () => $("#workspace-error") && !$("#workspace-error").hidden,
    "workspace failure must be visible",
  );
  assert.match(
    $("#workspace-error-text").textContent,
    /Synthetic connection failure/,
  );
  assert.equal($("#workspace").hidden, true);
  unavailable = false;
  $("#retry-workspace").click();
  await until(() => $(".history-row"), "retry should restore history");
  assert.equal($("#workspace-error").hidden, true);
  assert.equal($("#workspace").hidden, false);
  assert.equal($("#groups").value, "circle-a");
  assert.equal($("#imports").children.length, 1);
  assert.equal($("#groups").children.length, 2);
  await until(() => !$("#retry-workspace").disabled, "retry should finish");
  assert.equal(document.activeElement?.id, "page-title");
});

test("the submitted archive keeps its circle and source when the form changes during hashing", async (t) => {
  let started;
  let finished = false;
  const { $, window } = setup(t, (path, body) => {
    if (path === "/api/groups")
      return [group, { id: "circle-b", name: "Second circle" }];
    if (path === "/api/imports/start") {
      started = body;
      return { id: "captured" };
    }
    if (path.startsWith("/api/imports/captured"))
      return report("captured", "UPLOADING", 0, 3);
    if (path === "/api/imports/chunk") return { received: 3 };
    if (path === "/api/imports/finish") {
      finished = true;
      return {};
    }
    return baseResponse(path);
  });
  await until(() => $(".history-row"), "workspace should load");
  const transfer = new window.DataTransfer();
  transfer.items.add(
    new window.File([new Uint8Array([7, 8, 9])], "submitted.zip"),
  );
  $("input[name=file]").files = transfer.files;
  $("select[name=source]").value = "whatsapp";
  $("input[name=namespace]").value = "Submitted conversation";
  const dateOrder = $("select[name=date_order]");
  dateOrder.value = "DMY";
  $("#upload").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  $("#groups").value = "circle-b";
  $("#groups").dispatchEvent(new window.Event("change", { bubbles: true }));
  $("select[name=source]").value = "manual";
  $("input[name=namespace]").value = "Changed conversation";
  await until(() => !$("#upload-button").disabled, "upload should settle");
  assert.equal(finished, true);
  assert.equal(started.group, "circle-a");
  assert.equal(started.source, "whatsapp");
  assert.equal(started.namespace, "Submitted conversation");
  assert.equal(started.size, 3);
  assert.deepEqual(started.options, { date_order: "DMY" });
});

test("an already completed archive keeps its report without transferring again", async (t) => {
  const writes = [];
  const { $, window } = setup(t, (path, body) => {
    if (body) writes.push(path);
    if (path === "/api/imports/start") return { id: "older" };
    return baseResponse(path);
  });
  await until(() => $(".history-row"), "workspace should load");
  const transfer = new window.DataTransfer();
  transfer.items.add(new window.File([new Uint8Array(400)], "existing.zip"));
  $("input[name=file]").files = transfer.files;
  $("select[name=source]").value = "manual";
  $("#upload").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(
    () => !$("#upload-button").disabled,
    "deduplicated upload should settle",
  );
  assert.deepEqual(writes, ["/api/imports/start"]);
  assert.match($("#notice").textContent, /Existing import found/);
  assert.match($("#report-title").textContent, /completed/);
  assert.equal($("#imports").children.length, 1);
});

test("overlapping gallery refreshes keep only the newest page and cursor", async (t) => {
  const gate = deferred();
  let archiveCalls = 0;
  const offsets = [];
  const asset = (id) => ({
    id,
    origins: [],
    origin_count: 0,
    next_origin_offset: null,
  });
  const { $, root } = setup(t, async (path) => {
    if (path.startsWith("/api/archive?")) {
      offsets.push(
        Number(new URL(path, "http://test").searchParams.get("offset")),
      );
      archiveCalls++;
      if (archiveCalls === 2) await gate.promise;
      return Array.from({ length: 30 }, (_, index) => asset(`asset-${index}`));
    }
    return baseResponse(path);
  });
  await until(
    () => root.querySelectorAll("#gallery article").length === 30,
    "initial gallery",
  );
  $("#refresh-gallery").click();
  await until(() => archiveCalls === 2, "delayed refresh");
  $("#refresh-gallery").click();
  await until(
    () => root.querySelectorAll("#gallery article").length === 30,
    "newer refresh",
  );
  gate.resolve();
  await delay(0);
  assert.equal(root.querySelectorAll("#gallery article").length, 30);
  $("#more").click();
  await until(() => archiveCalls === 4, "next page request");
  assert.equal(offsets.at(-1), 30);
});

test("a late report page cannot replace the most recently requested page", async (t) => {
  const gate = deferred();
  let waiting = false;
  let page100Calls = 0;
  const { $ } = setup(t, async (path) => {
    if (path.startsWith("/api/imports/older")) {
      const offset = Number(
        new URL(path, "http://test").searchParams.get("offset"),
      );
      if (offset === 200) {
        waiting = true;
        await gate.promise;
      }
      if (offset === 100) page100Calls++;
      return {
        ...report("older"),
        items: [
          {
            filename: `page-${offset}`,
            outcome: "AVAILABLE_TO_GROUP",
            reason: "",
            warnings: [],
          },
        ],
        next_offset: offset + 100,
      };
    }
    return baseResponse(path);
  });
  await until(() => $(".history-row"), "history");
  $(".history-row").click();
  await until(() => $("#items").textContent.includes("page-0"), "first page");
  $("#next").click();
  await until(() => $("#items").textContent.includes("page-100"), "next page");
  $("#next").click();
  await until(() => waiting, "delayed next page");
  $("#previous").click();
  await until(() => page100Calls === 2, "previous page requested last");
  await delay(0);
  gate.resolve();
  await delay(0);
  assert.match($("#items").textContent, /page-100/);
  assert.doesNotMatch($("#items").textContent, /page-200/);
});

test("repeated load-more clicks request and append each gallery page once", async (t) => {
  const gate = deferred();
  const offsets = [];
  const { $, root } = setup(t, async (path) => {
    if (path.startsWith("/api/archive?")) {
      const offset = Number(
        new URL(path, "http://test").searchParams.get("offset"),
      );
      offsets.push(offset);
      if (offset === 30) await gate.promise;
      return Array.from({ length: 30 }, (_, index) => ({
        id: `asset-${offset + index}`,
        origins: [],
        origin_count: 0,
        next_origin_offset: null,
      }));
    }
    return baseResponse(path);
  });
  await until(
    () => root.querySelectorAll("#gallery article").length === 30,
    "first page",
  );
  $("#more").click();
  $("#more").click();
  await until(() => offsets.includes(30), "next page");
  gate.resolve();
  await until(
    () => root.querySelectorAll("#gallery article").length === 60,
    "second page",
  );
  await delay(0);
  assert.deepEqual(offsets, [0, 30]);
  assert.equal(
    new Set(
      [...root.querySelectorAll("#gallery img")].map((image) => image.src),
    ).size,
    60,
  );
});

test("a failed load-more request releases the control and retries the same cursor", async (t) => {
  const offsets = [];
  let failed = false;
  const { $, root } = setup(t, (path) => {
    if (path.startsWith("/api/archive?")) {
      const offset = Number(
        new URL(path, "http://test").searchParams.get("offset"),
      );
      offsets.push(offset);
      if (offset === 30 && !failed) {
        failed = true;
        return new Error("Synthetic page failure");
      }
      return Array.from({ length: 30 }, (_, index) => ({
        id: `asset-${offset + index}`,
        origins: [],
        origin_count: 0,
        next_origin_offset: null,
      }));
    }
    return baseResponse(path);
  });
  await until(
    () => root.querySelectorAll("#gallery article").length === 30,
    "first page",
  );
  $("#more").click();
  await until(
    () => $("#notice").textContent.includes("Synthetic page failure"),
    "visible failure",
  );
  assert.equal(root.querySelectorAll("#gallery article").length, 30);
  $("#more").click();
  await until(
    () => root.querySelectorAll("#gallery article").length === 60,
    "retry next page",
  );
  assert.deepEqual(offsets, [0, 30, 30]);
});

test("source-record pagination prevents duplicate requests and can retry a failure", async (t) => {
  const gate = deferred();
  let calls = 0;
  const { $, root } = setup(t, async (path) => {
    if (path.startsWith("/api/archive?"))
      return [
        {
          id: "asset",
          origins: [],
          origin_count: 101,
          next_origin_offset: 100,
        },
      ];
    if (path === "/api/archive/asset/origins?offset=100") {
      calls++;
      if (calls === 1) {
        await gate.promise;
        return new Error("Synthetic source-page failure");
      }
      return {
        items: [
          {
            source_type: "manual",
            sender: { label: "Synthetic source" },
            shared_at_assertion: {},
            capture_assertions: [],
            context: [],
            reactions: [],
            warnings: [],
          },
        ],
        next_offset: null,
      };
    }
    return baseResponse(path);
  });
  await until(() => $("#gallery button"), "source pagination");
  const more = $("#gallery button");
  more.click();
  more.click();
  await until(() => calls > 0, "source request");
  assert.equal(calls, 1);
  gate.resolve();
  await until(
    () => $("#notice").textContent.includes("Synthetic source-page failure"),
    "source failure",
  );
  assert.equal(more.disabled, false);
  more.click();
  await until(
    () => root.querySelectorAll(".source-records p").length === 1,
    "one source record",
  );
  assert.equal(calls, 2);
  assert.equal(more.hidden, true);
});
