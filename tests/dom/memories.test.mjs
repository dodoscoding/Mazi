import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until, deferred } from "./feature-harness.mjs";

const story = {
  id: "synthetic-story",
  revision: 1,
  event: { title: "Synthetic shared memory", assets: [] },
  notice: "Synthetic",
  contributions: [{ editable: true, text: "Saved recollection" }],
  subevents: [],
  can_delete: false,
};
function response(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/atlas")) return { memories: [] };
  if (path.startsWith("/api/memories/recap"))
    return { year: 2024, coverage: "Synthetic", memories: [] };
  if (path.startsWith("/api/memories/stories")) return [structuredClone(story)];
  if (path.startsWith("/api/memories/capsules")) return [];
  if (path.startsWith("/api/memories/notifications"))
    return { enabled: false, items: [] };
  throw Error(`Unexpected ${path}`);
}
test("a failed recollection save preserves the draft and permits retry", async (t) => {
  const writes = [];
  const { $, window } = await mountFeature(t, "memories", (path, body) => {
    if (path === "/api/memories/write") {
      writes.push(body);
      return writes.length === 1
        ? new Error("Synthetic save failure")
        : {
            ...story,
            revision: 2,
            contributions: [{ editable: true, text: body.text }],
          };
    }
    return response(path);
  });
  await until(() => $("#stories textarea"), "story form");
  $("#stories textarea").value = "My unsaved recollection";
  const submit = () =>
    $("#stories form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  submit();
  await until(
    () => $("#notice").textContent.includes("Synthetic save failure"),
    "save error",
  );
  assert.equal($("#stories textarea")?.value, "My unsaved recollection");
  assert.equal($("#stories form button").disabled, false);
  submit();
  await until(
    () => writes.length === 2 && !$("#stories form button").disabled,
    "retry completes",
  );
  assert.deepEqual(
    writes.map((write) => write.text),
    ["My unsaved recollection", "My unsaved recollection"],
  );
  assert.equal($("#stories textarea").value, "My unsaved recollection");
});

test("pending saves keep newer and neighboring drafts and use the returned revision", async (t) => {
  const gate = deferred();
  const writes = [];
  const { $, root, window } = await mountFeature(
    t,
    "memories",
    (path, body) => {
      if (path.startsWith("/api/memories/stories"))
        return [
          structuredClone(story),
          { ...structuredClone(story), id: "other-story" },
        ];
      if (path === "/api/memories/write") {
        writes.push(body);
        return writes.length === 1
          ? gate.promise
          : {
              ...story,
              revision: 3,
              contributions: [{ editable: true, text: body.text }],
            };
      }
      return response(path);
    },
  );
  await until(
    () => root.querySelectorAll("#stories textarea").length === 2,
    "two story drafts",
  );
  const inputs = root.querySelectorAll("#stories textarea");
  const input = inputs[0];
  const form = input.closest("form");
  const submit = () =>
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  input.value = "First draft";
  inputs[1].value = "Neighbor draft";
  const subevent = form.closest("article").querySelector("input");
  subevent.value = "Unfinished sub-event";
  submit();
  submit();
  [...form.closest("article").querySelectorAll("button")]
    .find((button) => button.textContent === "Remove my recollection")
    .click();
  await until(() => writes.length > 0, "one pending write");
  assert.equal(writes.length, 1);
  input.value = "Newer draft while saving";
  input.focus();
  input.setSelectionRange(5, 5);
  gate.resolve({
    ...story,
    revision: 2,
    contributions: [{ editable: true, text: "First draft" }],
  });
  await until(() => !form.querySelector("button").disabled, "save settles");
  assert.equal(input.value, "Newer draft while saving");
  assert.equal(document.activeElement, input);
  assert.equal(input.selectionStart, 5);
  assert.equal(inputs[1].value, "Neighbor draft");
  assert.equal(subevent.value, "Unfinished sub-event");
  submit();
  await until(() => writes.length === 2, "next save");
  assert.equal(writes[1].revision, 2);
  assert.equal(writes[1].text, "Newer draft while saving");
});

test("a revision conflict keeps the draft until saved context is refreshed", async (t) => {
  let writes = 0;
  let reads = 0;
  let retried;
  const { $, window } = await mountFeature(t, "memories", (path, body) => {
    if (path.startsWith("/api/memories/stories")) {
      reads++;
      return [{ ...structuredClone(story), revision: reads === 1 ? 1 : 2 }];
    }
    if (path === "/api/memories/write") {
      writes++;
      if (writes === 1)
        return Object.assign(new Error("Story changed"), { status: 409 });
      retried = body;
      return {
        ...story,
        revision: 3,
        contributions: [{ editable: true, text: body.text }],
      };
    }
    return response(path);
  });
  await until(() => $("#stories textarea"), "story form");
  $("#stories textarea").value = "My conflict draft";
  const submit = () =>
    $("#stories form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  submit();
  await until(
    () => $("#notice").textContent.includes("Story changed"),
    "conflict",
  );
  assert.equal($("#stories textarea").value, "My conflict draft");
  assert.equal($("#stories form button").disabled, true);
  submit();
  assert.equal(writes, 1);
  const refresh = [...$("#stories").querySelectorAll("button")].find(
    (button) => button.textContent === "Refresh saved story",
  );
  assert.ok(refresh && !refresh.hidden);
  refresh.focus();
  refresh.click();
  await until(() => !$("#stories form button").disabled, "fresh revision");
  assert.equal($("#stories textarea").value, "My conflict draft");
  assert.equal(document.activeElement, $("#stories textarea"));
  submit();
  await until(() => retried, "explicit retry");
  assert.equal(retried.revision, 2);
});

test("a disposed feature cannot restore a late saved recollection", async (t) => {
  const gate = deferred();
  let requested = false;
  const { $, root, window, lifecycle } = await mountFeature(
    t,
    "memories",
    (path) => {
      if (path === "/api/memories/write") {
        requested = true;
        return gate.promise;
      }
      return response(path);
    },
    { realLifecycle: true },
  );
  await until(() => $("#stories textarea"), "story form");
  $("#stories textarea").value = "Private draft";
  $("#stories form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => requested, "pending save");
  lifecycle.dispose();
  gate.resolve({
    ...story,
    revision: 2,
    contributions: [{ editable: true, text: "Private draft" }],
  });
  await until(
    () => !$("#stories form button").disabled,
    "request settles after disposal",
  );
  assert.equal(root.isConnected, false);
  assert.equal(
    window.document.body.textContent.includes("Private draft"),
    false,
  );
  assert.notEqual($("#notice").textContent, "Recollection saved.");
});

for (const editWhileRemoving of [false, true]) {
  test(`successful removal ${editWhileRemoving ? "keeps a newer draft" : "clears the unchanged draft"}`, async (t) => {
    const gate = deferred();
    const writes = [];
    const { $, window } = await mountFeature(t, "memories", (path, body) => {
      if (path === "/api/memories/write") {
        writes.push(body);
        return writes.length === 1
          ? gate.promise
          : {
              ...story,
              revision: 3,
              contributions: [{ editable: true, text: body.text }],
            };
      }
      return response(path);
    });
    await until(() => $("#stories textarea"), "story form");
    const input = $("#stories textarea");
    const remove = [...$("#stories").querySelectorAll("button")].find(
      (button) => button.textContent === "Remove my recollection",
    );
    remove.click();
    await until(() => writes.length === 1, "removal request");
    assert.equal(writes[0].text, "");
    if (editWhileRemoving) input.value = "New thought during removal";
    gate.resolve({ ...story, revision: 2, contributions: [] });
    await until(() => !remove.disabled, "removal settles");
    assert.equal(
      input.value,
      editWhileRemoving ? "New thought during removal" : "",
    );
    input.value = "Next recollection";
    $("#stories form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await until(() => writes.length === 2, "save after removal");
    assert.equal(writes[1].revision, 2);
  });
}

test("saved recollections and the live draft have separate named regions without moving story actions", async (t) => {
  const { $, root } = await mountFeature(t, "memories", response);
  await until(() => $("#stories textarea"), "story draft");
  const saved = $('#stories [aria-label="Saved recollections"]');
  const draft = $('#stories [aria-label="Your recollection"]');
  assert.equal(saved?.textContent, "You: Saved recollection");
  assert.equal(draft?.querySelector("textarea").value, "Saved recollection");
  assert.deepEqual(
    [...root.querySelectorAll("#stories button")].map(
      (button) => button.textContent,
    ),
    [
      "Save my recollection",
      "Remove my recollection",
      "Refresh saved story",
      "Export story JSON",
      "Show slideshow",
      "Previous photo",
      "Next photo",
      "Download video (AVI)",
      "Add sub-event",
      "Clear sub-events",
    ],
  );
  const input = draft.querySelector("textarea");
  input.focus();
  assert.equal(root.ownerDocument.activeElement, input);
  assert.equal(input.maxLength, 2000);
  assert.equal(
    draft.querySelector('[type="button"]').textContent,
    "Remove my recollection",
  );
});

test("the creator can still delete their story from its secondary tools", async (t) => {
  const writes = [];
  const { $, root } = await mountFeature(t, "memories", (path, body) => {
    if (path.startsWith("/api/memories/stories"))
      return writes.length
        ? []
        : [{ ...structuredClone(story), can_delete: true }];
    if (path === "/api/memories/delete") {
      writes.push(body);
      return { ok: true };
    }
    return response(path);
  });
  await until(() => $("#stories textarea"), "creator's story");
  const buttons = [...root.querySelectorAll("#stories button")];
  const remove = buttons.find(
    (button) => button.textContent === "Delete story",
  );
  assert.equal(remove.type, "button");
  assert.equal(
    remove.closest('[aria-label="Photos and exports"]')?.tagName,
    "SECTION",
  );
  assert.equal(
    buttons.indexOf(remove),
    buttons.findIndex((button) => button.textContent === "Export story JSON") +
      1,
  );
  remove.focus();
  assert.equal(root.ownerDocument.activeElement, remove);
  remove.click();
  await until(() => !$("#stories textarea"), "deleted story cleared");
  assert.deepEqual(writes, [{ group: group.id, story: story.id, revision: 1 }]);
});
