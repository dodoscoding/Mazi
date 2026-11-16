import { useEffect, useRef, useState } from "react";
import { METERS, emptyData, LIMITS } from "./model.ts";
import type { Origin, StoryData, StoryNode, Universe } from "./model.ts";
import {
  addChild,
  childOf,
  endingsFound,
  pathTo,
  removeBranch,
} from "./tree.ts";
import { clear, isNode, load, removeUniverse, save } from "./storage.ts";
import { buildChapterRequest } from "./request.ts";
import { fixtureChapter } from "./fixtures.ts";
import { chapter, parallelRequest, ParallelError } from "./api.ts";
import { MultiverseMap } from "./MultiverseMap";
import "../styles/parallel.css";
const examples = [
  {
    label: "Study somewhere new",
    about: "A student deciding where to study",
    startYear: 2022,
    whatIf: "I had studied in Japan instead of Denmark",
    tone: "cinematic" as const,
  },
  {
    label: "Take the creative path",
    about: "Someone balancing a job and a creative practice",
    startYear: 2020,
    whatIf: "I had made more time for making music",
    tone: "realistic" as const,
  },
  {
    label: "Leave the familiar",
    about: "Someone ready for an unexpected change",
    startYear: 2024,
    whatIf: "I had moved to a city where I knew nobody",
    tone: "chaotic" as const,
  },
];
export default function ParallelPage({
  memberId,
  demo,
}: {
  memberId: string;
  demo: boolean;
}) {
  const initial = useRef<ReturnType<typeof load> | null>(null);
  if (!initial.current) {
    try {
      initial.current = load(localStorage, memberId);
    } catch {
      initial.current = {
        data: emptyData(),
        warning: "Browser storage is unavailable.",
      };
    }
  }
  const [data, setData] = useState<StoryData>(initial.current.data);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [warning, setWarning] = useState(initial.current.warning);
  const [screen, setScreen] = useState<
    "home" | "origin" | "chapter" | "map" | "compare"
  >("home");
  const [universeId, setUniverseId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<Origin>({
    about: "",
    startYear: new Date().getFullYear(),
    whatIf: "",
    tone: "cinematic",
  });
  const [enabled, setEnabled] = useState<boolean | null>(demo ? true : null);
  const [accepted, setAccepted] = useState(demo);
  const acceptedRef = useRef(accepted);
  acceptedRef.current = accepted;
  const [notice, setNotice] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [declined, setDeclined] = useState(false);
  const [report, setReport] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const retry = useRef<null | (() => void)>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => setCompare([]), [universeId]);
  useEffect(() => {
    heading.current?.focus();
  }, [screen, nodeId]);
  useEffect(() => {
    const abort = new AbortController();
    if (!demo)
      void parallelRequest("config", undefined, abort.signal)
        .then((v) => {
          if (!abort.signal.aborted) {
            setEnabled(v.enabled === true);
            setAccepted(v.accepted === true);
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) setEnabled(false);
        });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, [demo]);
  const universe = data.universes.find((u) => u.id === universeId);
  const node = nodeId ? data.nodes[nodeId] : undefined;
  function commit(next: StoryData) {
    dataRef.current = next;
    setData(next);
    try {
      const issue = save(localStorage, memberId, next);
      if (issue)
        setWarning(
          issue === "full"
            ? "Browser storage is full or blocked. These changes remain only in this tab. Free space before closing it."
            : "You can keep at most 20 universes. Delete one to begin another.",
        );
    } catch {
      setWarning(
        "Changes remain only in this tab because browser storage is unavailable.",
      );
    }
  }
  function open(id: string) {
    setNodeId(id);
    setUniverseId(dataRef.current.nodes[id].universeId);
    setScreen("chapter");
    setReport(false);
    setError("");
  }
  async function generate(
    u: Universe,
    parentId: string | null,
    index: number | null,
    replaceId?: string,
  ) {
    if (declined || (controller.current && !controller.current.signal.aborted))
      return;
    const current = dataRef.current;
    const existing =
      parentId !== null && index !== null
        ? childOf(current.nodes, parentId, index)
        : undefined;
    if (existing && !replaceId) {
      open(existing.id);
      return;
    }
    if (
      !parentId &&
      !replaceId &&
      current.universes.length >= LIMITS.universes
    ) {
      setError("You have 20 universes. Delete one before beginning another.");
      return;
    }
    const run = () => {
      void generate(u, parentId, index, replaceId);
    };
    retry.current = run;
    if (!acceptedRef.current) {
      setNotice(true);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setPending(true);
    setError("");
    setDeclined(false);
    try {
      const request = buildChapterRequest(u, current.nodes, parentId, index);
      const result = demo
        ? fixtureChapter(request)
        : await chapter(request, abort.signal);
      if (abort.signal.aborted) return;
      const latest = dataRef.current;
      if (
        (replaceId && !latest.nodes[replaceId]) ||
        (parentId && !latest.nodes[parentId])
      )
        return;
      const id = parentId ? crypto.randomUUID() : u.rootNodeId;
      const nextNode: StoryNode = {
        ...result,
        id,
        universeId: u.id,
        parentId,
        choiceIndex: index,
        depth: request.depth,
      };
      if (!isNode(nextNode))
        throw Error("The story response was invalid. Please retry.");
      const nodes = addChild(
        replaceId ? removeBranch(latest.nodes, replaceId) : latest.nodes,
        nextNode,
      );
      commit({
        ...latest,
        universes: latest.universes.some((item) => item.id === u.id)
          ? latest.universes
          : [...latest.universes, u],
        nodes,
      });
      setUniverseId(u.id);
      setNodeId(id);
      setScreen("chapter");
      setReport(false);
      retry.current = null;
    } catch (e) {
      if (!abort.signal.aborted) {
        setDeclined(
          e instanceof ParallelError && e.code === "parallel_declined",
        );
        setError(
          e instanceof Error
            ? e.message
            : "The chapter could not load. Please retry.",
        );
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setPending(false);
      }
    }
  }
  const begin = () => {
    const u: Universe = {
      id: crypto.randomUUID(),
      rootNodeId: crypto.randomUUID(),
      origin,
      createdAt: new Date().toISOString(),
    };
    void generate(u, null, null);
  };
  const choose = (id: string, i: number) => {
    if (universe) void generate(universe, id, i);
  };
  const count = universe ? endingsFound(data.nodes, universe.id) : 0;
  const endings = Object.values(data.nodes).filter(
    (n) => n.universeId === universeId && n.ending,
  );
  const meters = (n: StoryNode) => (
    <div className="py-meters" aria-label="Fictional meters">
      {METERS.map((m) => (
        <div key={m}>
          <span>{m}</span>
          <strong>
            {n.meters[m]}{" "}
            <small>
              {n.deltas[m] >= 0 ? "+" : ""}
              {n.deltas[m]}
            </small>
          </strong>
          <meter
            min={0}
            max={100}
            value={n.meters[m]}
            aria-label={`Fictional ${m}`}
          />
        </div>
      ))}
    </div>
  );
  return (
    <div className="parallel">
      <div className="py-top">
        <span className="hud-label">Mazi / Parallel You</span>
        <span className="py-fiction">AI-written fiction · Sample mode</span>
      </div>
      <p className="py-disclosure">
        These are fictional stories, not predictions. The sample engine is
        deterministic; external AI is disabled. No archive content is used.
      </p>
      {warning && (
        <div role="status" className="py-notice">
          {warning === "corrupt"
            ? "Stored stories could not be read. You can start again; damaged data will be replaced when you save."
            : warning}
        </div>
      )}
      <p className="py-hint">
        Your stories stay in this browser after sign-out. Other people using
        this browser profile may be able to read them. Delete your stories
        before leaving a shared device. This removes only the signed-in member’s
        stories.
      </p>
      <button
        onClick={() => {
          if (
            confirm(
              "Delete your Parallel You stories from this browser? Stories saved by other members will remain.",
            )
          ) {
            try {
              controller.current?.abort();
              retry.current = null;
              clear(localStorage, memberId);
              setScreen("home");
              setNodeId(null);
              setUniverseId(null);
              setData(emptyData());
              dataRef.current = emptyData();
              setWarning(null);
            } catch {
              setWarning(
                "Stories could not be deleted. Check browser storage permissions.",
              );
            }
          }
        }}
      >
        Delete your stories
      </button>
      {enabled === null ? (
        <p role="status">Checking availability…</p>
      ) : !enabled ? (
        <h1 ref={heading} tabIndex={-1}>
          Parallel You is not enabled
        </h1>
      ) : (
        <>
          {screen !== "home" && (
            <div className="py-toolbar">
              <button
                disabled={pending}
                onClick={() => {
                  setScreen("home");
                  setError("");
                  setDeclined(false);
                }}
              >
                Your universes
              </button>
              {universe && (
                <>
                  <span>Endings found: {count} of 12</span>
                  <button disabled={pending} onClick={() => setScreen("map")}>
                    Multiverse map
                  </button>
                </>
              )}
            </div>
          )}
          {screen === "home" && (
            <>
              <h1 ref={heading} tabIndex={-1}>
                What if you chose differently?
              </h1>
              <p className="py-intro">
                One turning point. Three decisions. A dozen possible endings.
                <br />
                Follow a path, then return to the doors you left open.
              </p>
              <button
                className="py-primary"
                onClick={() => {
                  setDeclined(false);
                  setScreen("origin");
                  setUniverseId(null);
                  setNodeId(null);
                  setError("");
                }}
              >
                Begin a universe
              </button>
              <div className="py-universes">
                {data.universes.map((u) => (
                  <article key={u.id}>
                    <span className="hud-label">
                      {u.origin.startYear} · {u.origin.tone}
                    </span>
                    <h2>{u.origin.whatIf}</h2>
                    <p>Endings found: {endingsFound(data.nodes, u.id)} of 12</p>
                    <div className="py-toolbar">
                      <button onClick={() => open(u.rootNodeId)}>
                        Open universe
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Delete this universe and all its branches from this browser?",
                            )
                          )
                            commit(removeUniverse(data, u.id));
                        }}
                      >
                        Delete universe
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {screen === "origin" && (
            <>
              <h1 ref={heading} tabIndex={-1}>
                Where does your path divide?
              </h1>
              <div className="py-examples">
                {examples.map((e) => (
                  <button
                    key={e.label}
                    disabled={pending}
                    onClick={() =>
                      setOrigin({
                        about: e.about,
                        startYear: e.startYear,
                        whatIf: e.whatIf,
                        tone: e.tone,
                      })
                    }
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  begin();
                }}
              >
                <fieldset disabled={pending}>
                  <label>
                    Who you are now
                    <textarea
                      required
                      maxLength={280}
                      value={origin.about}
                      onChange={(e) =>
                        setOrigin({ ...origin, about: e.target.value })
                      }
                    />
                    <small>{origin.about.length}/280 characters</small>
                  </label>
                  <label>
                    Year of the turning point
                    <input
                      type="number"
                      required
                      min={1900}
                      max={2100}
                      value={origin.startYear}
                      onChange={(e) =>
                        setOrigin({
                          ...origin,
                          startYear: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    What if…
                    <textarea
                      required
                      maxLength={280}
                      value={origin.whatIf}
                      onChange={(e) =>
                        setOrigin({ ...origin, whatIf: e.target.value })
                      }
                    />
                    <small>{origin.whatIf.length}/280 characters</small>
                  </label>
                  <label>
                    Tone
                    <select
                      value={origin.tone}
                      onChange={(e) =>
                        setOrigin({
                          ...origin,
                          tone: e.target.value as Origin["tone"],
                        })
                      }
                    >
                      <option value="realistic">Realistic</option>
                      <option value="cinematic">Cinematic</option>
                      <option value="chaotic">Chaotic</option>
                    </select>
                  </label>
                  <p>
                    Use roles rather than real names. Please leave out other
                    people’s sensitive details.
                  </p>
                  <button
                    className="py-primary"
                    disabled={
                      declined || !origin.about.trim() || !origin.whatIf.trim()
                    }
                  >
                    Begin story
                  </button>
                </fieldset>
              </form>
            </>
          )}
          {screen === "chapter" && node && (
            <article className="py-chapter">
              <div className="py-toolbar">
                <span className="hud-label">
                  Chapter {node.depth + 1} · {node.year} · {node.location}
                </span>
                {node.twist && <span className="py-twist">Unexpected</span>}
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {node.title}
              </h1>
              <p className="py-role">{node.career}</p>
              <p className="py-narrative">{node.narrative}</p>
              <h2 className="py-small-heading">Fictional meters</h2>
              {meters(node)}
              <ul className="py-events">
                {node.keyEvents.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {node.ending ? (
                <div className="py-ending">
                  <span className="hud-label">An ending, not the end</span>
                  <h2>{node.ending.title}</h2>
                  <p>{node.ending.epilogue}</p>
                  <button onClick={() => setScreen("map")}>
                    Explore paths not taken
                  </button>
                  <button onClick={() => setScreen("compare")}>
                    Compare endings
                  </button>
                </div>
              ) : (
                <div className="py-choices">
                  {node.choices.map((c, i) => (
                    <button
                      key={i}
                      disabled={pending || declined}
                      onClick={() => choose(node.id, i)}
                    >
                      <strong>{c.label}</strong>
                      <span>{c.description}</span>
                      {childOf(data.nodes, node.id, i) && (
                        <small>Revisit this branch</small>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="py-report"
                disabled={pending}
                onClick={() => setReport(!report)}
              >
                This chapter feels wrong
              </button>
              {report && (
                <div className="py-notice">
                  <p>
                    No report is sent or stored. You can regenerate this chapter
                    or delete it. Either action also removes its descendants.
                  </p>
                  <button
                    disabled={pending || declined}
                    onClick={() => {
                      if (
                        universe &&
                        confirm(
                          "Replace this chapter and remove its descendants?",
                        )
                      )
                        void generate(
                          universe,
                          node.parentId,
                          node.choiceIndex,
                          node.id,
                        );
                    }}
                  >
                    Regenerate chapter
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this chapter and its descendants?")) {
                        const next = node.parentId
                          ? {
                              ...data,
                              nodes: removeBranch(data.nodes, node.id),
                            }
                          : removeUniverse(data, node.universeId);
                        commit(next);
                        if (node.parentId) open(node.parentId);
                        else setScreen("home");
                        setReport(false);
                      }
                    }}
                  >
                    Delete chapter
                  </button>
                </div>
              )}
            </article>
          )}
          {screen === "map" && universe && (
            <>
              <h1 ref={heading} tabIndex={-1}>
                Your multiverse
              </h1>
              <MultiverseMap
                universe={universe}
                nodes={data.nodes}
                current={nodeId}
                onOpen={open}
                onChoose={choose}
                pending={pending}
              />
              <button onClick={() => setScreen("compare")}>
                Compare endings
              </button>
            </>
          )}
          {screen === "compare" && (
            <>
              <h1 ref={heading} tabIndex={-1}>
                Compare endings
              </h1>
              <p>
                Choose two endings from this universe. Fictional meters are not
                scores or predictions.
              </p>
              {endings.length < 2 && (
                <p>Find two endings to compare their paths.</p>
              )}
              <div className="py-examples">
                {endings.map((n) => (
                  <label key={n.id}>
                    <input
                      type="checkbox"
                      checked={compare.includes(n.id)}
                      disabled={!compare.includes(n.id) && compare.length === 2}
                      onChange={(e) =>
                        setCompare(
                          e.target.checked
                            ? [...compare, n.id]
                            : compare.filter((id) => id !== n.id),
                        )
                      }
                    />
                    {n.ending!.title}
                  </label>
                ))}
              </div>
              <div className="py-compare">
                {compare
                  .map((id) => data.nodes[id])
                  .filter(
                    (n): n is StoryNode => !!n && n.universeId === universeId,
                  )
                  .map((n) => (
                    <article key={n.id}>
                      <h2>{n.ending!.title}</h2>
                      <ol>
                        {pathTo(data.nodes, n.id).map((p) => (
                          <li key={p.id}>
                            {p.title} · {p.year}
                            {p.parentId && (
                              <small>
                                {
                                  data.nodes[p.parentId].choices[p.choiceIndex!]
                                    .label
                                }
                              </small>
                            )}
                          </li>
                        ))}
                      </ol>
                      {meters(n)}
                    </article>
                  ))}
              </div>
            </>
          )}
          {notice && (
            <section className="py-notice" aria-label="Story privacy notice">
              <h2>Before you begin</h2>
              <p>
                Your text is sent to Mazi’s local sample engine. No external AI
                provider receives it. Fiction stays in this browser under your
                member profile and remains after sign-out. Avoid real names and
                sensitive details.
              </p>
              <button
                disabled={pending}
                onClick={async () => {
                  const abort = new AbortController();
                  controller.current = abort;
                  setPending(true);
                  try {
                    await parallelRequest(
                      "notice",
                      { version: "sample-v1" },
                      abort.signal,
                    );
                    if (abort.signal.aborted) return;
                    controller.current = null;
                    acceptedRef.current = true;
                    setAccepted(true);
                    setNotice(false);
                    setPending(false);
                    retry.current?.();
                  } catch (e) {
                    if (!abort.signal.aborted) {
                      controller.current = null;
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Could not save notice acceptance.",
                      );
                      setPending(false);
                    }
                  }
                }}
              >
                Accept and continue
              </button>
            </section>
          )}
          {pending && (
            <p role="status" className="py-loading">
              Writing the next possibility…
            </p>
          )}
          {error && (
            <div className="py-notice" role="alert">
              <h2>
                {declined
                  ? "Let’s pause this story"
                  : "The story could not continue"}
              </h2>
              <p>{error}</p>
              {!declined && retry.current && (
                <button disabled={pending} onClick={() => retry.current?.()}>
                  Retry
                </button>
              )}
            </div>
          )}
        </>
      )}
      <footer className="py-footer">
        AI-written fiction · Fictional meters · Private to this browser
      </footer>
    </div>
  );
}
