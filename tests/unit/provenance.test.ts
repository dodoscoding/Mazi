import assert from "node:assert/strict";
import test from "node:test";
import type { Memory, PhotoProvenance } from "../../src/memories.ts";
import {
  provenanceOf,
  shareDate,
  shareDateLabel,
  sourceSharedLine,
} from "../../src/memory/provenance.ts";

const known: PhotoProvenance = {
  sender: "Ana",
  source: "whatsapp",
  sharedAt: {
    local: "2024-04-23T00:08:02+14:00",
    raw: "23/04/2024, 00.08.02",
    precision: "second",
    ambiguous: false,
  },
};
const uncertain: PhotoProvenance = {
  sender: "Ben",
  source: "whatsapp",
  sharedAt: {
    local: null,
    raw: "04/05/2024, 21:00",
    precision: "unknown",
    ambiguous: true,
  },
};
const memory = (provenance?: PhotoProvenance[]) =>
  ({
    photos: [{ src: "/synthetic.jpg", alt: "", caption: "", provenance }],
    date: "Date not recorded",
    year: null,
  }) as Memory;

test("source dates retain the source calendar day and never invent a timezone", () => {
  const label = shareDate(known);
  assert.match(label, /^Shared on /);
  assert.match(label, /23/);
  assert.doesNotMatch(label, /22|About|UTC|GMT/);
  assert.equal(
    shareDate(uncertain),
    "Shared on 04/05/2024, 21:00 · date order unclear",
  );
  assert.equal(
    shareDate({
      ...uncertain,
      sharedAt: {
        ...uncertain.sharedAt,
        raw: "1713906482000",
        ambiguous: false,
      },
    }),
    "Shared on 1713906482000 · date unresolved",
  );
});

test("duplicate source evidence is collapsed without conflating distinct senders", () => {
  const item = memory([known, known, uncertain]);
  assert.deepEqual(provenanceOf(item), [known, uncertain]);
  assert.equal(sourceSharedLine(item), "Shared by Ana and Ben");
  assert.equal(
    shareDateLabel(item),
    `${shareDate(known)} · ${shareDate(uncertain)}`,
  );
  assert.equal(item.date, "Date not recorded");
  assert.equal(item.year, null);
});

test("optional provenance leaves sample and legacy cards unchanged", () => {
  assert.deepEqual(provenanceOf(memory()), []);
  assert.equal(shareDateLabel(memory()), "");
  assert.equal(sourceSharedLine(memory()), "");
  assert.equal(
    shareDate({
      ...known,
      sharedAt: { ...known.sharedAt, local: null, raw: null },
    }),
    "",
  );
});
