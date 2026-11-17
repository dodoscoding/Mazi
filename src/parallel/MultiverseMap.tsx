import { useState } from "react";
import { layout } from "./layout.ts";
import { childOf, pathTo } from "./tree.ts";
import type { Nodes } from "./tree.ts";
import type { Universe } from "./model.ts";
export function MultiverseMap({
  universe,
  nodes,
  current,
  onOpen,
  onChoose,
  pending,
}: {
  universe: Universe;
  nodes: Nodes;
  current: string | null;
  onOpen: (id: string) => void;
  onChoose: (id: string, index: number) => void;
  pending: boolean;
}) {
  const [list, setList] = useState(false);
  const map = layout(nodes, universe.rootNodeId);
  const active = new Set(
    current ? pathTo(nodes, current).map((n) => n.id) : [],
  );
  const tree = (id: string) => {
    const node = nodes[id];
    return (
      <li key={id}>
        <button
          onClick={() => onOpen(id)}
          aria-label={`Open ${node.title}`}
          aria-current={id === current ? "step" : undefined}
        >
          {node.title}{" "}
          <small>
            {node.year}
            {node.ending ? " · Ending" : ""}
          </small>
        </button>
        {node.choices.length > 0 && (
          <ul>
            {node.choices.map((choice, i) => {
              const child = childOf(nodes, id, i);
              return child ? (
                tree(child.id)
              ) : (
                <li key={`${id}:${i}`}>
                  <button
                    disabled={pending}
                    className="py-stub"
                    onClick={() => onChoose(id, i)}
                  >
                    Path not taken: {choice.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };
  return (
    <section aria-label="Multiverse map">
      <div className="py-toolbar">
        <h2>Your paths</h2>
        <button onClick={() => setList(!list)}>
          {list ? "Map view" : "List view"}
        </button>
      </div>
      {list ? (
        <ul className="py-tree">{tree(universe.rootNodeId)}</ul>
      ) : (
        <div
          className="py-map"
          style={{ height: Math.max(240, map.rows * 90) }}
        >
          <svg
            aria-hidden="true"
            width="100%"
            height="100%"
            viewBox={`0 0 1000 ${Math.max(240, map.rows * 90)}`}
            preserveAspectRatio="none"
          >
            {map.items
              .filter((i) => i.parentId)
              .map((i) => {
                const parent = map.items.find((p) => p.id === i.parentId)!;
                return (
                  <path
                    key={i.id}
                    className={
                      active.has(i.id) ? "py-edge py-edge-active" : "py-edge"
                    }
                    d={`M ${parent.x * 245 + 125} ${parent.y * 90 + 40} C ${parent.x * 245 + 240} ${parent.y * 90 + 40},${i.x * 245} ${i.y * 90 + 40},${i.x * 245 + 125} ${i.y * 90 + 40}`}
                  />
                );
              })}
          </svg>
          {map.items.map((item) => (
            <button
              key={item.id}
              className={`py-map-node ${item.kind === "stub" ? "py-stub" : ""} ${active.has(item.id) ? "py-selected" : ""}`}
              style={{ left: `${item.x * 24.5 + 1}%`, top: item.y * 90 }}
              disabled={pending && item.kind === "stub"}
              aria-label={
                item.kind === "node"
                  ? `Open ${nodes[item.id].title}`
                  : `Path not taken: ${nodes[item.parentId!].choices[item.choiceIndex!].label}`
              }
              onClick={() =>
                item.kind === "node"
                  ? onOpen(item.id)
                  : onChoose(item.parentId!, item.choiceIndex!)
              }
            >
              {item.kind === "node" ? nodes[item.id].title : "Path not taken"}
              <small>
                {item.kind === "node"
                  ? nodes[item.id].year
                  : nodes[item.parentId!].choices[item.choiceIndex!].label}
              </small>
            </button>
          ))}
        </div>
      )}
      {!list && (
        <p className="py-hint">
          Use List view for full chapter and choice labels on a small screen.
        </p>
      )}
    </section>
  );
}
