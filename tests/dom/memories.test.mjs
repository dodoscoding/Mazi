import assert from "node:assert/strict";
import test from "node:test";
import { group, mountFeature, until } from "./feature-harness.mjs";

function response(path) {
  if (path === "/api/groups") return [group];
  if (path.startsWith("/api/atlas")) return { memories: [] };
  if (path.startsWith("/api/memories/recap"))
    return { year: 2024, coverage: "Synthetic retained recap", memories: [] };
  throw Error(`Unexpected ${path}`);
}

test("the retained photo workspace reads recap without story or capsule authoring", async (t) => {
  const reads = [];
  const { $, root } = await mountFeature(t, "memories", (path, body) => {
    assert.equal(body, undefined);
    reads.push(path);
    return response(path);
  });
  await until(
    () => $("#recap").textContent.includes("Synthetic retained recap"),
    "recap should load",
  );
  assert.equal(
    root.querySelectorAll("textarea, #stories, #capsules, #capsule-form")
      .length,
    0,
  );
  assert.equal(root.querySelectorAll("#grid").length, 1);
  assert.equal(
    reads.some((path) =>
      /stories|capsules|notifications|frame|video/.test(path),
    ),
    false,
  );
  assert.match($("#recap").textContent, /No eligible approved memories/);
});

test("recap failure offers an explicit retry without rebuilding the gallery", async (t) => {
  let attempts = 0;
  const { $ } = await mountFeature(t, "memories", (path) => {
    if (path.startsWith("/api/memories/recap") && ++attempts === 1)
      return new Error("Synthetic recap unavailable");
    return response(path);
  });
  await until(
    () => $("#notice").textContent.includes("Synthetic recap unavailable"),
    "failure should be visible",
  );
  const grid = $("#grid");
  $("#refresh").click();
  await until(
    () => $("#recap").textContent.includes("Synthetic retained recap"),
    "retry should restore recap",
  );
  assert.equal($("#grid"), grid);
  assert.equal(attempts, 2);
});
