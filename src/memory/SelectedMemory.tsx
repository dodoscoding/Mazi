import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { MemoryNotFound, MemoryView } from "../MemoryView";
import type { Memory } from "../memories";
import { evidencePin } from "./evidence";

type Props = Omit<
  ComponentProps<typeof MemoryView>,
  "memory" | "discussion"
> & {
  id: string;
  memory?: Memory;
  search: string;
};
type State =
  | { kind: "loading" | "denied" | "error" }
  | { kind: "ready"; memory: Memory; error?: string };
export default function SelectedMemory({
  id,
  memory,
  search,
  ...props
}: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  const retry = () => setVersion((value) => value + 1);
  useEffect(() => {
    const request = new AbortController();
    setState((previous) =>
      previous.kind === "ready" ? previous : { kind: "loading" },
    );
    const clear = () => {
      request.abort();
      setState({ kind: "denied" });
    };
    const events = ["mazi:access-lost", "mazi:session", "mazi:group"];
    events.forEach((event) => window.addEventListener(event, clear));
    const refresh = () => retry();
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("mazi:archive-changed", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visible);
    void (async () => {
      if (props.demo) {
        setState(memory ? { kind: "ready", memory } : { kind: "denied" });
        return;
      }
      try {
        const response = await fetch(
          `/api/atlas/memory?${new URLSearchParams({ group: props.group, memory: id })}`,
          { signal: request.signal, cache: "no-store" },
        );
        const value = await response.json();
        if (request.signal.aborted) return;
        if ([401, 403, 404].includes(response.status)) {
          clear();
          return;
        }
        if (!response.ok) throw Error();
        setState({
          kind: "ready",
          memory: { ...value.memory, place: evidencePin(value.memory) },
        });
      } catch {
        if (!request.signal.aborted)
          setState((previous) =>
            previous.kind === "ready"
              ? { ...previous, error: "Anı yeniden kontrol edilemedi." }
              : { kind: "error" },
          );
      }
    })();
    return () => {
      request.abort();
      events.forEach((event) => window.removeEventListener(event, clear));
      window.removeEventListener("mazi:archive-changed", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [id, props.group, props.demo, memory, version]);
  useEffect(() => {
    if (
      state.kind !== "loading" &&
      (state.kind !== "ready" ||
        (!props.notebook && !new URLSearchParams(search).has("discussion")))
    )
      props.heading.current?.focus({ preventScroll: true });
  }, [state.kind]);
  const discussion = new URLSearchParams(search).get("discussion");
  if (state.kind === "loading") return <p role="status">Anı yükleniyor…</p>;
  if (state.kind === "denied")
    return <MemoryNotFound link={props.link} heading={props.heading} />;
  if (state.kind === "error")
    return (
      <section role="alert">
        <h1 ref={props.heading} tabIndex={-1}>
          Anı yüklenemedi
        </h1>
        <button className="button button--primary" onClick={retry}>
          Yeniden dene
        </button>
      </section>
    );
  if (state.kind !== "ready") return null;
  if (
    !Number.isInteger(props.photo) ||
    props.photo < 0 ||
    props.photo >= state.memory.photos.length
  )
    return <MemoryNotFound link={props.link} heading={props.heading} />;
  return (
    <>
      {state.error && (
        <p role="alert">
          {state.error}{" "}
          <button className="button button--secondary" onClick={retry}>
            Yeniden dene
          </button>
        </p>
      )}
      <MemoryView
        {...props}
        memory={state.memory}
        discussion={
          discussion === "photo" || discussion === "memory"
            ? discussion
            : undefined
        }
      />
    </>
  );
}
