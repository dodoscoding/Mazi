import { test } from "node:test";
import assert from "node:assert/strict";
import { cuesFor, type SoundRoute } from "../../src/sound/cues.ts";

const atlas = (overrides: Partial<SoundRoute> = {}): SoundRoute => ({
  path: "/atlas",
  portal: false,
  selected: "last-ferry",
  year: 2024,
  ...overrides,
});

test("opening and closing the portal asks for the dive and the way back", () => {
  assert.deepEqual(cuesFor(atlas(), atlas({ portal: true }), false), ["dive"]);
  assert.deepEqual(cuesFor(atlas({ portal: true }), atlas(), false), ["back"]);
});

test("reduced motion drops the whoosh", () => {
  assert.deepEqual(cuesFor(atlas(), atlas({ portal: true }), true), []);
});

test("a new memory in the same year chimes; a new year ticks once", () => {
  assert.deepEqual(
    cuesFor(atlas(), atlas({ selected: "harbour-walk" }), false),
    ["chime"],
  );
  assert.deepEqual(
    cuesFor(atlas(), atlas({ selected: "lake-days", year: 2023 }), true),
    ["tick"],
  );
});

test("stepping inside the portal chimes", () => {
  assert.deepEqual(
    cuesFor(
      atlas({ portal: true }),
      atlas({ portal: true, selected: "harbour-walk" }),
      false,
    ),
    ["chime"],
  );
});

test("the archive arriving and other screens stay silent", () => {
  assert.deepEqual(
    cuesFor(atlas({ selected: undefined, year: undefined }), atlas(), false),
    [],
  );
  assert.deepEqual(
    cuesFor(atlas(), atlas({ path: "/timeline", selected: "x" }), false),
    [],
  );
  assert.deepEqual(cuesFor(atlas({ path: "" }), atlas(), false), []);
  assert.deepEqual(
    cuesFor(atlas({ path: "/" }), atlas({ path: "/", portal: true }), false),
    [],
  );
});
