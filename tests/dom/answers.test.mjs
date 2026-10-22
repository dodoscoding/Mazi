import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { group, mountFeature, until, deferred } from "./feature-harness.mjs";

const settings = {
  group_enabled: true,
  contribution_enabled: true,
  local_processing_enabled: true,
  usage: { day_utc: "2026-10-19", requests: 0, daily_limit: 50 },
};
function answer(requests = 1, message = "Synthetic answer") {
  return {
    status: "abstained",
    message,
    uncertainty: [],
    coverage: "Synthetic archive",
    usage: { ...settings.usage, requests },
  };
}
function submit({ $, window }) {
  $("#ask-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
}
function change({ $, window }, id, checked) {
  $(id).checked = checked;
  $(id).dispatchEvent(new window.Event("change"));
}

test("changing answer consent settles a pending answer and permits a later question", async (t) => {
  const pending = deferred();
  let state = structuredClone(settings);
  let requests = 0;
  let reads = 0;
  const feature = await mountFeature(t, "answers", (path, body) => {
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/answers/state")) {
      reads++;
      return structuredClone(state);
    }
    if (path === "/api/answers/processing") {
      state.contribution_enabled = body.enabled;
      return { ok: true };
    }
    if (path === "/api/answers/ask") {
      requests++;
      return requests === 1 ? pending.promise : answer(2, "Later answer");
    }
    throw Error(`Unexpected ${path}`);
  });
  const { $ } = feature;
  await until(() => !$("#private").hidden, "answer permissions");
  $("#question").value = "When was the synthetic photograph?";
  submit(feature);
  await until(() => requests === 1, "pending answer");
  change(feature, "#personal", false);
  await until(
    () => reads === 2 && !$("#personal").disabled && !$("#personal").checked,
    "consent off",
  );
  change(feature, "#personal", true);
  await until(
    () => reads === 3 && !$("#personal").disabled && $("#personal").checked,
    "consent on",
  );
  assert.equal($("#ask").disabled, false);
  assert.equal($("#question").value, "When was the synthetic photograph?");
  pending.resolve(answer());
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal($("#answer").textContent, "");
  submit(feature);
  await until(
    () => $("#answer").textContent.includes("Later answer"),
    "later answer",
  );
  assert.equal($("#ask").disabled, false);
});

for (const prerequisite of [
  "local_processing_enabled",
  "group_enabled",
  "contribution_enabled",
]) {
  test(`missing ${prerequisite} prevents an answer without losing the session`, async (t) => {
    let requests = 0;
    let writes = 0;
    const feature = await mountFeature(
      t,
      "answers",
      (path) => {
        if (path === "/api/groups") return [group];
        if (path.startsWith("/api/answers/state"))
          return { ...settings, [prerequisite]: false };
        if (path === "/api/answers/processing") {
          writes++;
          return { ok: true };
        }
        if (path === "/api/answers/ask") {
          requests++;
          return Object.assign(new Error("Processing is disabled"), {
            status: 403,
          });
        }
        throw Error(`Unexpected ${path}`);
      },
      { realLifecycle: true },
    );
    const { $, root, window } = feature;
    let lost = 0;
    window.addEventListener("mazi:access-lost", () => lost++);
    await until(() => !$("#private").hidden, "answer permissions");
    $("#question").value = "Keep my question";
    assert.equal($("#ask").disabled, true);
    assert.ok($("#eligibility").textContent.length > 0);
    submit(feature);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(requests, 0);
    assert.equal(writes, 0);
    assert.equal(lost, 0);
    assert.equal(root.hidden, false);
    assert.equal($("#question").value, "Keep my question");
  });
}

