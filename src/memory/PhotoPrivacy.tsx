import { useEffect, useRef, useState } from "react";

type Subject = { id: string; name: string; is_me: boolean; assets: string[] };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; subjects: Subject[] };

export default function PhotoPrivacy({
  group,
  asset,
}: {
  group: string;
  asset: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const controller = useRef<AbortController | null>(null);
  async function request(path: string, signal: AbortSignal, body?: object) {
    const response = await fetch(path, {
      signal,
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new Event("mazi:access-lost"));
      throw Error("Photograph access changed.");
    }
    const value = await response.json();
    if (signal.aborted) throw new DOMException("Read cancelled", "AbortError");
    if (!response.ok)
      throw Error(
        value.error || "Privacy controls could not load. Please retry.",
      );
    return value;
  }
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    setState({ kind: "loading" });
    setNotice("");
    setBusy(false);
    void request(
      `/api/discovery/state?${new URLSearchParams({ group })}`,
      current.signal,
    )
      .then((value) => {
        if (!current.signal.aborted)
          setState({
            kind: "ready",
            subjects: value.people.filter(
              (person: Subject) =>
                person.is_me && person.assets.includes(asset),
            ),
          });
      })
      .catch((error) => {
        if (!current.signal.aborted)
          setState({ kind: "error", message: error.message });
      });
    const refresh = () => setRetry((value) => value + 1);
    const clear = () => {
      current.abort();
      setState({ kind: "loading" });
      setNotice("");
    };
    window.addEventListener("mazi:archive-changed", refresh);
    window.addEventListener("mazi:access-lost", clear);
    return () => {
      current.abort();
      window.removeEventListener("mazi:archive-changed", refresh);
      window.removeEventListener("mazi:access-lost", clear);
    };
  }, [group, asset, retry]);
  async function mutate(path: string, body: object) {
    if (busy || state.kind !== "ready" || !controller.current) return;
    const current = controller.current;
    setBusy(true);
    setNotice("");
    try {
      await request(`/api/discovery/${path}`, current.signal, body);
      if (!current.signal.aborted)
        window.dispatchEvent(new Event("mazi:archive-changed"));
    } catch (error) {
      if (!current.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not save. Please retry.",
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="fact photo-privacy"
      aria-label="Personal photograph controls"
    >
      <h3>My discovery visibility</h3>
      <p>
        Hiding applies to this photograph in your discovery views only. Other
        members keep access; original contributions are unchanged. Restore it in
        Settings.
      </p>
      {state.kind === "loading" && (
        <p role="status">Loading privacy controls…</p>
      )}
      {state.kind === "error" && (
        <div role="alert">
          <p>{state.message}</p>
          <button
            className="button button--secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry privacy controls
          </button>
        </div>
      )}
      {state.kind === "ready" && (
        <>
          <button
            className="button button--secondary"
            disabled={busy}
            onClick={() => void mutate("hide", { asset, enabled: true })}
          >
            Hide this photograph from my discovery
          </button>
          {state.subjects.map((subject) => (
            <button
              className="button button--ghost"
              key={subject.id}
              disabled={busy}
              onClick={() =>
                void mutate("disassociate", { person: subject.id, asset })
              }
            >
              Remove my {subject.name} association
            </button>
          ))}
        </>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
