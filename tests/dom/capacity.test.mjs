import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until, deferred } from "./feature-harness.mjs";

function capacity(message) {
  return Object.assign(new Error(message), {
    status: 400,
    code: "capacity_exceeded",
  });
}
const answerSettings = {
  group_enabled: true,
  contribution_enabled: true,
  local_processing_enabled: true,
  usage: { day_utc: "2026-10-19", requests: 0, daily_limit: 50 },
};
function submit({ $, window }, selector) {
  $(selector).dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
}

test("answer capacity explains the limit and preserves the question for recovery", async (t) => {
  let unavailable = true;
  const feature = await mountFeature(
    t,
    "answers",
    (path) => {
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/answers/state")) return answerSettings;
      if (path === "/api/answers/ask")
        return unavailable
          ? capacity(
              "Memory answers exceeded the local processing budget. No partial answer was returned.",
            )
          : {
              status: "abstained",
              message: "No matching source evidence.",
              uncertainty: [],
              coverage: "Synthetic archive",
              usage: answerSettings.usage,
            };
      throw Error(`Unexpected ${path}`);
    },
    { realLifecycle: true },
  );
  const { $, root, window } = feature;
  let lost = 0;
  window.addEventListener("mazi:access-lost", () => lost++);
  await until(() => !$("#ask").disabled, "ready to ask");
  $("#question").value = "When was the lake photograph?";
  submit(feature, "#ask-form");
  await until(
    () => $("#notice").textContent.includes("processing budget"),
    "capacity error",
  );
  assert.equal($("#answer-recovery")?.hidden, false);
  assert.match($("#answer-recovery").textContent, /processing budget/);
  assert.doesNotMatch($("#ask-form").textContent, /up to 1,000/);
  assert.match($("#ask-form").textContent, /three complete evidence checks/);
  assert.equal($("#answer-recovery a")?.getAttribute("href"), "#/memories");
  assert.equal($("#question").value, "When was the lake photograph?");
  assert.equal($("#ask").disabled, false);
  assert.equal(root.hidden, false);
  assert.equal(lost, 0);
  assert.equal($("#answer").textContent, "");
  assert.equal($("#evidence-panel").hidden, true);
  unavailable = false;
  submit(feature, "#ask-form");
  await until(
    () => $("#answer").textContent.includes("No matching source evidence."),
    "answer recovered",
  );
  assert.equal($("#answer-recovery").hidden, true);
});

test("answer processing exhaustion clears prior citations and allows an explicit retry", async (t) => {
  let requests = 0;
  const evidence = {
    id: "budget-photo",
    title: "Previously supported photograph",
    date: "2024-01-02",
    dates: ["2024-01-02"],
    date_basis: "source capture date",
    place: "Synthetic place",
    url: `/api/answers/evidence?group=${group.id}&asset=budget-photo`,
  };
  const feature = await mountFeature(
    t,
    "answers",
    (path) => {
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/answers/state")) return answerSettings;
      if (path === "/api/answers/ask") {
        requests++;
        if (requests === 2)
          return capacity(
            "Memory answers exceeded the local processing budget. No partial answer was returned.",
          );
        return {
          status: "supported",
          message: "Recorded evidence.",
          uncertainty: [],
          coverage: "Synthetic archive",
          usage: answerSettings.usage,
          claims: [{ text: "Recorded date.", evidence_ids: [evidence.id] }],
          evidence: [evidence],
          matching_records: 1001,
          shown: 1,
        };
      }
      throw Error(`Unexpected ${path}`);
    },
    { realLifecycle: true },
  );
  const { $ } = feature;
  await until(() => !$("#ask").disabled, "ready to ask");
  $("#question").value = "When was the photograph?";
  submit(feature, "#ask-form");
  await until(() => $("#answer .cite"), "prior supported evidence");
  assert.equal($("#evidence-panel").hidden, false);
  submit(feature, "#ask-form");
  await until(() => !$("#answer-recovery").hidden, "budget failure");
  assert.equal($("#answer").textContent, "");
  assert.equal($("#evidence-panel").hidden, true);
  assert.equal($("#evidence-list").textContent, "");
  assert.equal($("#question").value, "When was the photograph?");
  assert.equal($("#ask").disabled, false);
  assert.equal(requests, 2);
  submit(feature, "#ask-form");
  await until(() => $("#answer .cite"), "successful explicit retry");
  assert.equal(requests, 3);
  assert.equal($("#answer-recovery").hidden, true);
});

