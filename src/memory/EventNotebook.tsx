import { useEffect, useRef, useState } from "react";

type Target =
  { kind: "new" } | { kind: "saved"; storyId: string; revision: number };
type Note = {
  id: string;
  authorName: string;
  text: string;
  ownership: { kind: "other" } | { kind: "mine"; target: Target };
};
type Notebook = { eventId: string; sections: { id: string; notes: Note[] }[] };
type State =
  | { kind: "loading" | "unavailable" }
  | { kind: "error"; message: string }
  | { kind: "ready"; value: Notebook };
function parseNotebook(value: unknown, event: string): Notebook {
  if (
    !value ||
    typeof value !== "object" ||
    !("eventId" in value) ||
    value.eventId !== event ||
    !("sections" in value) ||
    !Array.isArray(value.sections)
  )
    throw Error("Saved recollections could not be read. Try again.");
  for (const section of value.sections) {
    if (typeof section.id !== "string" || !Array.isArray(section.notes))
      throw Error("Invalid saved recollections");
    for (const note of section.notes) {
      if (
        typeof note.id !== "string" ||
        typeof note.text !== "string" ||
        typeof note.authorName !== "string" ||
        !["mine", "other"].includes(note.ownership?.kind)
      )
        throw Error("Invalid saved recollection");
      if (note.ownership.kind === "mine") {
        const target = note.ownership.target;
        if (
          target?.kind !== "saved" ||
          target.storyId !== section.id ||
          !Number.isInteger(target.revision) ||
          target.revision < 1
        )
          throw Error("Invalid recollection revision");
      }
    }
  }
  return value as Notebook;
}

export function EventNotebook({
  group,
  event,
  heading,
}: {
  group: string;
  event: string | null;
  heading?: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let disposed = false;
    const clear = () => {
      generation.current++;
      controller.current?.abort();
      setState({ kind: "unavailable" });
    };
    const load = async () => {
      clear();
      if (!event || !group || disposed) return;
      const version = generation.current;
      controller.current = new AbortController();
      setState({ kind: "loading" });
      try {
        const response = await fetch(
          `/api/memories/notebook?${new URLSearchParams({ group, event })}`,
          { signal: controller.current.signal },
        );
        if (version !== generation.current || disposed) return;
        if (response.status === 401 || response.status === 403) {
          clear();
          window.dispatchEvent(new Event("mazi:access-lost"));
          return;
        }
        const data: unknown = await response.json();
        if (version !== generation.current || disposed) return;
        if (!response.ok)
          throw Error("Saved recollections could not load. Try again.");
        setState({
          kind: "ready",
          value: parseNotebook(data, event),
        });
      } catch (error) {
        if (version === generation.current && !disposed)
          setState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Saved recollections could not load.",
          });
      }
    };
    const accessLost = () => clear();
    void load();
    window.addEventListener("mazi:access-lost", accessLost);
    return () => {
      disposed = true;
      generation.current++;
      controller.current?.abort();
      window.removeEventListener("mazi:access-lost", accessLost);
    };
  }, [group, event, retry]);

  if (!event) return null;
  const notes =
    state.kind === "ready"
      ? state.value.sections.flatMap((section) => section.notes)
      : [];
  return (
    <section className="event-notebook" aria-labelledby="notebook-heading">
      <h2 id="notebook-heading" ref={heading} tabIndex={-1}>
        Notes from your circle
      </h2>
      <p className="notebook-intro">
        Previously saved recollections, alongside the imported excerpts. Story
        writing has retired.
      </p>
      {state.kind === "loading" && (
        <p role="status">Loading saved recollections…</p>
      )}
      {state.kind === "unavailable" && (
        <p>These recollections are unavailable.</p>
      )}
      {state.kind === "error" && (
        <div role="alert">
          <p>{state.message}</p>
          <button
            className="button button--secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {state.kind === "ready" &&
        (notes.length ? (
          <div className="notebook-notes">
            {notes.map((note) => (
              <article className="notebook-note" key={note.id}>
                <header>
                  <h3>{note.authorName}</h3>
                  <span>
                    {note.ownership.kind === "mine"
                      ? "Your recollection"
                      : "Member recollection"}
                  </span>
                </header>
                <p>{note.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="notebook-empty">
            No saved recollections for this memory.
          </p>
        ))}
    </section>
  );
}
