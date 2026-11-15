import { pathTo } from "./tree.ts";
import type { Nodes } from "./tree.ts";
import type { ChapterRequest, Universe } from "./model.ts";
export function buildChapterRequest(
  universe: Universe,
  nodes: Nodes,
  parentId: string | null,
  choiceIndex: number | null,
): ChapterRequest {
  const parent = parentId === null ? null : nodes[parentId];
  if (parentId !== null && (!parent || parent.universeId !== universe.id))
    throw Error("Unknown parent");
  if (
    parent &&
    (parent.depth === 3 ||
      choiceIndex === null ||
      !Number.isInteger(choiceIndex) ||
      !parent.choices[choiceIndex])
  )
    throw Error("Unknown choice");
  const ancestors = parent ? pathTo(nodes, parent.id) : [];
  return {
    origin: universe.origin,
    path: ancestors.map((node, index) => ({
      title: node.title,
      year: node.year,
      keyEvents: node.keyEvents,
      choice:
        node.choices[
          index === ancestors.length - 1
            ? choiceIndex!
            : ancestors[index + 1].choiceIndex!
        ].label,
    })),
    state: parent
      ? { ...parent.meters, location: parent.location, career: parent.career }
      : {
          finances: 50,
          relationships: 50,
          freedom: 50,
          wellbeing: 50,
          location: "A new city",
          career: "A new beginning",
        },
    choice: parent ? parent.choices[choiceIndex!] : null,
    depth: parent ? ((parent.depth + 1) as 1 | 2 | 3) : 0,
  };
}
