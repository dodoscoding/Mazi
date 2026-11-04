import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Memory } from "../memories";
import type { LinkFor } from "../useRoute";
import { Photo } from "../Photo";
import { displayDate, placeLine } from "../memory/facts";
import { planDate } from "./time";
import "../styles/landing.css";
import "./home.css";

type Activity = {
  id: string;
  kind: string;
  action: string;
  occurred_at: number;
  actor: { id: string; name: string };
  target: { kind: "photo" | "memory" | "plan"; id: string };
  text?: string;
  emoji?: string;
  thumbnail?: string;
  asset_id?: string;
  memory_id?: string;
  plan?: { title: string };
};
type ActivityPage = {
  items: Activity[];
  next_cursor: string | null;
  partial?: boolean;
};
type CompactPlan = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  place: string;
  description: string;
  status: string;
  attendance: { yes: number; maybe: number; no: number };
};
type Featured =
  | { kind: "plan"; plan: CompactPlan }
  | { kind: "conversation"; activity: Activity; preview?: Memory }
  | { kind: "memory"; memory: Memory };
type Home = {
  featured: Featured | null;
  activity: ActivityPage;
  server_time: string;
  can_plan: boolean;
};
type State =
  | { kind: "loading" | "error" | "denied" }
  | { kind: "ready"; home: Home | null; page: ActivityPage };
