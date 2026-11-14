import { useEffect, useRef, useState } from "react";
import "./styles/past-creations.css";

type Story = {
  id: string;
  revision: number;
  can_delete: boolean;
  event: { id: string; title: string; assets: string[] };
  contributions: { author: string; text: string }[];
  subevents: { title: string; assets: string[] }[];
  notice: string;
};
type Capsule = {
  id: string;
  unlock_at: number;
  locked: boolean;
  can_delete: boolean;
};
type OpenedCapsule = { title: string; text: string; has_photo: boolean };
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stories: Story[]; capsules: Capsule[] };

async function request(path: string, signal?: AbortSignal, body?: object) {
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
    throw Error("This creation is no longer available.");
  }
  if (!response.ok) {
    const error = await response.json();
    throw Error(error.error || "Past creations could not load. Please retry.");
  }
  const json = response.json.bind(response);
  const blob = response.blob.bind(response);
  response.json = async () => {
    const value = await json();
    if (signal?.aborted) throw new DOMException("Read cancelled", "AbortError");
    return value;
  };
  response.blob = async () => {
    const value = await blob();
    if (signal?.aborted) throw new DOMException("Read cancelled", "AbortError");
    return value;
  };
  return response;
}
function CreationPhoto({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setUrl("");
    setFailed(false);
    void request(path, controller.signal)
      .then((response) => response.blob())
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return url ? (
    <img src={url} alt={alt} />
  ) : (
    <p role="status">
      {failed ? "Photograph unavailable." : "Loading photograph…"}
    </p>
  );
}

export default function PastCreations({
  group,
  preview = false,
  search = "",
}: {
  group: string;
  preview?: boolean;
  search?: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [revision, setRevision] = useState(0);
  const [opened, setOpened] = useState<Record<string, OpenedCapsule>>({});
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<{
    kind: "story" | "capsule";
    id: string;
    revision?: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const controller = useRef(new AbortController());
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reload = () => setRevision((value) => value + 1);
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    setState({ kind: "loading" });
    setOpened({});
    setNotice("");
    const clear = () => {
      abort.abort();
      setState({ kind: "loading" });
      setOpened({});
      setDeleting(null);
    };
    if (group)
      void Promise.all(
        ["stories", "capsules"].map(async (kind) =>
          (
            await request(
              `/api/memories/${kind}?${new URLSearchParams({ group })}`,
              abort.signal,
            )
          ).json(),
        ),
      )
        .then(([stories, capsules]) => {
          if (!abort.signal.aborted)
            setState({ kind: "ready", stories, capsules });
        })
        .catch((error) => {
          if (!abort.signal.aborted)
            setState({ kind: "error", message: error.message });
        });
    window.addEventListener("mazi:access-lost", clear);
    window.addEventListener("mazi:archive-changed", reload);
    return () => {
      abort.abort();
      window.removeEventListener("mazi:access-lost", clear);
      window.removeEventListener("mazi:archive-changed", reload);
    };
  }, [group, revision]);
  useEffect(() => {
    if (!preview) heading.current?.focus();
  }, [preview]);
  useEffect(() => {
    if (deleting && !dialog.current?.open) dialog.current?.showModal();
    else if (!deleting) dialog.current?.close();
  }, [deleting]);
  async function act(work: () => Promise<void>) {
    if (pending) return;
    const activeController = controller.current;
    setPending(true);
    setNotice("");
    try {
      await work();
    } catch (error) {
      if (!activeController.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : "Operation failed. Please retry.",
        );
    } finally {
      if (!activeController.signal.aborted) setPending(false);
    }
  }
  async function exportRecord(kind: "story" | "capsule", id: string) {
    const endpoint = kind === "story" ? "export" : "capsule-export";
    const data = await (
      await request(
        `/api/memories/${endpoint}?${new URLSearchParams({ group, [kind]: id })}`,
        controller.current.signal,
      )
    ).json();
    if (controller.current.signal.aborted) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `mazi-${kind}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (preview) {
    if (state.kind === "error")
      return (
        <section className="past-creations">
          <p role="status">{state.message}</p>
          <button onClick={reload}>Retry Past creations</button>
        </section>
      );
    if (
      state.kind !== "ready" ||
      (!state.stories.length && !state.capsules.length)
    )
      return null;
    return (
      <nav className="past-creations" aria-label="Past creations">
        <a className="button button--secondary" href="#/past-creations">
          Past creations
        </a>
      </nav>
    );
  }
  const params = new URLSearchParams(search);
  const storyId = params.get("story"),
    capsuleId = params.get("capsule");
  const stories =
    state.kind === "ready" && !capsuleId
      ? state.stories.filter((item) => !storyId || storyId === item.id)
      : [];
  const capsules =
    state.kind === "ready" && !storyId
      ? state.capsules.filter((item) => !capsuleId || capsuleId === item.id)
      : [];
  return (
    <section className="past-creations" aria-labelledby="past-title">
      <h1 id="past-title" ref={heading} tabIndex={-1}>
        Past creations
      </h1>
      <p>
        Stories and time capsules saved before writing retired. Existing
        recollections are preserved as written.
      </p>
      <a href="#/settings">Back to Settings</a>
      <p role="status">{notice}</p>
      {state.kind === "loading" && <p role="status">Loading Past creations…</p>}
      {state.kind === "error" && (
        <div role="alert">
          <p>{state.message}</p>
          <button onClick={reload}>Try again</button>
        </div>
      )}
      {state.kind === "ready" && !stories.length && !capsules.length && (
        <p>
          {storyId || capsuleId
            ? "This creation is unavailable."
            : "No Past creations are currently available."}
        </p>
      )}
      {stories.map((story) => (
        <article className="past-card" key={story.id}>
          <h2>
            <a href={`#/memory/${story.event.id}?notebook=1`}>
              {story.event.title}
            </a>
          </h2>
          <p>{story.notice}</p>
          <section aria-label="Saved recollections">
            {story.contributions.map((entry) => (
              <p key={entry.author}>{entry.text}</p>
            ))}
          </section>
          {story.subevents.map((section, index) => (
            <p key={index}>
              {section.title} · {section.assets.length} photographs
            </p>
          ))}
          <details>
            <summary>Original photographs</summary>
            <div className="past-photos">
              {story.event.assets.map((asset) => (
                <a
                  href={`/api/archive/${encodeURIComponent(asset)}/original`}
                  key={asset}
                >
                  <CreationPhoto
                    path={`/api/archive/${encodeURIComponent(asset)}/preview`}
                    alt="Original photograph from this saved story"
                  />
                </a>
              ))}
            </div>
          </details>
          <button
            disabled={pending}
            onClick={() => void act(() => exportRecord("story", story.id))}
          >
            Export story JSON
          </button>
          {story.can_delete && (
            <button
              disabled={pending}
              onClick={() =>
                setDeleting({
                  kind: "story",
                  id: story.id,
                  revision: story.revision,
                })
              }
            >
              Delete story
            </button>
          )}
        </article>
      ))}
      {capsules.map((capsule) => (
        <article className="past-card" key={capsule.id}>
          <h2>{capsule.locked ? "Sealed capsule" : "Ready to open"}</h2>
          <p>{new Date(capsule.unlock_at * 1000).toLocaleString()}</p>
          {!capsule.locked && (
            <>
              {opened[capsule.id] ? (
                <div>
                  <h3>{opened[capsule.id].title}</h3>
                  <p>{opened[capsule.id].text}</p>
                  {opened[capsule.id].has_photo && (
                    <CreationPhoto
                      path={`/api/memories/capsule-photo?${new URLSearchParams({ group, capsule: capsule.id })}`}
                      alt="Photograph inside the opened capsule"
                    />
                  )}
                </div>
              ) : (
                <button
                  disabled={pending}
                  onClick={() =>
                    void act(async () => {
                      const result = await (
                        await request(
                          `/api/memories/capsule?${new URLSearchParams({ group, capsule: capsule.id })}`,
                          controller.current.signal,
                        )
                      ).json();
                      if (!controller.current.signal.aborted)
                        setOpened((value) => ({
                          ...value,
                          [capsule.id]: result,
                        }));
                    })
                  }
                >
                  Open capsule
                </button>
              )}
              <button
                disabled={pending}
                onClick={() =>
                  void act(() => exportRecord("capsule", capsule.id))
                }
              >
                Export capsule
              </button>
            </>
          )}
          {capsule.can_delete && (
            <button
              disabled={pending}
              onClick={() => setDeleting({ kind: "capsule", id: capsule.id })}
            >
              Delete capsule
            </button>
          )}
        </article>
      ))}
      <dialog
        ref={dialog}
        role="alertdialog"
        aria-labelledby="past-delete-title"
        onCancel={() => setDeleting(null)}
      >
        <h2 id="past-delete-title">Delete this {deleting?.kind}?</h2>
        <p>
          This removes the saved creation. Original archive photographs remain.
        </p>
        <button
          disabled={pending}
          onClick={() =>
            void act(async () => {
              if (!deleting) return;
              await request(
                `/api/memories/${deleting.kind === "story" ? "delete" : "delete-capsule"}`,
                controller.current.signal,
                {
                  group,
                  [deleting.kind]: deleting.id,
                  ...(deleting.kind === "story"
                    ? { revision: deleting.revision }
                    : {}),
                },
              );
              if (!controller.current.signal.aborted) {
                setDeleting(null);
                reload();
              }
            })
          }
        >
          Delete
        </button>
        <button disabled={pending} onClick={() => setDeleting(null)}>
          Keep it
        </button>
      </dialog>
    </section>
  );
}