const discoveryState = {
  people: [],
  memories: [],
  hidden_memories: [],
  hidden: [],
  suppressed: [],
  identities: [],
  settings: {
    model_label: "Local search",
    model_message: "Synthetic local model",
    learned: true,
    model_ready: true,
    group_enabled: true,
    contribution_enabled: true,
  },
};
const searchPage = {
  items: [
    {
      id: "synthetic-photo",
      title: "Lake photograph",
      date: "2024-06-01",
      place: "Lake",
      people: [],
    },
  ],
  total: 1,
  next_offset: null,
  mode: "keyword",
  unindexed: 0,
};
function discoveryBase(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/discovery/state")) return discoveryState;
  if (path.startsWith("/api/atlas")) return { memories: [] };
  if (path.startsWith("/api/discovery/search")) return searchPage;
  throw Error(`Unexpected ${path}`);
}

test("search capacity clears stale results and offers browsing without losing filters", async (t) => {
  let unavailable = false;
  const feature = await mountFeature(
    t,
    "discovery",
    (path) => {
      if (path.startsWith("/api/discovery/search") && unavailable)
        return capacity("Local search limit is 1,000 items");
      return discoveryBase(path);
    },
    { realLifecycle: true },
  );
  const { $, root, window } = feature;
  let lost = 0;
  window.addEventListener("mazi:access-lost", () => lost++);
  await until(() => $("#results h3"), "initial photograph");
  $("#query").value = "lake";
  $("#place").value = "Lake";
  submit(feature, "#search-form");
  await until(
    () => $("#result-total").textContent === "1 result",
    "first query",
  );
  unavailable = true;
  submit(feature, "#search-form");
  await until(
    () => $("#notice").textContent.includes("1,000"),
    "capacity error",
  );
  assert.equal($("#search-recovery")?.hidden, false);
  assert.equal($("#search-recovery a")?.getAttribute("href"), "#/memories");
  assert.equal($("#count").textContent, "Search unavailable.");
  assert.equal($("#result-total").textContent, "");
  assert.equal($("#result-types").hidden, true);
  assert.equal($("#search-groups").hidden, true);
  assert.equal($("#search-none").hidden, true);
  assert.equal($("#search-loading").hidden, true);
  assert.equal($("#search-form button[type=submit]").disabled, false);
  assert.equal($("#query").value, "lake");
  assert.equal($("#place").value, "Lake");
  assert.equal(root.hidden, false);
  assert.equal(lost, 0);
  unavailable = false;
  submit(feature, "#search-form");
  await until(
    () => $("#results h3")?.textContent === "Lake photograph",
    "search recovered",
  );
  assert.equal($("#search-recovery").hidden, true);
  assert.equal($("#search-groups").hidden, false);
  assert.equal($("#notice").textContent, "");
});

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
  assert.match($("#duplicates").textContent, /1,000/);
  assert.match($("#events").textContent, /1,000/);
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

test("index capacity stops cleanly and retains browsing recovery until a retry succeeds", async (t) => {
  let unavailable = true;
  const { $, root } = await mountFeature(
    t,
    "discovery",
    (path) => {
      if (path === "/api/discovery/index")
        return unavailable
          ? capacity("Local index limit is 1,000 items")
          : { indexed: 1, remaining: 0 };
      return discoveryBase(path);
    },
    { realLifecycle: true },
  );
  await until(() => !$("#build-index").hidden, "index action ready");
  $("#query").value = "Keep this query";
  $("#build-index").click();
  await until(
    () => $("#notice").textContent.includes("1,000"),
    "index capacity error",
  );
  assert.equal($("#index-recovery")?.hidden, false);
  assert.equal($("#index-recovery a")?.getAttribute("href"), "#/memories");
  assert.match($("#index-progress").textContent, /stopped/i);
  assert.equal($("#build-index").disabled, false);
  assert.equal($("#stop-index").hidden, true);
  assert.equal($("#query").value, "Keep this query");
  assert.equal(root.hidden, false);
  unavailable = false;
  $("#build-index").click();
  await until(
    () => $("#index-progress").textContent.includes("1 photographs indexed"),
    "index retry succeeded",
  );
  assert.equal($("#index-recovery").hidden, true);
});

