import { CHOICES_AT_DEPTH } from "./model.ts";
import type { Chapter, ChapterRequest } from "./model.ts";
import { applyDeltas } from "./tree.ts";
export function fixtureChapter(request: ChapterRequest): Chapter {
  const { depth, choice, origin } = request;
  const seed = Array.from(choice?.label || origin.whatIf).reduce(
    (sum, c) => sum + c.charCodeAt(0),
    0,
  );
  const deltas = {
    finances: (seed % 15) - 7,
    relationships: 7 - (seed % 15),
    freedom: 6 - depth * 3,
    wellbeing: depth * 3 - 4,
  };
  const titles = [
    "The door left open",
    "A different rhythm",
    "The unexpected invitation",
    "A life made by hand",
  ];
  return {
    title: titles[depth],
    year: (request.path.at(-1)?.year ?? origin.startYear) + (depth ? 2 : 0),
    narrative: `This is a sample fictional chapter. ${choice ? `In this branch, you chose to ${choice.label.toLowerCase()}.` : "A different decision opens a door to an unfamiliar routine."} You find a small room with a window facing a busy street. Each morning brings a chance to practise something you once put off. A new colleague offers help, and you begin to feel less like a visitor. The change has costs too: money is tighter, familiar friendships need more effort, and some evenings feel uncertain. One afternoon, an invitation arrives. It could deepen the life you are building, or pull you in another direction. There is no perfect answer, only another choice and the time needed to discover what it means. This invented possibility is not a prediction of your future.`,
    location: request.state.location,
    career: depth ? "Independent collaborator" : "New arrival",
    meters: applyDeltas(request.state, deltas),
    deltas,
    keyEvents: [
      "Found an unfamiliar routine",
      "Made time for a new connection",
    ],
    twist: depth === 2 && origin.tone !== "realistic",
    choices: [
      {
        label: "Follow the opportunity",
        description:
          "Invest time in an unfamiliar project, with less room for old routines.",
      },
      {
        label: "Build a quieter life",
        description: "Protect your relationships and accept a slower pace.",
      },
      {
        label: "Start somewhere new",
        description: "Trade some stability for another beginning.",
      },
    ].slice(0, CHOICES_AT_DEPTH[depth]),
    ending:
      depth === 3
        ? {
            title: `${choice?.label ?? "Another beginning"}: a place to belong`,
            epilogue:
              "Some doors stayed closed. You made a home beside the ones you opened.",
          }
        : null,
  };
}