for (const olderFinishesFirst of [true, false]) {
  test(`Stop preserves the question and fences late answers (${olderFinishesFirst ? "older" : "newer"} finishes first)`, async (t) => {
    const older = deferred();
    const newer = deferred();
    let requests = 0;
    const feature = await mountFeature(t, "answers", (path) => {
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/answers/state")) return settings;
      if (path === "/api/answers/ask") {
        requests++;
        return requests === 1 ? older.promise : newer.promise;
      }
      throw Error(`Unexpected ${path}`);
    });
    const { $ } = feature;
    await until(() => !$("#private").hidden, "answer permissions");
    $("#question").value = "First question";
    submit(feature);
    submit(feature);
    await until(() => requests > 0, "pending answer");
    assert.equal(requests, 1);
    $("#answer button").click();
    assert.equal($("#question").value, "First question");
    assert.equal($("#ask").disabled, false);
    $("#question").value = "Second question";
    submit(feature);
    await until(() => requests === 2, "new answer");
    if (olderFinishesFirst) {
      older.resolve(answer(1, "Old result"));
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal($("#ask").disabled, true);
      assert.equal($("#answer").textContent.includes("Old result"), false);
    }
    newer.resolve(answer(2, "New result"));
    await until(
      () => $("#answer").textContent.includes("New result"),
      "new result",
    );
    if (!olderFinishesFirst) {
      older.resolve(answer(1, "Old result"));
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok($("#answer").textContent.includes("New result"));
    assert.equal($("#answer").textContent.includes("Old result"), false);
    assert.match($("#usage").textContent, /^2 \/ 50/);
    assert.equal($("#ask").disabled, false);
  });
}

test("failed consent writes keep asking gated until permissions can be checked again", async (t) => {
  const retryState = deferred();
  let reads = 0;
  let requests = 0;
  const feature = await mountFeature(t, "answers", (path) => {
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/answers/state")) {
      reads++;
      if (reads === 1) return settings;
      if (reads === 2) return new Error("Synthetic permission read failure");
      return retryState.promise;
    }
    if (path === "/api/answers/processing")
      return new Error("Synthetic settings failure");
    if (path === "/api/answers/ask") {
      requests++;
      return answer();
    }
    throw Error(`Unexpected ${path}`);
  });
  const { $ } = feature;
  await until(() => !$("#private").hidden, "answer permissions");
  $("#question").value = "Preserve this question";
  change(feature, "#personal", false);
  await until(
    () => $("#notice").textContent.includes("failure"),
    "settings failure",
  );
  assert.equal($("#ask").disabled, true);
  submit(feature);
  assert.equal(requests, 0);
  await until(
    () => $("#retry-permissions") && !$("#retry-permissions").hidden,
    "permission retry",
  );
  assert.equal($("#question").value, "Preserve this question");
  $("#retry-permissions").click();
  await until(() => reads === 3, "retry checks canonical permissions");
  assert.equal($("#ask").disabled, true);
  retryState.resolve(settings);
  await until(() => !$("#ask").disabled, "permission recovery");
  assert.equal($("#personal").checked, true);
  assert.equal($("#question").value, "Preserve this question");
  submit(feature);
  await until(
    () => $("#answer").textContent.includes("Synthetic answer"),
    "answer after retry",
  );
});

test("unknown permissions block submission and can recover after an initial read failure", async (t) => {
  const pending = deferred();
  let reads = 0;
  let requests = 0;
  const feature = await mountFeature(t, "answers", (path) => {
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/answers/state")) {
      reads++;
      return reads === 1 ? pending.promise : settings;
    }
    if (path === "/api/answers/ask") {
      requests++;
      return answer();
    }
    throw Error(`Unexpected ${path}`);
  });
  const { $ } = feature;
  await until(() => reads === 1, "permissions pending");
  $("#question").value = "Question during loading";
  assert.equal($("#ask").disabled, true);
  assert.equal($("#personal").disabled, true);
  submit(feature);
  assert.equal(requests, 0);
  pending.resolve(new Error("Synthetic offline permission check"));
  await until(() => !$("#retry-permissions").hidden, "retry available");
  assert.equal($("#ask").disabled, true);
  $("#retry-permissions").click();
  await until(() => !$("#ask").disabled, "permissions recovered");
  assert.equal($("#question").value, "Question during loading");
});

test("an ordinary answer error preserves the question for explicit retry", async (t) => {
  let requests = 0;
  const feature = await mountFeature(
    t,
    "answers",
    (path) => {
      if (path === "/api/groups") return [group];
      if (path.startsWith("/api/answers/state")) return settings;
      if (path === "/api/answers/ask") {
        requests++;
        return requests === 1
          ? new Error("Synthetic offline answer")
          : answer();
      }
      throw Error(`Unexpected ${path}`);
    },
    { realLifecycle: true },
  );
  const { $, root } = feature;
  await until(() => !$("#ask").disabled, "ready to ask");
  $("#question").value = "My retryable question";
  submit(feature);
  await until(
    () => $("#notice").textContent === "Synthetic offline answer",
    "answer failed",
  );
  assert.equal($("#question").value, "My retryable question");
  assert.equal($("#ask").disabled, false);
  assert.equal(root.hidden, false);
  submit(feature);
  await until(
    () => $("#answer").textContent.includes("Synthetic answer"),
    "answer retry",
  );
});

for (const status of [401, 403]) {
  for (const operation of ["ask", "processing"]) {
    test(`real lifecycle still clears private input on ${operation} ${status}`, async (t) => {
      let reads = 0;
      const feature = await mountFeature(
        t,
        "answers",
        (path) => {
          if (path === "/api/groups") return [group];
          if (path.startsWith("/api/answers/state")) {
            reads++;
            return settings;
          }
          if (path === `/api/answers/${operation}`)
            return Object.assign(new Error("Access revoked"), { status });
          throw Error(`Unexpected ${path}`);
        },
        { realLifecycle: true },
      );
      const { $, root, window } = feature;
      let lost = 0;
      window.addEventListener("mazi:access-lost", () => lost++);
      await until(() => !$("#ask").disabled, "ready to ask");
      $("#question").value = "Private question";
      if (operation === "ask") submit(feature);
      else change(feature, "#personal", false);
      await until(() => lost === 1, "access-loss event");
      assert.equal(root.hidden, true);
      assert.equal($("#question").value, "");
      assert.equal($("#personal").checked, false);
      assert.equal(reads, 1);
    });
  }
}

