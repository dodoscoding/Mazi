import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { group, mountFeature, until, deferred } from "./feature-harness.mjs";
const item = (label) => ({
  id: label,
  title: label,
  date: "2020-01-02",
  place: "Paris",
  date_basis: "source capture evidence",
  origin_count: 1,
  anniversary: false,
});
function base(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/review/timeline"))
    return { items: [], total: 0, next_offset: null };
  if (path.startsWith("/api/review/")) return [];
  throw Error(`Unexpected ${path}`);
}
test("review search commits only the newest requested query", async (t) => {
  const requests = new Map();
  const { $, root, window } = await mountFeature(t, "archive", (path) => {
    if (path.startsWith("/api/review/timeline")) {
      const query = new URL(path, "http://test").searchParams.get("q");
      if (query) {
        const request = deferred();
        requests.set(query, request);
        return request.promise;
      }
    }
    return base(path);
  });
  await until(() => !$("#workspace").hidden, "review workspace");
  for (const query of ["Alpha", "Beta"]) {
    $("#query").value = query;
    $("#search").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  }
  await until(() => requests.size === 2, "both queries");
  requests
    .get("Beta")
    .resolve({ items: [item("Beta")], total: 1, next_offset: null });
  await until(
    () => $("#timeline h3")?.textContent === "Beta",
    "latest results",
  );
  requests
    .get("Alpha")
    .resolve({ items: [item("Alpha")], total: 1, next_offset: null });
  await delay(0);
  assert.deepEqual(
    [...root.querySelectorAll("#timeline h3")].map((node) => node.textContent),
    ["Beta"],
  );
  assert.equal($("#query").value, "Beta");
  assert.equal($("#count").textContent, "1 photographs");
});

test("an obsolete search error cannot replace successful newer results", async (t) => {
  const gate = deferred();
  const { $, window } = await mountFeature(t, "archive", (path) => {
    if (path.startsWith("/api/review/timeline")) {
      const query = new URL(path, "http://test").searchParams.get("q");
      if (query === "Old") return gate.promise;
      if (query === "New")
        return { items: [item("New")], total: 1, next_offset: null };
    }
    return base(path);
  });
  await until(() => !$("#workspace").hidden, "review workspace");
  for (const query of ["Old", "New"]) {
    $("#query").value = query;
    $("#search").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  }
  await until(() => $("#timeline h3")?.textContent === "New", "new results");
  gate.resolve(new Error("Obsolete search failure"));
  await delay(0);
  assert.equal($("#timeline h3").textContent, "New");
  assert.doesNotMatch($("#notice").textContent, /Obsolete/);
});

test("review load-more locks repeated requests and retries a failed cursor", async (t) => {
  let calls = 0;
  const gate = deferred();
  const offsets = [];
  const { $, root } = await mountFeature(t, "archive", (path) => {
    if (path.startsWith("/api/review/timeline")) {
      const offset = Number(
        new URL(path, "http://test").searchParams.get("offset"),
      );
      offsets.push(offset);
      if (!offset) return { items: [item("First")], total: 2, next_offset: 1 };
      calls++;
      return calls === 1
        ? gate.promise
        : { items: [item("Second")], total: 2, next_offset: null };
    }
    return base(path);
  });
  await until(() => $("#timeline h3"), "first page");
  $("#more").click();
  $("#more").click();
  await until(() => calls > 0, "next page requested");
  assert.equal(calls, 1);
  gate.resolve(new Error("Synthetic next-page failure"));
  await until(
    () => $("#notice").textContent.includes("Synthetic next-page failure"),
    "next page error",
  );
  $("#more").click();
  await until(
    () => root.querySelectorAll("#timeline h3").length === 2,
    "retried page",
  );
  assert.deepEqual(offsets, [0, 1, 1]);
  assert.deepEqual(
    [...root.querySelectorAll("#timeline h3")].map((node) => node.textContent),
    ["First", "Second"],
  );
});