const actionText: Record<string, string> = {
  created: "paylaştı",
  edited: "yorumunu düzenledi",
  updated: "planı güncelledi",
  cancelled: "planı iptal etti",
  reacted: "tepki bıraktı",
};
export function activityLink(item: Activity, group: string) {
  if (item.target.kind === "plan")
    return `/circle?${new URLSearchParams({ section: "plans", group, plan: item.target.id })}`;
  return `/memory/${encodeURIComponent(item.target.kind === "photo" ? `photo-${item.asset_id || item.target.id}` : item.target.id)}?discussion=${item.target.kind}`;
}
const actionDate = (epoch: number) =>
  new Date(epoch * 1000).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function SocialHome({
  group,
  circle,
  activity,
  link,
  heading,
  restore,
  search = "",
  sessionKey = "",
}: {
  search?: string;
  sessionKey?: string;
  restore?: { openerId: string; scroll: number };
  group: string;
  circle: string;
  activity: boolean;
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const params = new URLSearchParams(search);
  const scope = `${sessionKey}:${group}`;
  const [initialPosition] = useState(() => ({
    scope,
    cursor:
      activity &&
      params.get("group") === group &&
      history.state?.activityScope === scope
        ? params.get("cursor") || ""
        : "",
  }));
  const initialCursor =
    initialPosition.scope === scope ? initialPosition.cursor : "";
  const restored = useRef(false);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [cursor, setCursor] = useState(initialCursor);
  const controller = useRef<AbortController | null>(null);
  const disposed = useRef(false);
  const cursorRef = useRef(initialCursor);
  async function load(next = "") {
    if (disposed.current) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    cursorRef.current = next;
    setCursor(next);
    setState({ kind: "loading" });
    try {
      const response = await fetch(
        `/api/social/${activity ? "activity" : "home"}?${new URLSearchParams({ group, ...(activity ? { limit: "20", ...(next ? { cursor: next } : {}) } : {}) })}`,
        { signal: request.signal, cache: "no-store" },
      );
      const value = await response.json();
      if (request.signal.aborted || disposed.current) return;
      if ([401, 403, 404].includes(response.status)) {
        clear();
        return;
      }
      if (!response.ok) throw Error();
      setState({
        kind: "ready",
        home: activity ? null : value,
        page: activity ? value : value.activity,
      });
    } catch {
      if (!request.signal.aborted && !disposed.current)
        setState({ kind: "error" });
    }
  }
  function clear() {
    disposed.current = true;
    controller.current?.abort();
    setState({ kind: "denied" });
    setCursor("");
    cursorRef.current = "";
  }
  useEffect(() => {
    disposed.current = false;
    restored.current = false;
    if (activity && params.has("cursor") && !initialCursor) {
      history.replaceState(
        history.state,
        "",
        `#/circle?${new URLSearchParams({ section: "activity", group })}`,
      );
    }
    void load(initialCursor);
    const invalidation = () => clear();
    const refresh = () => {
      if (!disposed.current) void load(cursorRef.current);
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const events = ["mazi:group", "mazi:session", "mazi:access-lost"];
    events.forEach((event) => window.addEventListener(event, invalidation));
    window.addEventListener("pageshow", refresh);
    window.addEventListener("mazi:archive-changed", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed.current = true;
      controller.current?.abort();
      events.forEach((event) =>
        window.removeEventListener(event, invalidation),
      );
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("mazi:archive-changed", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [group, activity, initialCursor]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [activity]);
  useEffect(() => {
    if (state.kind !== "ready" || !restore || restored.current) return;
    restored.current = true;
    const opener = document.getElementById(restore.openerId);
    window.scrollTo(0, opener ? restore.scroll : 0);
    (opener || heading.current)?.focus({ preventScroll: true });
  }, [state.kind, restore?.openerId]);
  const changePage = (next = "") => {
    const query = new URLSearchParams({
      section: "activity",
      group,
      ...(next ? { cursor: next } : {}),
    });
    history.replaceState(
      { ...history.state, activityScope: scope },
      "",
      `#/circle?${query}`,
    );
    heading.current?.focus({ preventScroll: true });
    void load(next);
  };
  const rows = (items: Activity[]) => (
    <ol className="social-activity">
      {items.map((item) => (
        <li key={item.id}>
          <a
            id={`activity-${item.id}`}
            href={`#${activityLink(item, group)}`}
            onClick={link(activityLink(item, group))}
          >
            {item.thumbnail && (
              <img src={item.thumbnail} alt="" loading="lazy" />
            )}
            <span>
              <b>{item.actor.name}</b> {item.emoji || ""}{" "}
              {actionText[item.action] || "paylaştı"}
              {item.text && <span className="social-excerpt">{item.text}</span>}
              {item.plan && (
                <span className="social-excerpt">{item.plan.title}</span>
              )}
              <time dateTime={new Date(item.occurred_at * 1000).toISOString()}>
                {actionDate(item.occurred_at)}
              </time>
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
  function memoryCard(memory: Memory, href: string, extra?: Activity) {
    return (
      <article className="home-featured">
        {memory.photos[0] && (
          <div className="home-featured-photo">
            <Photo
              photo={memory.photos[0]}
              eager
              openMemory={{
                id: "home-featured-photo",
                href: `#${href}`,
                label: `Anıyı aç: ${memory.title}`,
                onClick: link(href),
              }}
            />
          </div>
        )}
        <div className="home-featured-body">
          <p className="memory-meta">
            {[displayDate(memory), placeLine(memory)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h2>
            <a id="home-featured-title" href={`#${href}`} onClick={link(href)}>
              {memory.title}
            </a>
          </h2>
          {extra ? (
            <>
              <p className="home-description">
                <b>{extra.actor.name}</b> {extra.emoji || ""}{" "}
                {actionText[extra.action] || "paylaştı"}
              </p>
              <p className="social-excerpt">{extra.text}</p>
              <time dateTime={new Date(extra.occurred_at * 1000).toISOString()}>
                {actionDate(extra.occurred_at)}
              </time>
            </>
          ) : (
            <p className="home-description">{memory.description}</p>
          )}
          <div className="landing-actions">
            <a
              id="home-featured-open"
              className="button button--primary"
              href={`#${href}`}
              onClick={link(href)}
            >
              {extra ? "Sohbeti aç" : "Anıyı aç"}
            </a>
            {memory.kind === "memory" && !extra && (
              <a
                className="button button--secondary"
                href={`#/memory/${memory.id}?notebook=1`}
                onClick={link(`/memory/${memory.id}?notebook=1`)}
              >
                Notları aç
              </a>
            )}
          </div>
        </div>
      </article>
    );
  }
  const home = state.kind === "ready" ? state.home : null;
  const featured = home?.featured;
  return (
    <section className="home-landing">
      <header className="landing-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            {activity ? "Grubumuzdan haberler" : "Birlikte hatırlayalım"}
          </h1>
          <p>{circle} için ortak bir yer.</p>
        </div>
        <a
          className="landing-text-link"
          href={activity ? "#/" : "#/explore"}
          onClick={link(activity ? "/" : "/explore")}
        >
          {activity ? "Ana sayfaya dön" : "Tümünü keşfet"}
        </a>
      </header>
      {state.kind === "loading" && (
        <p className="landing-status" role="status">
          {activity ? "Haberler yükleniyor…" : "Ana sayfa yükleniyor…"}
        </p>
      )}
      {state.kind === "denied" && (
        <p className="landing-status">
          Bu grup şu anda açılamıyor. Erişimin değişmiş olabilir.
        </p>
      )}
      {state.kind === "error" && (
        <div className="landing-status" role="alert">
          <h2>{activity ? "Haberler yüklenemedi" : "Ana sayfa yüklenemedi"}</h2>
          <button
            className="button button--primary"
            onClick={() => void load(cursor)}
          >
            Yeniden dene
          </button>
        </div>
      )}
      {state.kind === "ready" && (
        <>
          {!activity && (
            <>
              {featured?.kind === "plan" ? (
                <article className="home-plan">
                  <p className="memory-meta">Bir sonraki buluşmamız</p>
                  <h2>{featured.plan.title}</h2>
                  <p>
                    {planDate(featured.plan)} · {featured.plan.timezone}
                  </p>
                  {featured.plan.place && <p>{featured.plan.place}</p>}
                  <p>
                    {featured.plan.attendance.yes} kişi geliyor ·{" "}
                    {featured.plan.attendance.maybe} kişi belki
                  </p>
                  <a
                    id="home-featured-open"
                    className="button button--primary"
                    href={`#/circle?section=plans&group=${group}&plan=${featured.plan.id}`}
                    onClick={link(
                      `/circle?section=plans&group=${group}&plan=${featured.plan.id}`,
                    )}
                  >
                    Planı aç
                  </a>
                </article>
              ) : featured?.kind === "conversation" ? (
                featured.preview ? (
                  memoryCard(
                    featured.preview,
                    activityLink(featured.activity, group),
                    featured.activity,
                  )
                ) : (
                  rows([featured.activity])
                )
              ) : featured?.kind === "memory" ? (
                memoryCard(featured.memory, `/memory/${featured.memory.id}`)
              ) : (
                <div className="landing-status home-empty">
                  <h2>İlk buluşmamızı planlayalım</h2>
                  <p>
                    Birlikte vakit geçirmek için fotoğraf eklemek gerekmiyor.
                  </p>
                  <a
                    className="button button--primary"
                    href="#/circle?section=plans&new=1"
                    onClick={link("/circle?section=plans&new=1")}
                  >
                    Buluşma planla
                  </a>
                  <a
                    className="landing-text-link"
                    href="#/imports"
                    onClick={link("/imports")}
                  >
                    Fotoğraf veya arşiv ekle
                  </a>
                </div>
              )}
              {featured && (
                <div className="landing-actions">
                  <a
                    className="button button--secondary"
                    href="#/circle?section=plans&new=1"
                    onClick={link("/circle?section=plans&new=1")}
                  >
                    Buluşma planla
                  </a>
                  <a
                    className="landing-text-link"
                    href="#/imports"
                    onClick={link("/imports")}
                  >
                    Fotoğraf veya arşiv ekle
                  </a>
                </div>
              )}
            </>
          )}
          {(activity || state.page.items.length > 0) && (
            <section className="home-news" aria-label="Grubumuzdan haberler">
              {!activity && <h2>Grubumuzdan haberler</h2>}
              {rows(state.page.items.slice(0, activity ? 20 : 3))}
              {!state.page.items.length && (
                <p>
                  {state.page.partial
                    ? "Bu aralıkta görünen bir haber yok."
                    : "Henüz haber yok. İlk sözü ya da buluşmayı paylaş."}
                </p>
              )}
              {activity ? (
                <nav className="landing-actions" aria-label="Haber sayfaları">
                  {cursor && (
                    <button
                      className="button button--secondary"
                      onClick={() => changePage()}
                    >
                      İlk haberler
                    </button>
                  )}
                  {state.page.next_cursor && (
                    <button
                      className="button button--secondary"
                      onClick={() => changePage(state.page.next_cursor!)}
                    >
                      Sonraki haberler
                    </button>
                  )}
                </nav>
              ) : (
                <a
                  className="landing-text-link"
                  href="#/circle?section=activity"
                  onClick={link("/circle?section=activity")}
                >
                  Tüm haberler
                </a>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
