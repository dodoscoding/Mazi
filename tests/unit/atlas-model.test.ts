import { test } from "node:test";
import assert from "node:assert/strict";
import type { Memory, Place } from "../../src/memories.ts";
import {
  buildAtlas,
  firstMemoryOfYear,
  placeIdOf,
} from "../../src/atlas/model.ts";

function memory(id: string, year: number | null, place: Place | null): Memory {
  return {
    id,
    shortTitle: id,
    title: id,
    date: year ? String(year) : "Date not recorded",
    year,
    approximate: year === null,
    by: "Your circle",
    description: "",
    photos: [{ src: `/media/${id}.webp`, alt: id, caption: id }],
    messages: [],
    place,
    people: { shared: [], conversation: [] },
  };
}

const naxos = (latitude: number, longitude: number): Place => ({
  name: "Naxos",
  country: "GR",
  latitude,
  longitude,
});
const bohinj: Place = {
  name: "Bohinj",
  country: "SI",
  latitude: 46.25,
  longitude: 13.875,
};
const nicosia: Place = {
  name: "Nicosia",
  country: "CY",
  latitude: 35.25,
  longitude: 33.5,
};

// API order: newest year first, as /api/atlas returns it.
const archive = [
  memory("h", 2025, naxos(37.5, 25)),
  memory("a", 2024, naxos(37.25, 25.5)),
  memory("g", 2024, bohinj),
  memory("b", 2023, bohinj),
  memory("c", 2023, naxos(37, 26)),
  memory("d", null, nicosia),
  memory("e", 2022, null),
  memory("f", 2022, nicosia),
];

test("groups memories by place name and country with mean coordinates and per-year counts", () => {
  const { places } = buildAtlas(archive);
  assert.deepEqual(places, [
    {
      id: "GR:Naxos",
      name: "Naxos",
      country: "GR",
      latitude: 37.25,
      longitude: 25.5,
      count: 3,
      years: { 2023: 1, 2024: 1, 2025: 1 },
      memories: ["h", "a", "c"],
    },
    {
      id: "SI:Bohinj",
      name: "Bohinj",
      country: "SI",
      latitude: 46.25,
      longitude: 13.875,
      count: 2,
      years: { 2023: 1, 2024: 1 },
      memories: ["g", "b"],
    },
    {
      id: "CY:Nicosia",
      name: "Nicosia",
      country: "CY",
      latitude: 35.25,
      longitude: 33.5,
      count: 2,
      years: { 2022: 1 },
      memories: ["d", "f"],
    },
  ]);
});

test("journeys join consecutive distinct places in year order, once per ordered pair", () => {
  // Year order then API order: f Nicosia, b Bohinj, c Naxos, a Naxos, g Bohinj, h Naxos.
  // Bohinj to Naxos repeats in 2025 and is kept once, with its first year.
  assert.deepEqual(buildAtlas(archive).journeys, [
    {
      id: "CY:Nicosia>SI:Bohinj",
      from: "CY:Nicosia",
      to: "SI:Bohinj",
      year: 2023,
    },
    { id: "SI:Bohinj>GR:Naxos", from: "SI:Bohinj", to: "GR:Naxos", year: 2023 },
    { id: "GR:Naxos>SI:Bohinj", from: "GR:Naxos", to: "SI:Bohinj", year: 2024 },
  ]);
});

test("years are the sorted distinct years of dated memories", () => {
  assert.deepEqual(buildAtlas(archive).years, [2022, 2023, 2024, 2025]);
});

test("memories without a place are returned as unplaced in API order", () => {
  assert.deepEqual(
    buildAtlas(archive).unplaced.map((item) => item.id),
    ["e"],
  );
});

test("undated memories never form journeys", () => {
  const atlas = buildAtlas([
    memory("x", null, nicosia),
    memory("y", null, bohinj),
    memory("z", 2020, naxos(37, 25)),
  ]);
  assert.deepEqual(atlas.journeys, []);
  assert.deepEqual(atlas.years, [2020]);
  assert.equal(atlas.places.length, 3);
});

test("the same city name in two countries is two places", () => {
  const paris = (country: string): Place => ({
    name: "Paris",
    country,
    latitude: 10,
    longitude: 10,
  });
  const atlas = buildAtlas([
    memory("p1", 2020, paris("FR")),
    memory("p2", 2021, paris("US")),
  ]);
  assert.deepEqual(
    atlas.places.map((place) => place.id),
    ["FR:Paris", "US:Paris"],
  );
  assert.deepEqual(atlas.journeys, [
    { id: "FR:Paris>US:Paris", from: "FR:Paris", to: "US:Paris", year: 2021 },
  ]);
});

test("an empty archive has no places, journeys or years", () => {
  assert.deepEqual(buildAtlas([]), {
    places: [],
    journeys: [],
    years: [],
    unplaced: [],
  });
});

test("scrubbing to a year selects that year's first memory in API order", () => {
  assert.equal(firstMemoryOfYear(archive, 2024)?.id, "a");
  assert.equal(firstMemoryOfYear(archive, 2022)?.id, "e");
  assert.equal(firstMemoryOfYear(archive, 1999), undefined);
  assert.equal(placeIdOf(archive[0]), "GR:Naxos");
  assert.equal(placeIdOf(archive[6]), null);
});

test("canonical same-name cities stay distinct in grouped evidence and Atlas nodes", async () => {
  const { readFileSync } = await import("node:fs");
  const { photoEvidenceMemory } = await import("../helpers/photo-evidence.ts");
  const { evidencePin, evidencePlaceLabel } =
    await import("../../src/memory/evidence.ts");
  const gazetteer = JSON.parse(
    readFileSync(
      new URL("../../mazi/sources/cities.json", import.meta.url),
      "utf8",
    ),
  );
  const regions = ["Massachusetts", "Illinois"];
  const pins: Place[] = regions.map((region) => {
    const row = gazetteer.places
      .map((values: unknown[]) =>
        Object.fromEntries(
          gazetteer.fields.map((field: string, index: number) => [
            field,
            values[index],
          ]),
        ),
      )
      .find(
        (city: Record<string, unknown>) =>
          city.name === "Springfield" &&
          city.country === "US" &&
          city.region === region,
      );
    return {
      name: row.name,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
    };
  });
  const grouped = structuredClone(photoEvidenceMemory);
  grouped.photos.forEach((photo, index) => {
    photo.evidence!.place = {
      status: "known",
      text: "Springfield, US",
      pin: pins[index],
    };
  });
  assert.equal(evidencePlaceLabel(grouped), "Birden fazla yer");
  assert.equal(evidencePin(grouped), null);
  const cards = grouped.photos.map((photo, index) => ({
    ...grouped,
    id: `springfield-${index}`,
    photos: [photo],
  }));
  assert.notEqual(placeIdOf(cards[0]), placeIdOf(cards[1]));
  const atlas = buildAtlas(cards);
  assert.equal(atlas.places.length, 2);
  assert.deepEqual(
    atlas.places.map((place) => [place.latitude, place.longitude]),
    [
      [42.12, -72.58],
      [39.82, -89.65],
    ],
  );
  assert.equal(buildAtlas([grouped]).unplaced.length, 1);
});