for (const status of [400, 503]) {
  test(`ordinary search ${status} stays retryable without claiming capacity`, async (t) => {
    let fail = false;
    const feature = await mountFeature(
      t,
      "discovery",
      (path) => {
        if (fail && path.startsWith("/api/discovery/search"))
          return Object.assign(new Error("Synthetic request failure"), {
            status,
          });
        return discoveryBase(path);
      },
      { realLifecycle: true },
    );
    const { $, root } = feature;
    await until(() => $("#results h3"), "initial search");
    fail = true;
    $("#query").value = "Retry this";
    submit(feature, "#search-form");
    await until(
      () => $("#notice").textContent === "Synthetic request failure",
      "ordinary error",
    );
    assert.equal($("#search-recovery").hidden, true);
    assert.equal($("#count").textContent, "Search unavailable.");
    assert.equal($("#query").value, "Retry this");
    assert.equal(root.hidden, false);
    fail = false;
    submit(feature, "#search-form");
    await until(
      () => $("#results h3")?.textContent === "Lake photograph",
      "ordinary recovery",
    );
    assert.equal($("#notice").textContent, "");
  });

  test(`ordinary answer ${status} does not claim the archive is too large`, async (t) => {
    const feature = await mountFeature(
      t,
      "answers",
      (path) => {
        if (path === "/api/groups") return [group];
        if (path.startsWith("/api/answers/state")) return answerSettings;
        if (path === "/api/answers/ask")
          return Object.assign(new Error("Synthetic answer failure"), {
            status,
          });
        throw Error(`Unexpected ${path}`);
      },
      { realLifecycle: true },
    );
    const { $, root } = feature;
    await until(() => !$("#ask").disabled, "answer ready");
    $("#question").value = "Keep my question";
    submit(feature, "#ask-form");
    await until(
      () => $("#notice").textContent === "Synthetic answer failure",
      "ordinary answer error",
    );
    assert.equal($("#answer-recovery").hidden, true);
    assert.equal($("#ask").disabled, false);
    assert.equal($("#question").value, "Keep my question");
    assert.equal(root.hidden, false);
  });
}

for (const status of [401, 403]) {
  for (const name of ["discovery", "archive"]) {
    test(`${name} ${status} still clears private input and reports access loss`, async (t) => {
      let denied = false;
      const feature = await mountFeature(
        t,
        name,
        (path) => {
          const target =
            name === "discovery"
              ? "/api/discovery/search"
              : "/api/review/timeline";
          if (denied && path.startsWith(target))
            return Object.assign(new Error("Access revoked"), { status });
          return name === "discovery" ? discoveryBase(path) : reviewBase(path);
        },
        { realLifecycle: true },
      );
      const { $, root, window } = feature;
      let lost = 0;
      window.addEventListener("mazi:access-lost", () => lost++);
      await until(
        () => $(name === "discovery" ? "#results h3" : "#timeline h3"),
        "private data ready",
      );
      $("#query").value = "Private query";
      denied = true;
      submit(feature, name === "discovery" ? "#search-form" : "#search");
      await until(() => lost === 1, "access lost");
      assert.equal(root.hidden, true);
      assert.equal($("#query").value, "");
    });
  }
}

test("an older search capacity failure cannot replace newer successful results", async (t) => {
  const old = deferred();
  const feature = await mountFeature(
    t,
    "discovery",
    (path) => {
      if (path.startsWith("/api/discovery/search")) {
        const term = new URL(path, "http://test").searchParams.get("query");
        if (term === "Old") return old.promise;
      }
      return discoveryBase(path);
    },
    { realLifecycle: true },
  );
  const { $ } = feature;
  await until(() => $("#results h3"), "initial search");
  $("#query").value = "Old";
  submit(feature, "#search-form");
  $("#query").value = "New";
  submit(feature, "#search-form");
  await until(
    () => $("#results h3")?.textContent === "Lake photograph",
    "new result",
  );
  old.resolve(capacity("Local search limit is 1,000 items"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal($("#query").value, "New");
  assert.equal($("#results h3").textContent, "Lake photograph");
  assert.equal($("#count").textContent, "1 photographs · keyword");
  assert.equal($("#search-recovery").hidden, true);
  assert.equal($("#notice").textContent, "");
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

test("stopping indexing waits for the current batch before another run can begin", async (t) => {
  const pending = deferred();
  let first = true;
  const { $ } = await mountFeature(
    t,
    "discovery",
    (path) => {
      if (path === "/api/discovery/index") {
        if (first) {
          first = false;
          return pending.promise;
        }
        return { indexed: 1, remaining: 0 };
      }
      return discoveryBase(path);
    },
    { realLifecycle: true },
  );
  await until(() => !$("#build-index").hidden, "index ready");
  $("#build-index").click();
  $("#stop-index").click();
  assert.equal($("#build-index").disabled, true);
  assert.match(
    $("#index-progress").textContent,
    /stopped after the current small batch/,
  );
  pending.resolve(capacity("Local index limit is 1,000 items"));
  await until(() => !$("#build-index").disabled, "stopped request settled");
  assert.equal($("#stop-index").hidden, true);
  assert.equal($("#index-recovery").hidden, true);
  assert.equal($("#notice").textContent, "");
  $("#build-index").click();
  await until(
    () => $("#index-progress").textContent.includes("1 photographs indexed"),
    "next run succeeded",
  );
});
