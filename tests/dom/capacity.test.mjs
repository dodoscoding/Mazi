import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until, deferred } from "./feature-harness.mjs";

function capacity(message) {
  return Object.assign(new Error(message), {
    status: 400,
    code: "capacity_exceeded",
  });
}
function submit({ $, window }, selector) {
  $(selector).dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
}

const reviewPhoto = {
  id: "synthetic-review-photo",
  title: "Lake photograph",
  date: "2024-06-01",
  place: "Lake",
  date_basis: "source capture evidence",
  origin_count: 1,
  anniversary: false,
};
function reviewBase(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/review/timeline"))
    return { items: [reviewPhoto], total: 1001, next_offset: 30 };
  if (path.startsWith("/api/review/reviewed-pairs"))
    return [{ left: "first", right: "second", status: "dismissed" }];
  if (path.startsWith("/api/review/reviewed-events"))
    return [
      {
        title: "Reviewed picnic",
        status: "accepted",
        assets: ["first", "second"],
      },
    ];
  if (path.startsWith("/api/review/")) return [];
  throw Error(`Unexpected ${path}`);
}

test("review capacity keeps timeline and reviewed decisions available with honest summaries", async (t) => {
  let unavailable = true;
  const feature = await mountFeature(
    t,
    "archive",
    (path) => {
      if (unavailable && /^\/api\/review\/(duplicates|events)\?/.test(path))
        return capacity("Review set exceeds local limit");
      return reviewBase(path);
    },
    { realLifecycle: true },
  );
  const { $, root, window } = feature;
  let lost = 0;
  window.addEventListener("mazi:access-lost", () => lost++);
  await until(() => $("#timeline h3"), "timeline remains readable");
  await until(
    () => $("#reviewed-events h3"),
    "reviewed events remain readable",
  );
  assert.equal($("#reviewed-events h3").textContent, "Reviewed picnic");
  assert.match($("#reviewed-pairs").textContent, /Kept separate/);
  assert.match($("#duplicates").textContent, /10,000/);
  assert.match($("#events").textContent, /10,000/);
  assert.match($("#review-sub").textContent, /suggestions unavailable/);
  assert.doesNotMatch($("#duplicates").textContent, /No unreviewed/);
  assert.doesNotMatch($("#events").textContent, /No unreviewed/);
  assert.equal($("#done").hidden, true);
  assert.equal($("#more").hidden, false);
  assert.equal($("#workspace").hidden, false);
  assert.equal($("#signed-out").hidden, true);
  assert.equal(root.hidden, false);
  assert.equal(lost, 0);
  $("#timeline input[name=title]").value = "Unsaved correction";
  unavailable = false;
  $("#events button").click();
  $("#duplicates button").click();
  await until(
    () => $("#events").textContent === "No unreviewed event suggestions.",
    "events recovered",
  );
  await until(
    () => $("#duplicates").textContent === "No unreviewed suggestions.",
    "duplicates recovered",
  );
  assert.equal($("#timeline input[name=title]").value, "Unsaved correction");
  assert.doesNotMatch($("#review-sub").textContent, /suggestions unavailable/);
});

test("finishing the full review timeline cannot claim all caught up while suggestions are unavailable", async (t) => {
  const { $, root } = await mountFeature(
    t,
    "archive",
    (path) => {
      if (path.startsWith("/api/review/timeline")) {
        const offset = Number(
          new URL(path, "http://test").searchParams.get("offset"),
        );
        return {
          items: Array.from(
            { length: Math.min(30, 1001 - offset) },
            (_, i) => ({ ...reviewPhoto, id: `photo-${offset + i}` }),
          ),
          total: 1001,
          next_offset: offset + 30 < 1001 ? offset + 30 : null,
        };
      }
      if (/^\/api\/review\/(duplicates|events)\?/.test(path))
        return capacity("Review set exceeds local limit");
      return reviewBase(path);
    },
    { realLifecycle: true },
  );
  await until(
    () => root.querySelectorAll("#timeline h3").length === 30,
    "first page",
  );
  for (let loaded = 30; loaded < 1001; loaded += 30) {
    $("#more").click();
    await until(
      () =>
        root.querySelectorAll("#timeline h3").length ===
        Math.min(loaded + 30, 1001),
      "next timeline page",
    );
  }
  assert.equal($("#count").textContent, "1001 photographs");
  assert.equal($("#more").hidden, true);
  assert.equal($("#done").hidden, true);
  assert.match(
    $("#review-sub").textContent,
    /Duplicate suggestions unavailable/,
  );
  assert.match($("#review-sub").textContent, /Event suggestions unavailable/);
});

test("review suggestion retries stay locked while pending and preserve correction drafts", async (t) => {
  const pending = deferred();
  let retrying = false;
  const { $ } = await mountFeature(
    t,
    "archive",
    (path) => {
      if (path.startsWith("/api/review/events?"))
        return retrying
          ? pending.promise
          : capacity("Review set exceeds local limit");
      return reviewBase(path);
    },
    { realLifecycle: true },
  );
  await until(() => $("#events button"), "retry available");
  $("#timeline input[name=title]").value = "Keep my correction";
  retrying = true;
  const retry = $("#events button");
  retry.click();
  assert.equal(retry.disabled, true);
  retry.click();
  pending.resolve([]);
  await until(
    () => $("#events").textContent === "No unreviewed event suggestions.",
    "retry completed",
  );
  assert.equal($("#timeline input[name=title]").value, "Keep my correction");
});

for (const status of [401, 403]) {
  for (const name of ["archive"]) {
    test(`${name} ${status} still clears private input and reports access loss`, async (t) => {
      let denied = false;
      const feature = await mountFeature(
        t,
        name,
        (path) => {
          const target = "/api/review/timeline";
          if (denied && path.startsWith(target))
            return Object.assign(new Error("Access revoked"), { status });
          return reviewBase(path);
        },
        { realLifecycle: true },
      );
      const { $, root, window } = feature;
      let lost = 0;
      window.addEventListener("mazi:access-lost", () => lost++);
      await until(() => $("#timeline h3"), "private data ready");
      $("#query").value = "Private query";
      denied = true;
      submit(feature, "#search");
      await until(() => lost === 1, "access lost");
      assert.equal(root.hidden, true);
      assert.equal($("#query").value, "");
    });
  }
}
