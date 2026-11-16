import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./conversation.css";

type Target = { kind: "photo" | "memory" | "comment"; id: string };
type Comment = {
  id: string;
  author: { id: string; name: string };
  text: string;
  revision: number;
  created_at: number;
  updated_at: number;
  editable: boolean;
};
type Page = { items: Comment[]; total: number; next_cursor: string | null };
type Reaction = {
  emoji: string;
  count: number;
  mine: boolean;
  members: { id: string; name: string }[];
  members_truncated: boolean;
};
type Aggregate = { target: Target; total: number; reactions: Reaction[] };
type View =
  | { kind: "loading" | "denied" | "error" }
  | { kind: "ready"; page: Page; reactions: Aggregate[] };
type Editor = { text: string; comment: Comment | null };
type Command = { route: string; body: Record<string, unknown> };
class ApiError extends Error {
  constructor(readonly status: number) {
    super();
  }
}
const emojiNames: Record<string, string> = {
  "👍": "Beğendim",
  "❤️": "Sevdim",
  "😂": "Güldüm",
  "🎉": "Kutluyorum",
};
const key = (target: Target) => `${target.kind}:${target.id}`;
const date = (epoch: number) =>
  new Date(epoch * 1000).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function ConversationPanel({
  group,
  target,
  focus = false,
}: {
  group: string;
  target: { kind: "photo" | "memory"; id: string };
  focus?: boolean;
}) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [editor, setEditor] = useState<Editor>({ text: "", comment: null });
  const [retry, setRetry] = useState<Command | null>(null);
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<Comment | null>(null);
  const [confirmed, setConfirmed] = useState<Comment | null>(null);
  const [cursor, setCursor] = useState("");
  const controller = useRef(new AbortController());
  const generation = useRef(0);
  const writing = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const focused = useRef(false);
  const pageCursor = useRef("");
  const alive = () => !controller.current.signal.aborted;
  function clear() {
    controller.current.abort();
    generation.current++;
    writing.current = false;
    setView({ kind: "denied" });
    setEditor({ text: "", comment: null });
    setRetry(null);
    setConfirm(null);
    setConfirmed(null);
    setPending(false);
    setConflict(false);
    setNotice("");
    setCursor("");
  }
  async function request(path: string, body?: Record<string, unknown>) {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      signal: controller.current.signal,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const value = await response.json();
    if (!response.ok) throw new ApiError(response.status);
    return value;
  }
  function denied(error: unknown) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      clear();
      if (error.status === 401)
        window.dispatchEvent(new Event("mazi:access-lost"));
      return true;
    }
    return false;
  }
  async function load(next = "", retain = false, saved?: Comment) {
    if (!alive()) return;
    const version = ++generation.current;
    setConfirmed(saved || null);
    if (next !== pageCursor.current) focused.current = false;
    pageCursor.current = next;
    setCursor(next);
    if (!retain) setView({ kind: "loading" });
    try {
      const page: Page = await request(
        `/api/social/comments?${new URLSearchParams({
          group,
          kind: target.kind,
          target: target.id,
          limit: "20",
          ...(next ? { cursor: next } : {}),
        })}`,
      );
      if (!alive() || version !== generation.current) return;
      const targets: Target[] = [
        target,
        ...page.items.map(({ id }) => ({ kind: "comment" as const, id })),
      ];
      const batch: { items: Aggregate[] } = await request(
        `/api/social/reactions/batch?${new URLSearchParams({ group, targets: JSON.stringify(targets) })}`,
      );
      if (!alive() || version !== generation.current) return;
      setCursor(next);
      setConfirmed(
        saved && !page.items.some(({ id }) => id === saved.id) ? saved : null,
      );
      setView({ kind: "ready", page, reactions: batch.items });
    } catch (error) {
      if (!alive() || version !== generation.current || denied(error)) return;
      setView({ kind: "error" });
    }
  }
  useEffect(() => {
    clear();
    focused.current = false;
    controller.current = new AbortController();
    void load();
    const invalidate = () => clear();
    const refresh = () => {
      if (!writing.current && alive()) void load(pageCursor.current, true);
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const events = ["mazi:access-lost", "mazi:session", "mazi:group"];
    events.forEach((event) => window.addEventListener(event, invalidate));
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.current.abort();
      generation.current++;
      events.forEach((event) => window.removeEventListener(event, invalidate));
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [group, target.kind, target.id]);
  useEffect(() => {
    if (focus && view.kind === "ready" && !focused.current) {
      focused.current = true;
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [focus, target.kind, target.id, view.kind === "loading"]);
  async function execute(command: Command) {
    if (!alive() || writing.current) return;
    const signal = controller.current.signal;
    writing.current = true;
    setPending(true);
    if (command.route === "comments/delete") {
      focused.current = false;
      setView({ kind: "loading" });
    }
    setNotice("");
    generation.current++;
    try {
      const result = await request(
        `/api/social/${command.route}`,
        command.body,
      );
      if (signal.aborted) return;
      setRetry(null);
      setConfirm(null);
      if (
        command.route === "comments/create" ||
        ((command.route === "comments/update" ||
          command.route === "comments/delete") &&
          editor.comment?.id === command.body.comment)
      ) {
        setEditor({ text: "", comment: null });
        setConflict(false);
      }
      setNotice("Kaydedildi.");
      await load(
        cursor,
        true,
        command.route === "comments/create" && !result.deleted
          ? result
          : undefined,
      );
    } catch (error) {
      if (signal.aborted || denied(error)) return;
      if (error instanceof ApiError && error.status === 409) {
        setRetry(null);
        setConflict(true);
        setNotice(
          "Yorum değişti. Güncel yorumları yükle; taslağın burada kalacak.",
        );
      } else if (error instanceof ApiError && error.status === 400) {
        setRetry(null);
        setNotice("Yorum kaydedilemedi. Metni kontrol edip yeniden dene.");
      } else {
        setRetry(command);
        setNotice(
          "İşlemin sonucu doğrulanamadı. Aynı işlemi yeniden dene; taslağın burada duruyor.",
        );
      }
    } finally {
      if (!signal.aborted) {
        writing.current = false;
        setPending(false);
      }
    }
  }
  const send = (route: string, body: Record<string, unknown>) =>
    execute({
      route,
      body: { ...body, group, request_key: crypto.randomUUID() },
    });
  const blocked = pending || !!retry;
  const current =
    view.kind === "ready" && editor.comment
      ? view.page.items.find(({ id }) => id === editor.comment?.id)
      : null;
  const staleMissing = !!editor.comment && view.kind === "ready" && !current;
  function save(event: FormEvent) {
    event.preventDefault();
    if (blocked || !editor.text.trim() || staleMissing) return;
    if (editor.comment)
      void send("comments/update", {
        comment: editor.comment.id,
        revision: (conflict && current ? current : editor.comment).revision,
        text: editor.text,
      });
    else void send("comments/create", { target, text: editor.text });
  }
  function reactions(value: Target, label: string) {
    if (view.kind !== "ready") return null;
    const aggregate = view.reactions.find(
      (item) => key(item.target) === key(value),
    );
    if (!aggregate) return null;
    return (
      <div
        className="native-reactions"
        role="group"
        aria-label={`${label} tepkileri`}
      >
        {aggregate.reactions.map((reaction) => (
          <div key={reaction.emoji}>
            <button
              type="button"
              className="reaction-button"
              aria-pressed={reaction.mine}
              aria-label={`${label}: ${emojiNames[reaction.emoji]}, ${reaction.count}`}
              aria-disabled={blocked}
              onClick={() =>
                !blocked &&
                void send("reactions/set", {
                  target: value,
                  emoji: reaction.emoji,
                  active: !reaction.mine,
                })
              }
            >
              <span aria-hidden="true">{reaction.emoji}</span> {reaction.count}
            </button>
            {reaction.members.length > 0 && (
              <details>
                <summary>
                  <span className="visually-hidden">
                    {emojiNames[reaction.emoji]}:{" "}
                  </span>
                  Kimler?
                </summary>
                <p>
                  {reaction.members.map(({ name }) => name).join(", ")}
                  {reaction.members_truncated ? " · ve diğer grup üyeleri" : ""}
                </p>
              </details>
            )}
          </div>
        ))}
      </div>
    );
  }
  const title = target.kind === "photo" ? "Fotoğraf üzerine" : "Anı üzerine";
  return (
    <section className="native-conversation" aria-label={title}>
      <h2 ref={heading} tabIndex={-1}>
        {title}
      </h2>
      <p className="conversation-hint">
        {target.kind === "photo"
          ? "Yalnızca seçili fotoğrafın sohbeti."
          : "Bu anının ortak sohbeti. Fotoğrafların sohbetleri ayrı kalır."}
      </p>
      {view.kind === "denied" ? (
        <p>
          Bu sohbet kullanılamıyor. İçerik kaldırılmış veya erişimin değişmiş
          olabilir.
        </p>
      ) : (
        <>
          {view.kind === "loading" && <p role="status">Sohbet yükleniyor…</p>}
          {view.kind === "error" && (
            <p role="alert">
              Sohbet yüklenemedi.{" "}
              <button className="text-link" onClick={() => void load(cursor)}>
                Yeniden dene
              </button>
            </p>
          )}
          {view.kind === "ready" && (
            <>
              {reactions(target, target.kind === "photo" ? "Fotoğraf" : "Anı")}
              <p className="conversation-total">{view.page.total} yorum</p>
              {!view.page.items.length && (
                <p>Henüz yorum yok. İlk sözü sen söyle.</p>
              )}
              <ol className="native-comments">
                {view.page.items.map((comment) => (
                  <li key={comment.id}>
                    <article aria-label={`${comment.author.name} yorumu`}>
                      <header>
                        <b>{comment.author.name}</b>
                        <time
                          dateTime={new Date(
                            comment.created_at * 1000,
                          ).toISOString()}
                        >
                          {date(comment.created_at)}
                        </time>
                        {comment.updated_at !== comment.created_at && (
                          <span>Düzenlendi</span>
                        )}
                      </header>
                      <p className="comment-text">{comment.text}</p>
                      {reactions(
                        { kind: "comment", id: comment.id },
                        `${comment.author.name} yorumu`,
                      )}
                      {comment.editable && (
                        <div className="conversation-actions">
                          <button
                            className="text-link"
                            disabled={blocked}
                            onClick={() => {
                              setEditor({ text: comment.text, comment });
                              setConflict(false);
                              setConfirm(null);
                              input.current?.focus();
                            }}
                          >
                            Düzenle
                          </button>
                          <button
                            className="text-link"
                            disabled={blocked}
                            onClick={() => setConfirm(comment)}
                          >
                            Sil
                          </button>
                        </div>
                      )}
                      {confirm?.id === comment.id && (
                        <div
                          className="conversation-confirm"
                          role="group"
                          aria-label="Yorumu silmeyi onayla"
                        >
                          <p>Bu yorum ve tepkileri silinsin mi?</p>
                          <button
                            className="button button--secondary"
                            disabled={blocked}
                            onClick={() =>
                              void send("comments/delete", {
                                comment: comment.id,
                                revision: comment.revision,
                              })
                            }
                          >
                            Yorumu sil
                          </button>
                          <button
                            className="button button--ghost"
                            disabled={blocked}
                            onClick={() => setConfirm(null)}
                          >
                            Vazgeç
                          </button>
                        </div>
                      )}
                    </article>
                  </li>
                ))}
              </ol>
              <nav
                className="conversation-actions"
                aria-label="Yorum sayfaları"
              >
                {cursor && (
                  <button
                    className="button button--secondary"
                    disabled={blocked}
                    onClick={() => void load()}
                  >
                    İlk yorumlar
                  </button>
                )}
                {view.page.next_cursor && (
                  <button
                    className="button button--secondary"
                    disabled={blocked}
                    onClick={() => void load(view.page.next_cursor!)}
                  >
                    Sonraki yorumlar
                  </button>
                )}
              </nav>
            </>
          )}
          {confirmed && (
            <aside className="confirmed-comment" aria-label="Kaydedilen yorum">
              <p>
                <b>Son gönderdiğin yorum kaydedildi.</b> Bu yorum başka bir
                sayfada.
              </p>
              <blockquote className="comment-text">{confirmed.text}</blockquote>
            </aside>
          )}
          {notice && <p role="status">{notice}</p>}
          {retry && (
            <button
              className="button button--secondary"
              disabled={pending}
              onClick={() => void execute(retry)}
            >
              Aynı işlemi yeniden dene
            </button>
          )}
          {conflict && (
            <button
              className="button button--secondary"
              disabled={pending}
              onClick={() => void load(cursor)}
            >
              Güncel yorumları yükle
            </button>
          )}
          {staleMissing && (
            <p role="alert">
              Düzenlediğin yorum artık bu sayfada değil. Taslağını yeni yorum
              olarak paylaşabilirsin.
            </p>
          )}
          <form onSubmit={save}>
            <label>
              {editor.comment ? "Yorumunu düzenle" : "Yorum yaz"}
              <textarea
                ref={input}
                aria-label={editor.comment ? "Yorumunu düzenle" : "Yorum yaz"}
                value={editor.text}
                maxLength={4000}
                required
                disabled={blocked}
                onChange={(event) =>
                  setEditor({ ...editor, text: event.target.value })
                }
              />
            </label>
            <div className="conversation-actions">
              <button
                className="button button--primary"
                disabled={
                  blocked ||
                  view.kind !== "ready" ||
                  !editor.text.trim() ||
                  staleMissing
                }
              >
                {pending
                  ? "Kaydediliyor…"
                  : editor.comment
                    ? "Değişikliği kaydet"
                    : "Yorumu paylaş"}
              </button>
              {editor.comment && (
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={blocked}
                  onClick={() => {
                    setEditor({
                      text: staleMissing ? editor.text : "",
                      comment: null,
                    });
                    setConflict(false);
                  }}
                >
                  {staleMissing
                    ? "Yeni yorum olarak devam et"
                    : "Düzenlemekten vazgeç"}
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </section>
  );
}