test("a stale settings write cannot clear another group's current answer", async (t) => {
  const write = deferred();
  const otherGroup = { ...group, id: "other-circle", name: "Other circle" };
  let writes = 0;
  const feature = await mountFeature(
    t,
    "answers",
    (path) => {
      if (path === "/api/groups") return [group, otherGroup];
      if (path.startsWith("/api/answers/state")) return settings;
      if (path === "/api/answers/processing") {
        writes++;
        return write.promise;
      }
      if (path === "/api/answers/ask") return answer(1, "Other circle result");
      throw Error(`Unexpected ${path}`);
    },
    { realLifecycle: true },
  );
  const { $, window } = feature;
  await until(() => !$("#ask").disabled, "first circle ready");
  change(feature, "#personal", false);
  await until(() => writes === 1, "settings pending");
  $("#groups").value = otherGroup.id;
  $("#groups").dispatchEvent(new window.Event("change"));
  await until(() => !$("#ask").disabled, "other circle ready");
  $("#question").value = "Other circle question";
  submit(feature);
  await until(
    () => $("#answer").textContent.includes("Other circle result"),
    "other circle answer",
  );
  write.resolve({ ok: true });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok($("#answer").textContent.includes("Other circle result"));
  assert.equal($("#question").value, "Other circle question");
});

test("changing consent clears supported citations and the cloned evidence sheet", async (t) => {
  let enabled = true;
  const feature = await mountFeature(t, "answers", (path, body) => {
    if (path === "/api/groups") return [group];
    if (path.startsWith("/api/answers/state"))
      return { ...settings, contribution_enabled: enabled };
    if (path === "/api/answers/processing") {
      enabled = body.enabled;
      return { ok: true };
    }
    if (path === "/api/answers/ask")
      return {
        ...answer(),
        status: "supported",
        message: "Recorded evidence.",
        claims: [
          { text: "Date recorded.", evidence_ids: ["synthetic-record"] },
        ],
        evidence: [
          {
            id: "synthetic-record",
            title: "Synthetic private photograph",
            date: "2024-01-02",
            dates: ["2024-01-02"],
            date_basis: "source capture date",
            place: "Synthetic place",
            url: `/api/answers/evidence?group=${group.id}&asset=synthetic-record`,
          },
        ],
        matching_records: 1,
        shown: 1,
      };
    throw Error(`Unexpected ${path}`);
  });
  const { $, root, window } = feature;
  root.className = "feature-content";
  window.happyDOM.setViewport({ width: 390, height: 844 });
  for (const path of ["features/features.css", "features/workspace.css"]) {
    const style = window.document.createElement("style");
    style.textContent = await readFile(
      new URL(`../../src/${path}`, import.meta.url),
      "utf8",
    );
    window.document.head.append(style);
  }
  globalThis.matchMedia = () => ({ matches: true });
  await until(() => !$("#ask").disabled, "ready to ask");
  $("#question").value = "When was this photograph?";
  submit(feature);
  await until(() => $("#answer .cite"), "supported citation");
  assert.equal($("#evidence-panel").hidden, false);
  assert.equal(
    $("#evidence-list .evidence-title").textContent,
    "Synthetic private photograph",
  );
  assert.equal(window.getComputedStyle($("#evidence-panel")).display, "none");
  const toggle = $("#answer .evidence-toggle");
  assert.equal(window.getComputedStyle(toggle).display, "inline-flex");
  assert.equal(toggle.getAttribute("aria-haspopup"), "dialog");
  toggle.focus();
  toggle.click();
  const dialog = $(".evidence-sheet");
  assert.equal(dialog.open, true);
  assert.equal(dialog.getAttribute("aria-label"), "Evidence for this answer");
  assert.ok(dialog.textContent.includes("Synthetic private photograph"));
  const close = dialog.querySelector(".fx-sheet-handle");
  assert.equal(
    close.getAttribute("aria-label"),
    "Close Evidence for this answer",
  );
  const source = dialog.querySelector(".evidence-title");
  assert.equal(
    source.getAttribute("aria-label"),
    "Source 1: Synthetic private photograph, open the supporting record",
  );
  assert.equal(
    source.getAttribute("href"),
    `/answer-evidence?group=${group.id}&asset=synthetic-record`,
  );
  assert.equal(dialog.querySelectorAll(".evidence-title").length, 1);
  close.click();
  await until(() => !dialog.open, "evidence sheet closed");
  assert.equal(window.document.activeElement, toggle);
  change(feature, "#personal", false);
  await until(
    () => !$("#personal").disabled && !$("#personal").checked,
    "consent disabled",
  );
  assert.equal($("#answer").textContent, "");
  assert.equal($("#evidence-panel").hidden, true);
  assert.equal(
    root.textContent.includes("Synthetic private photograph"),
    false,
  );
  assert.equal(dialog.open, false);
  assert.equal($("#question").value, "When was this photograph?");
  assert.equal($("#ask").disabled, true);
});
