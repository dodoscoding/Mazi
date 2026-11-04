export type PhotoProvenance = {
  sender: string | null;
  source: string;
  sharedAt: {
    local: string | null;
    raw: string | null;
    precision: string;
    ambiguous: boolean;
  };
};
export type DateEvidence = {
  basis: "capture" | "shared" | "unknown";
  status:
    "exact" | "approximate" | "range" | "conflict" | "ambiguous" | "unknown";
  days: string[];
  start: string | null;
  through: string | null;
  timezone: string | null;
};
export type PhotoEvidence = {
  capture: DateEvidence;
  shared: DateEvidence[];
  chronology: DateEvidence;
  place: {
    status: "known" | "unmapped" | "conflict" | "unknown";
    text: string | null;
    pin: Place | null;
  };
};
export type Photo = {
  src: string;
  alt: string;
  caption: string;
  provenance?: PhotoProvenance[];
  assetId?: string;
  evidence?: PhotoEvidence;
};
export type Place = {
  name: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
};
export type People = { shared: string[]; conversation: string[] };
export type Memory = {
  id: string;
  kind?: "memory" | "photo";
  source?: string;
  dateBasis?: string;
  shortTitle: string;
  title: string;
  date: string;
  year: number | null;
  approximate: boolean;
  by: string;
  description: string;
  photos: Photo[];
  messages: { name: string; time: string; text: string }[];
  place: Place | null;
  people: People;
};
const photo = (name: string, alt: string, caption: string): Photo => ({
  src: `/media/${name}.webp`,
  alt,
  caption,
});
export const memories: Memory[] = [
  {
    id: "last-ferry",
    shortTitle: "The last ferry",
    title: "The night we missed the last ferry",
    date: "Summer 2024",
    year: 2024,
    approximate: true,
    by: "Deniz",
    description:
      "We stayed for one more story. Then another. Somewhere between dessert and the sea turning blue, the last ferry left without us.",
    photos: [
      photo(
        "ferry",
        "Friends sharing a candlelit dinner on a terrace above the sea",
        "One more story before we go.",
      ),
      photo(
        "harbor",
        "A ferry leaving a small island harbour at dusk",
        "There goes our ride home.",
      ),
      photo(
        "table",
        "Candles and plates left on the terrace table after dinner",
        "The evening we decided to stay.",
      ),
    ],
    messages: [
      { name: "Maya", time: "21:14", text: "Anyone checked the ferry time?" },
      { name: "Deniz", time: "21:16", text: "I think we live here now." },
      { name: "Alex", time: "21:18", text: "Worth missing the ferry for." },
    ],
    place: {
      name: "Naxos",
      country: "GR",
      latitude: 37.1036,
      longitude: 25.3766,
    },
    people: { shared: ["Deniz"], conversation: ["Alex", "Deniz", "Maya"] },
  },
  {
    id: "lake-days",
    shortTitle: "Lake days",
    title: "Lake days",
    date: "July 2023",
    year: 2023,
    approximate: true,
    by: "Maya",
    description:
      "No plans, no signal. Just a wooden jetty, cold water, and an afternoon that somehow lasted all day.",
    photos: [
      photo(
        "lake",
        "Friends sitting on a wooden jetty beside a forested lake",
        "The water was colder than we admitted.",
      ),
    ],
    messages: [],
    place: {
      name: "Bohinj",
      country: "SI",
      latitude: 46.2833,
      longitude: 13.8833,
    },
    people: { shared: ["Maya"], conversation: [] },
  },
  {
    id: "birthday",
    shortTitle: "Birthday weekend",
    title: "A kitchen full of our favourite people",
    date: "November 2022",
    year: 2022,
    approximate: true,
    by: "Alex",
    description:
      "A slightly uneven cake. Too many candles. Everyone squeezing into the kitchen at once. Exactly the right kind of birthday.",
    photos: [
      photo(
        "birthday",
        "Friends gathered around a candlelit birthday cake in a kitchen",
        "One cake, everyone together.",
      ),
    ],
    messages: [
      {
        name: "Alex",
        time: "20:42",
        text: "Same kitchen, same time next year?",
      },
    ],
    place: {
      name: "Nicosia",
      country: "CY",
      latitude: 35.1856,
      longitude: 33.3823,
    },
    people: { shared: ["Alex"], conversation: ["Alex"] },
  },
];
export function memoryById(id: string) {
  return memories.find((memory) => memory.id === id);
}
