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
type Editor =
  | { kind: "closed" }
  | {
      kind: "draft" | "saving" | "conflict" | "removed";
      target: Target;
      text: string;
      error: string;
    };
type State =
  | { kind: "loading" | "unavailable" }
  | { kind: "error"; message: string }
  | { kind: "ready"; value: Notebook; editor: Editor; notice: string };

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
  const current = useRef(state);
  current.current = state;
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let disposed = false;
    const clear = () => {
      generation.current++;
      controller.current?.abort();
      pending.current = false;
      current.current = { kind: "unavailable" };
      setState(current.current);
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
          editor: { kind: "closed" },
          notice: "",
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
      pending.current = false;
      current.current = { kind: "unavailable" };
      window.removeEventListener("mazi:access-lost", accessLost);
    };
  }, [group, event, retry]);

  function edit(target: Target, text: string, button: HTMLButtonElement) {
    opener.current = button;
    setState((saved) =>
      saved.kind === "ready"
        ? {
            ...saved,
            editor: { kind: "draft", target, text, error: "" },
            notice: "",
          }
        : saved,
    );
    requestAnimationFrame(() => input.current?.focus());
  }
  function close() {
    if (pending.current) return;
    setState((saved) =>
      saved.kind === "ready" ? { ...saved, editor: { kind: "closed" } } : saved,
    );
    requestAnimationFrame(() =>
      opener.current?.isConnected
        ? opener.current.focus()
        : heading?.current?.focus(),
    );
  }
  async function save(remove = false, refresh = false) {
    const saved = current.current;
    if (
      !event ||
      pending.current ||
      saved.kind !== "ready" ||
      saved.editor.kind === "closed" ||
      (!refresh && saved.editor.kind !== "draft")
    )
      return;
    const editor = saved.editor;
    const version = generation.current;
    pending.current = true;
    setState({ ...saved, editor: { ...editor, kind: "saving", error: "" } });
    try {
      const response = await fetch(
        refresh
          ? `/api/memories/notebook?${new URLSearchParams({ group, event })}`
          : "/api/memories/note",
        {
          signal: controller.current?.signal,
          ...(refresh
            ? {}
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  group,
                  event,
                  target: editor.target,
                  text: remove ? "" : editor.text,
                }),
              }),
        },
      );
      if (version !== generation.current) return;
      if (response.status === 401 || response.status === 403) {
        generation.current++;
        controller.current?.abort();
        setState({ kind: "unavailable" });
        window.dispatchEvent(new Event("mazi:access-lost"));
        return;
      }
      const data: unknown = await response.json();
      if (version !== generation.current) return;
      if (!response.ok) {
        const message =
          response.status === 409
            ? "Saved notes changed. Refresh saved notes before trying again."
            : "Your recollection could not save. Your draft is still here. Try again.";
        setState((latest) =>
          latest.kind === "ready" && latest.editor.kind !== "closed"
            ? {
                ...latest,
                editor: {
                  ...latest.editor,
                  kind:
                    response.status === 409 || refresh ? "conflict" : "draft",
                  error: message,
                },
              }
            : latest,
        );
        return;
      }
      const value = parseNotebook(data, event);
      setState((latest) => {
        if (latest.kind !== "ready" || latest.editor.kind === "closed")
          return latest;
        const mine = value.sections
          .flatMap((section) => section.notes)
          .filter((note) => note.ownership.kind === "mine");
        const match =
          editor.target.kind === "new"
            ? mine[0]
            : mine.find(
                (note) =>
                  note.ownership.kind === "mine" &&
                  note.ownership.target.kind === "saved" &&
                  editor.target.kind === "saved" &&
                  note.ownership.target.storyId === editor.target.storyId,
              );
        const changed = latest.editor.text !== editor.text;
        if (editor.target.kind === "saved" && !match && (refresh || changed)) {
          return {
            kind: "ready",
            value,
            editor: {
              ...latest.editor,
              target: mine.length ? editor.target : { kind: "new" },
              kind: mine.length ? "removed" : "draft",
              error: mine.length
                ? "Copy your draft before cancelling, then choose the recollection you want to edit. Your other saved recollections are unchanged."
                : "",
            },
            notice:
              "The saved recollection was removed. Your draft is still here.",
          };
        }
        const target =
          match?.ownership.kind === "mine"
            ? match.ownership.target
            : ({ kind: "new" } as const);
        return {
          kind: "ready",
          value,
          editor:
            refresh || changed
              ? { ...latest.editor, target, kind: "draft", error: "" }
              : { kind: "closed" },
          notice: refresh
            ? "Saved notes refreshed. Review your draft, then save again."
            : remove
              ? "Your recollection was removed."
              : "Your recollection was saved.",
        };
      });
      requestAnimationFrame(() => {
        if (version !== generation.current) return;
        if (refresh) input.current?.focus();
        else if (!input.current) {
          if (opener.current?.isConnected) opener.current.focus();
          else heading?.current?.focus({ preventScroll: true });
        }
      });
    } catch {
      if (version === generation.current)
        setState((latest) =>
          latest.kind === "ready" && latest.editor.kind !== "closed"
            ? {
                ...latest,
                editor: {
                  ...latest.editor,
                  kind: refresh ? "conflict" : "draft",
                  error:
                    "The connection failed. Your draft is still here. Try again.",
                },
              }
            : latest,
        );
    } finally {
      if (version === generation.current) pending.current = false;
    }
  }

  if (!event) return null;
  const notes =
    state.kind === "ready"
      ? state.value.sections.flatMap((section) => section.notes)
      : [];
  const editor =
    state.kind === "ready" ? state.editor : ({ kind: "closed" } as const);
  return (
    <section className="event-notebook" aria-labelledby="notebook-heading">
      <h2 id="notebook-heading" ref={heading} tabIndex={-1}>
        The circle remembers
      </h2>
      <p className="notebook-intro">
        Recollections written by your circle, alongside the imported excerpts.
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
      {state.kind === "ready" && (
        <>
          {notes.length ? (
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
                  {note.ownership.kind === "mine" && (
                    <button
                      className="button button--ghost"
                      disabled={editor.kind !== "closed"}
                      onClick={(event) => {
                        if (note.ownership.kind === "mine")
                          edit(
                            note.ownership.target,
                            note.text,
                            event.currentTarget,
                          );
                      }}
                    >
                      Edit your recollection
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="notebook-empty">
              What stays with you from this day? Leave the first recollection
              for your circle.
            </p>
          )}
          {editor.kind === "closed" &&
            !notes.some((note) => note.ownership.kind === "mine") && (
              <button
                className="button button--primary"
                onClick={(event) =>
                  edit({ kind: "new" }, "", event.currentTarget)
                }
              >
                Add your recollection
              </button>
            )}
          {editor.kind !== "closed" && (
            <form
              className="notebook-editor"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                }
              }}
            >
              <label htmlFor="notebook-draft">Your recollection</label>
              <textarea
                id="notebook-draft"
                ref={input}
                maxLength={2000}
                value={editor.text}
                onChange={(event) => {
                  const text = event.target.value;
                  setState((latest) =>
                    latest.kind === "ready" && latest.editor.kind !== "closed"
                      ? { ...latest, editor: { ...latest.editor, text } }
                      : latest,
                  );
                }}
              />
              <p className="notebook-hint">
                Shared with current circle members.{" "}
                {editor.text.length.toLocaleString()} / 2,000 characters.
              </p>
              {editor.error && <p role="alert">{editor.error}</p>}
              <div className="notebook-actions">
                <button
                  className="button button--primary"
                  disabled={editor.kind !== "draft" || !editor.text.trim()}
                >
                  Save recollection
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={editor.kind === "saving"}
                  onClick={close}
                >
                  Cancel
                </button>
                {editor.target.kind === "saved" && (
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={editor.kind !== "draft"}
                    onClick={() => void save(true)}
                  >
                    Remove my recollection
                  </button>
                )}
                {editor.kind === "conflict" && (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => void save(false, true)}
                  >
                    Refresh saved notes
                  </button>
                )}
              </div>
            </form>
          )}
          <p className="notebook-status" role="status">
            {state.notice || (editor.kind === "saving" ? "Saving…" : "")}
          </p>
        </>
      )}
    </section>
  );
}
