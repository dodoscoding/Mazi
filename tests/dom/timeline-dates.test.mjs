import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { atlasHarness } from "./atlas-harness.mjs";

const photo = (local, raw = local) => ({
  src: "/synthetic.jpg",
  alt: "",
  caption: "",
  provenance:
    local || raw
      ? [
          {
            sender: "Ana",
            source: "whatsapp",
            sharedAt: {
              local,
              raw,
              precision: local ? "second" : "unknown",
              ambiguous: !local,
            },
          },
        ]
      : [],
});
const memory = (id, title, photos) => ({
  id,
  kind: photos.length > 1 ? "memory" : "photo",
  shortTitle: title,
  title,
  date: "Date not recorded",
  dateBasis: "undated",
  year: null,
  approximate: true,
  by: "Your circle",
  description: "",
  source: "whatsapp",
  photos,
  messages: [],
  place: null,
  people: { shared: [], conversation: [] },
});

async function timeline(t, memories) {
  const harness = await atlasHarness(t);
  const { window } = harness;
  const saved = [];
  for (const [name, value] of Object.entries({
    matchMedia: window.matchMedia.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    CSS: window.CSS,
  })) {
    saved.push([name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const { Timeline } = await harness.server.ssrLoadModule(
    "/src/browse/Timeline.tsx",
  );
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      createElement(Timeline, {
        memories,
        link: () => () => {},
        heading: createRef(),
      }),
    ),
  );
  t.after(async () => {
    await act(async () => root.unmount());
    for (const [name, descriptor] of saved)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
  });
  return host;
}

test("a timeline with nothing dated says so instead of printing undefined", async (t) => {
  const host = await timeline(t, [
    memory("a", "Photo shared by Ana", [photo(null, "04/05/2024, 21:00")]),
  ]);
  const subtitle = host.querySelector(".browse-sub").textContent;
  assert.doesNotMatch(subtitle, /undefined/);
  assert.match(subtitle, /^1 moment, none dated yet\./);
});

test("a memory with one undated photo keeps the year of its dated photos", async (t) => {
  const host = await timeline(t, [
    memory("trip", "Lake trip", [
      photo("2024-05-04T21:00:00"),
      photo(null, "Media omitted"),
    ]),
  ]);
  assert.match(
    host.querySelector(".browse-sub").textContent,
    /^1 moment in 2024\./,
  );
  assert.equal(
    host.querySelector("[data-memory-id='trip']").closest("li[data-year]")
      .dataset.year,
    "2024",
  );
});
