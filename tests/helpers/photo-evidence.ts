import type { DateEvidence, Memory } from "../../src/memories.ts";

export const unknownDate: DateEvidence = {
  basis: "unknown",
  status: "unknown",
  days: [],
  start: null,
  through: null,
  timezone: null,
};
const captured: DateEvidence = {
  basis: "capture",
  status: "exact",
  days: ["2020-01-02"],
  start: "2020-01-02",
  through: "2020-01-02",
  timezone: null,
};
const shared: DateEvidence = {
  basis: "shared",
  status: "exact",
  days: ["2024-01-02"],
  start: "2024-01-02",
  through: "2024-01-02",
  timezone: "UTC",
};
export const photoEvidenceMemory: Memory = {
  id: "synthetic-photo-facts",
  kind: "memory",
  shortTitle: "Synthetic photo facts",
  title: "Synthetic photo facts",
  date: "2020-01-02",
  year: 2020,
  approximate: true,
  by: "Synthetic circle",
  description: "Synthetic archive fixture.",
  source: "manual, discord",
  dateBasis: "source capture evidence, undated",
  messages: [],
  people: { shared: [], conversation: [] },
  place: {
    name: "Istanbul",
    country: "TR",
    latitude: 41.0144,
    longitude: 28.975,
  },
  photos: [
    {
      assetId: "synthetic-capture",
      src: "/media/ferry.webp",
      alt: "Synthetic capture photo",
      caption: "Captured in Istanbul",
      evidence: {
        capture: captured,
        shared: [],
        chronology: captured,
        place: {
          status: "known",
          text: "Istanbul, TR",
          pin: {
            name: "Istanbul",
            country: "TR",
            latitude: 41.0144,
            longitude: 28.975,
          },
        },
      },
    },
    {
      assetId: "synthetic-share",
      src: "/media/harbor.webp",
      alt: "Synthetic sharing photo",
      caption: "Shared on Discord",
      evidence: {
        capture: unknownDate,
        shared: [shared],
        chronology: shared,
        place: { status: "unknown", text: null, pin: null },
      },
    },
  ],
};
