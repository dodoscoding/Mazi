import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Memory, Place } from "../memories";
import { useToast } from "../ui/Toast";
import { Icon } from "../ui/icons";
import { plural, shortDate } from "./format";
import "../styles/place.css";

/** POST /api/atlas/place; the server writes only for "matched" and "empty". */
type PlaceResult = {
  place_match: "matched" | "ambiguous" | "missing" | "empty";
  place: string | null;
  candidates: string[];
  pin: Place | null;
};

type Outcome =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "missing"; text: string }
  | { kind: "error"; message: string };

export type OnPlaced = (memory: string, pin: Place | null) => void;

async function placeMemory(group: string, memory: string, place: string) {
  const response = await fetch("/api/atlas/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group, memory, place }),
  });
  if (response.status === 401 || response.status === 403) {
    if (response.status === 401)
      window.dispatchEvent(new Event("mazi:access-lost"));
    throw Error(
      "This memory is no longer available to you. Refresh to check access.",
    );
  }
  if (!response.ok)
    throw Error(
      "The place couldn't be saved. Check your connection and retry.",
    );
  return (await response.json()) as PlaceResult;
}

/**
 * Atlas cards with places named here. A matched place is shown at once from the
 * server's pin, then the Atlas is reread so a cleared place falls back to its
 * source location. A newer archive load replaces both.
 */
export function usePlacedMemories(source: Memory[], group: string) {
  const [override, setOverride] = useState<{
    source: Memory[];
    memories: Memory[];
  } | null>(null);
  const memories =
    override && override.source === source ? override.memories : source;
  const latest = useRef(0);
  const placed = useCallback<OnPlaced>(
    (id, pin) => {
      const request = ++latest.current;
      if (pin)
        setOverride((current) => ({
          source,
          memories: (current?.source === source
            ? current.memories
            : source
          ).map((memory) =>
            memory.id === id ? { ...memory, place: pin } : memory,
          ),
        }));
      void fetch("/api/atlas?" + new URLSearchParams({ group }))
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { memories: Memory[] } | null) => {
          if (body && request === latest.current)
            setOverride({ source, memories: body.memories });
        })
        .catch(() => {});
    },
    [source, group],
  );
  return { memories, placed };
}

/** Type a city for one memory; ambiguous names offer their candidates as choices. */
export function PlaceForm({
  group,
  memory,
  onPlaced,
  autoFocus = false,
}: {
  group: string;
  memory: Memory;
  onPlaced: OnPlaced;
  autoFocus?: boolean;
}) {
  const toast = useToast();
  const id = useId();
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const save = async (place: string) => {
    setOutcome({ kind: "saving" });
    try {
      const result = await placeMemory(group, memory.id, place);
      if (result.place_match === "ambiguous")
        return setOutcome({
          kind: "ambiguous",
          candidates: result.candidates,
        });
      if (result.place_match === "missing")
        return setOutcome({ kind: "missing", text: place.trim() });
      setOutcome({ kind: "idle" });
      setText("");
      toast.show({
        message: result.place
          ? `${memory.shortTitle} is pinned in ${result.place}.`
          : `Place cleared from ${memory.shortTitle}.`,
        tone: "success",
      });
      onPlaced(memory.id, result.pin);
    } catch (error) {
      setOutcome({
        kind: "error",
        message:
          error instanceof Error ? error.message : "The place wasn't saved.",
      });
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim()) void save(text);
  };
  const saving = outcome.kind === "saving";
  return (
    <form className="place-form" onSubmit={submit} aria-busy={saving}>
      <label className="visually-hidden" htmlFor={id}>
        City for {memory.shortTitle}
      </label>
      <div className="place-field">
        <input
          ref={input}
          id={id}
          type="text"
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          placeholder="Type a city, e.g. Girne"
          maxLength={200}
          value={text}
          aria-invalid={outcome.kind === "missing" || undefined}
          aria-describedby={`${id}-status`}
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="submit"
          className="button button--primary"
          disabled={saving || !text.trim()}
        >
          {saving ? "Placing…" : "Place"}
        </button>
      </div>
      <div id={`${id}-status`} className="place-status" role="status">
        {outcome.kind === "ambiguous" && (
          <>
            <p>Several places have that name. Which one?</p>
            <ul className="place-candidates">
              {outcome.candidates.map((candidate) => (
                <li key={candidate}>
                  <button
                    type="button"
                    className="place-candidate"
                    onClick={() => {
                      setText(candidate);
                      void save(candidate);
                    }}
                  >
                    {candidate}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {outcome.kind === "missing" && (
          <p className="is-error">
            “{outcome.text}” isn't on the map. Check the spelling or add the
            country, e.g. “Victoria, CA”.
          </p>
        )}
        {outcome.kind === "error" && (
          <p className="is-error">{outcome.message}</p>
        )}
      </div>
      {memory.place && (
        <button
          type="button"
          className="button button--ghost place-clear"
          disabled={saving}
          onClick={() => void save("")}
        >
          Clear {memory.place.name}
        </button>
      )}
    </form>
  );
}

/** Memories with no place, beside the globe; pick one and name its city to pin it. */
export function UnplacedTray({
  group,
  memories,
  onPlaced,
  onSelect,
  defaultOpen,
  closeOnPlace = false,
}: {
  group: string;
  memories: Memory[];
  onPlaced: OnPlaced;
  onSelect: (id: string) => void;
  defaultOpen: boolean;
  /** On a phone the open tray covers the globe, so it closes to show the new pin. */
  closeOnPlace?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [active, setActive] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const listId = useId();
  if (!memories.length) return null;
  const placed: OnPlaced = (memory, pin) => {
    setActive(null);
    if (closeOnPlace) setOpen(false);
    toggle.current?.focus({ preventScroll: true });
    onPlaced(memory, pin);
  };
  return (
    <section
      className="place-tray"
      data-open={open || undefined}
      aria-label="Unplaced memories"
    >
      <button
        ref={toggle}
        type="button"
        className="place-tray-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="pin" size={16} />
        <span className="place-tray-title">Unplaced memories</span>
        <span className="place-tray-count">{memories.length}</span>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
      </button>
      <div className="place-tray-body" id={listId} hidden={!open}>
        <p className="place-tray-hint">
          Name a city and every photo in the memory is pinned there.
        </p>
        <ul className="place-tray-list">
          {memories.map((memory) => {
            const expanded = active === memory.id;
            return (
              <li key={memory.id} data-active={expanded || undefined}>
                <button
                  type="button"
                  className="place-tray-row"
                  aria-expanded={expanded}
                  onClick={() => {
                    setActive(expanded ? null : memory.id);
                    if (!expanded) onSelect(memory.id);
                  }}
                >
                  <img src={memory.photos[0]?.src} alt="" loading="lazy" />
                  <span className="place-tray-copy">
                    <span className="place-tray-name">{memory.shortTitle}</span>
                    <span className="place-tray-meta">
                      {[
                        shortDate(memory),
                        plural(memory.photos.length, "photo"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
                {expanded && (
                  <PlaceForm
                    group={group}
                    memory={memory}
                    onPlaced={placed}
                    autoFocus
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
