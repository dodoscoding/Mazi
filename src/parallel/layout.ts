import { childOf, pathTo } from "./tree.ts";
import type { Nodes } from "./tree.ts";
export interface MapItem {
  id: string;
  kind: "node" | "stub";
  parentId: string | null;
  choiceIndex: number | null;
  x: number;
  y: number;
}
export function layout(nodes: Nodes, rootId: string) {
  const items: MapItem[] = [];
  let rows = 0;
  function visit(id: string): number {
    const node = nodes[id];
    pathTo(nodes, id);
    const item: MapItem = {
      id,
      kind: "node",
      parentId: node.parentId,
      choiceIndex: node.choiceIndex,
      x: node.depth,
      y: 0,
    };
    items.push(item);
    const ys = node.choices.map((_, choiceIndex) => {
      const child = childOf(nodes, id, choiceIndex);
      if (child) return visit(child.id);
      const y = rows++;
      items.push({
        id: `${id}:stub:${choiceIndex}`,
        kind: "stub",
        parentId: id,
        choiceIndex,
        x: node.depth + 1,
        y,
      });
      return y;
    });
    item.y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : rows++;
    return item.y;
  }
  visit(rootId);
  return { items, rows };
}
