export const METERS = [
  "finances",
  "relationships",
  "freedom",
  "wellbeing",
] as const;
export type Meter = (typeof METERS)[number];
export type Meters = Record<Meter, number>;
export const CHOICES_AT_DEPTH = [3, 2, 2, 0] as const;
export const MAX_DEPTH = 3;
export const MAX_DELTA = 15;
export const TOTAL_ENDINGS = 12;
export const LIMITS = {
  about: 280,
  whatIf: 280,
  label: 80,
  description: 200,
  universes: 20,
} as const;
export type StoryTone = "realistic" | "cinematic" | "chaotic";
export interface Origin {
  about: string;
  startYear: number;
  whatIf: string;
  tone: StoryTone;
}
export interface Choice {
  label: string;
  description: string;
}
export interface Universe {
  id: string;
  origin: Origin;
  rootNodeId: string;
  createdAt: string;
}
export interface Chapter {
  title: string;
  year: number;
  narrative: string;
  location: string;
  career: string;
  meters: Meters;
  deltas: Meters;
  keyEvents: string[];
  twist: boolean;
  choices: Choice[];
  ending: { title: string; epilogue: string } | null;
}
export interface StoryNode extends Chapter {
  id: string;
  universeId: string;
  parentId: string | null;
  choiceIndex: number | null;
  depth: 0 | 1 | 2 | 3;
}
export interface StoryData {
  version: 1;
  universes: Universe[];
  nodes: Record<string, StoryNode>;
}
export interface ChapterRequest {
  origin: Origin;
  path: { title: string; year: number; choice: string; keyEvents: string[] }[];
  state: Meters & { location: string; career: string };
  choice: Choice | null;
  depth: 0 | 1 | 2 | 3;
}
export const emptyData = (): StoryData => ({
  version: 1,
  universes: [],
  nodes: {},
});
