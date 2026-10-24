import assert from "node:assert/strict";
import test from "node:test";
import type { Memory } from "../../src/memories.ts";
import {
  buildChronology,
  chronologyDate,
} from "../../src/memory/chronology.ts";
const memory = (id: string, dates: (string | null)[], extra = {}) =>
  ({
    id,
    year: null,
    date: "Date not recorded",
    photos: dates.map((local) => ({
      src: "/synthetic",
      alt: "",
      caption: "",
      provenance: local
        ? [
            {
              sender: null,
              source: "test",
              sharedAt: {
                local,
                raw: null,
                ambiguous: false,
                precision: "day",
              },
            },
          ]
        : [],
    })),
    ...extra,
  }) as Memory;
test("complete sharing evidence supplies same-year distinct replay stops without rewriting capture truth", () => {
  const a = memory("a", ["2025-01-02"]),
    b = memory("b", ["2025-01-03"]);
  const original = JSON.stringify([a, b]);
  assert.deepEqual(
    buildChronology([b, a]).ordered.map((x) => x.memory.id),
    ["a", "b"],
  );
  assert.equal(chronologyDate(a).basis, "shared");
  assert.match(chronologyDate(a).label, /Shared on .*Capture date unknown/);
  assert.equal(JSON.stringify([a, b]), original);
});
test("capture wins, stable ties remain stable and invalid or ambiguous evidence is excluded", () => {
  const capture = memory("capture", ["2020-01-01"], {
    year: 2024,
    date: "Summer 2024",
  });
  assert.equal(chronologyDate(capture).basis, "capture");
  for (const local of ["2025-02-30", "2025-13-01", "raw string"])
    assert.equal(chronologyDate(memory("bad", [local])).basis, "unknown");
  const ambiguous = memory("ambiguous", ["2025-01-01"]);
  ambiguous.photos[0].provenance![0].sharedAt.ambiguous = true;
  assert.equal(chronologyDate(ambiguous).basis, "unknown");
  assert.deepEqual(
    buildChronology([
      memory("b", ["2025-01-01"]),
      memory("a", ["2025-01-01"]),
    ]).ordered.map((x) => x.memory.id),
    ["b", "a"],
  );
});
test("grouped photos take their sharing range from dated photos and ignore undated or ambiguous ones", () => {
  const partial = chronologyDate(memory("partial", ["2025-01-01", null]));
  assert.deepEqual(
    [partial.basis, partial.year, partial.sortKey],
    ["shared", 2025, "2025-01-01"],
  );
  const mixed = memory("mixed", ["2025-03-01", "2025-01-01"]);
  mixed.photos[1].provenance![0].sharedAt.ambiguous = true;
  assert.equal(chronologyDate(mixed).sortKey, "2025-03-01");
  assert.equal(chronologyDate(memory("none", [null, null])).basis, "unknown");
  const range = chronologyDate(
    memory("range", ["2024-01-01", "2025-01-01"], {
      date: "2019-01-01 · some dates unknown",
    }),
  );
  assert.equal(range.basis, "shared");
  assert.match(
    range.label,
    /Shared between .*2024.*2025.*Capture date incomplete/,
  );
  assert.match(
    chronologyDate(
      memory("partial", [null], { date: "2019-01-01 · some dates unknown" }),
    ).label,
    /Capture date incomplete/,
  );
});

test("conflicting capture assertions remain explicit when sharing positions Replay", () => {
  const item = memory("conflict", ["2025-01-01"], {
    dateBasis: "conflicting source evidence",
  });
  assert.match(chronologyDate(item).label, /Capture date incomplete/);
  assert.equal(chronologyDate(item).basis, "shared");
});
