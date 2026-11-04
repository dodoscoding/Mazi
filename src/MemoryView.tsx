import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent, RefObject } from "react";
import {
  provenanceOf,
  shareDate,
  sourceSenders,
  sourceSharedLine,
} from "./memory/provenance";
import type { Memory } from "./memories";
import {
  chronology,
  coordinates,
  countryName,
  dateBasisNotes,
  displayDate,
  hasDate,
  initials,
  placeLine,
  readableDate,
  relatedMemories,
  sourceRows,
  tint,
} from "./memory/facts";
import type { SourceKind } from "./memory/facts";
import { Glyph } from "./memory/glyphs";
import type { GlyphName } from "./memory/glyphs";
import { EventNotebook } from "./memory/EventNotebook";
import { Viewer } from "./memory/Viewer";
import type { LinkFor } from "./useRoute";
import { canGoBack, useReducedMotion } from "./useRoute";
import { Arrow } from "./ui/icons";
import type { IconName } from "./ui/icons";
import "./styles/memory.css";

const ConversationPanel = lazy(() => import("./social/ConversationPanel"));

const PhotoLabels = lazy(() => import("./memory/PhotoLabels"));
const PhotoCorrection = lazy(() => import("./memory/PhotoCorrection"));

type Navigate = (url: string, animate?: boolean, replace?: boolean) => void;

const sourceGlyph: Record<SourceKind, GlyphName> = {
  photos: "photos",
  chat: "chat",
  discord: "discord",
  messenger: "messenger",
};

export function MemoryView({
  memory,
  group,
  notebook,
  discussion,
  sessionKey,
  memories = [memory],
  photo,
  demo,
  backUrl,
  link,
  navigate,
  heading,
}: {
  memory: Memory;
  group: string;
  notebook: boolean;
  discussion?: "photo" | "memory";
  sessionKey?: string;
  memories?: Memory[];
  photo: number;
  demo: boolean;
  backUrl: string;
  link: LinkFor;
  navigate: Navigate;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const [editing, setEditing] = useState<
    "capture_date" | "place" | "labels" | null
  >(null);
  useEffect(() => setEditing(null), [group, memory.id, photo]);
  const atlasUrl = `/atlas?selected=${encodeURIComponent(memory.id)}`;
  const reduced = useReducedMotion();
  const notebookHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (notebook && memory.kind === "memory" && !demo) {
      notebookHeading.current?.focus({ preventScroll: true });
      notebookHeading.current?.scrollIntoView({ block: "start" });
    }
  }, [notebook, memory.id, memory.kind, demo]);
  const photoIndex = Math.min(Math.floor(photo), memory.photos.length - 1);
  const place = placeLine(memory);
  const date = displayDate(memory);
  const hasEvidence = memory.photos.every((photo) => photo.evidence);
  const uncertain = hasEvidence
    ? memory.photos.some((photo) =>
        ["conflict", "ambiguous", "unknown", "approximate"].includes(
          photo.evidence!.chronology.status,
        ),
      )
    : memory.approximate && hasDate(memory);
  const basis = dateBasisNotes(memory).join(" ");
  const shared = memory.people?.shared || [];
  const meta = [
    date,
    sourceSharedLine(memory) ||
      (shared.length
        ? `${provenanceOf(memory).length ? "Added to archive" : "Shared"} by ${shared.join(", ")}`
        : ""),
    memory.source ? "" : "Sample Atlas",
  ]
    .filter(Boolean)
    .join(" · ");
  const moments = chronology(memories);
  const position = moments.findIndex((item) => item.id === memory.id);
  const earlier = position > 0 ? moments[position - 1] : undefined;
  const later =
    position >= 0 && position < moments.length - 1
      ? moments[position + 1]
      : undefined;

  // A layout effect, so Escape works from the first painted frame.
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector(
          '[role="dialog"], [aria-haspopup][aria-expanded="true"]',
        )
      )
        return;
      if (canGoBack()) history.back();
      else navigate(backUrl, true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [backUrl, navigate]);

  // Back returns to the in-app page the memory was opened from.
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!canGoBack()) return link(backUrl, true)(event);
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    history.back();
  };
  const go = (index: number) =>
    navigate(
      `/memory/${memory.id}?photo=${index}${discussion ? `&discussion=${discussion}` : ""}`,
      false,
      true,
    );
  const momentLink = (
    item: Memory | undefined,
    label: string,
    glyph: GlyphName | IconName,
  ) =>
    item ? (
      <a
        className="round-link"
        href={`#/memory/${item.id}`}
        onClick={link(`/memory/${item.id}`, false, true)}
        aria-label={`${label}: ${item.title}, ${displayDate(item)}`}
      >
        <Glyph name={glyph} size={14} />
      </a>
    ) : (
      <span className="round-link is-disabled" aria-hidden="true">
        <Glyph name={glyph} size={14} />
      </span>
    );

  return (
    <article className="memory-detail">
      <div className="detail-bar">
        <div className="detail-bar-start">
          <a className="back-pill" href={`#${backUrl}`} onClick={back}>
            <Glyph name="chevron-left" size={14} />
            <span className="back-label">Back</span>
            <kbd aria-hidden="true">Esc</kbd>
          </a>
          <p className="hud-label crumb">
            {[
              memory.place && countryName(memory.place.country),
              date,
              memory.shortTitle,
            ]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>
        {!demo && memory.kind === "memory" && (
          <a
            className="detail-notes-link"
            href={`#/memory/${memory.id}?notebook=1`}
            onClick={(event) => {
              if (
                !notebook ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return link(`/memory/${memory.id}?notebook=1`)(event);
              event.preventDefault();
              notebookHeading.current?.focus({ preventScroll: true });
              notebookHeading.current?.scrollIntoView({ block: "start" });
            }}
          >
            View notes <Glyph name="chevron-right" size={14} />
          </a>
        )}
        {moments.length > 1 && position >= 0 && (
          <nav className="moments" aria-label="Other memories">
            <span className="hud-label">
              Memory {position + 1} of {moments.length}
            </span>
            {momentLink(earlier, "Earlier memory", "chevron-left")}
            {momentLink(later, "Later memory", "chevron-right")}
          </nav>
        )}
        {memory.place && (
          <a
            className="round-link globe-link"
            href={`#${atlasUrl}`}
            onClick={link(atlasUrl, true)}
            aria-label="Show on the globe"
          >
            <Glyph name="globe" size={18} />
          </a>
        )}
      </div>
      <div className="detail-body">
        <Viewer
          key={memory.id}
          memory={memory}
          index={photoIndex}
          meta={meta}
          reduced={reduced}
          go={go}
        />
        {!demo && memory.photos[photoIndex]?.assetId && (
          <section
            aria-label="Seçili fotoğraf bilgisi"
            className="memory-tools photo-tools"
          >
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setEditing("capture_date")}
            >
              Tarihi düzelt
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setEditing("place")}
            >
              {memory.photos[photoIndex].evidence?.place.text
                ? "Yeri değiştir"
                : "Yer ekle"}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setEditing("labels")}
            >
              Etiketleri düzenle
            </button>
            {editing === "labels" && (
              <Suspense fallback={<p>Yükleniyor…</p>}>
                <PhotoLabels
                  key={`${group}:${memory.photos[photoIndex].assetId}`}
                  group={group}
                  asset={memory.photos[photoIndex].assetId!}
                  close={() => setEditing(null)}
                />
              </Suspense>
            )}
            {editing && editing !== "labels" && (
              <Suspense fallback={<p>Yükleniyor…</p>}>
                <PhotoCorrection
                  key={`${group}:${memory.photos[photoIndex].assetId}:${editing}`}
                  group={group}
                  asset={memory.photos[photoIndex].assetId!}
                  field={editing}
                  close={() => setEditing(null)}
                />
              </Suspense>
            )}
          </section>
        )}
        <div className="story-columns">
          <div className="story">
            <div className="story-chips">
              <span className={`date-chip${uncertain ? " is-uncertain" : ""}`}>
                {date}
              </span>
              {memory.place && (
                <span className="hud-label coordinates">
                  {coordinates(memory)}
                </span>
              )}
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {memory.title}
            </h1>
            <p className="memory-description">{memory.description}</p>
            <Conversation key={memory.id} memory={memory} />
            {!demo && (
              <>
                <nav className="memory-tools" aria-label="Sohbet seçimi">
                  {memory.photos[photoIndex]?.assetId && (
                    <a
                      className="button button--secondary"
                      href={`#/memory/${memory.id}?photo=${photoIndex}&discussion=photo`}
                      onClick={link(
                        `/memory/${memory.id}?photo=${photoIndex}&discussion=photo`,
                      )}
                    >
                      Fotoğraf üzerine konuş
                    </a>
                  )}
                  {memory.kind === "memory" && (
                    <a
                      className="button button--secondary"
                      href={`#/memory/${memory.id}?discussion=memory`}
                      onClick={link(`/memory/${memory.id}?discussion=memory`)}
                    >
                      Anı üzerine konuş
                    </a>
                  )}
                </nav>
                {discussion &&
                  (discussion === "photo"
                    ? memory.photos[photoIndex]?.assetId
                    : memory.kind === "memory") && (
                    <Suspense
                      fallback={<p role="status">Sohbet yükleniyor…</p>}
                    >
                      <ConversationPanel
                        key={`${sessionKey}:${group}:${discussion}:${discussion === "photo" ? memory.photos[photoIndex].assetId : memory.id}`}
                        group={group}
                        target={{
                          kind: discussion,
                          id:
                            discussion === "photo"
                              ? memory.photos[photoIndex].assetId!
                              : memory.id,
                        }}
                        focus
                      />
                    </Suspense>
                  )}
              </>
            )}
            <EventNotebook
              key={`${group}:${memory.id}`}
              group={group}
              event={!demo && memory.kind === "memory" ? memory.id : null}
              heading={notebookHeading}
            />
            {!demo && (
              <div className="memory-tools">
                <a
                  className="button button--secondary"
                  href="#/review"
                  onClick={link("/review")}
                >
                  Review this archive
                </a>
                {memory.kind === "memory" && (
                  <a
                    className="button button--ghost"
                    href="#/memories"
                    onClick={link("/memories")}
                  >
                    Write a shared story
                  </a>
                )}
              </div>
            )}
          </div>
          <aside className="facts" aria-label="About this memory">
            <section className="fact" aria-labelledby="fact-when">
              <h2 id="fact-when" className="hud-label">
                When
              </h2>
              <p className="fact-value">{date}</p>
              {uncertain ? (
                <div className="uncertainty-note" role="note">
                  <p>
                    {hasEvidence ? (
                      <>
                        <b>Tarih belirsiz.</b> Her fotoğrafın tarih durumu ayrı
                        gösterilir. {basis}
                      </>
                    ) : (
                      <>
                        <b>Date uncertain.</b> Not every photo has a confirmed
                        date, so Mazi shows “About”. {basis}
                      </>
                    )}
                  </p>
                  {!demo && (
                    <a href="#/review" onClick={link("/review")}>
                      Fix the date in Archive review
                    </a>
                  )}
                </div>
              ) : (
                basis && <p className="fact-detail">{basis}</p>
              )}
            </section>
            <section className="fact fact-where" aria-labelledby="fact-where">
              {memory.place && <Locator memory={memory} />}
              <div>
                <h2 id="fact-where" className="hud-label">
                  Where
                </h2>
                <p className="fact-value">{place || "No place recorded"}</p>
                {memory.place ? (
                  <a
                    className="text-link globe-text-link"
                    href={`#${atlasUrl}`}
                    onClick={link(atlasUrl, true)}
                  >
                    Show on the globe
                  </a>
                ) : (
                  <p className="fact-detail">
                    {hasEvidence
                      ? "Her fotoğrafın yeri kendi bilgi satırında gösterilir. Eksik veya çelişkili yerler haritada işaretlenmez."
                      : "The photos disagree on a place, or none was recorded."}
                  </p>
                )}
              </div>
            </section>
            <People memory={memory} />
            <section className="fact" aria-labelledby="fact-sources">
              <h2 id="fact-sources" className="hud-label">
                Source evidence
              </h2>
              <ul className="sources">
                {sourceRows(memory).map((row) => (
                  <li key={row.app}>
                    <span className="source-icon">
                      <Glyph name={sourceGlyph[row.kind]} size={15} />
                    </span>
                    <span className="source-text">
                      <b>{row.app}</b>
                      <span>{row.detail}</span>
                    </span>
                    {row.count && (
                      <span className="source-count">{row.count}</span>
                    )}
                  </li>
                ))}
                {provenanceOf(memory).map((item, index) => (
                  <li key={`sharing-${index}`}>
                    <span className="source-icon">
                      <Glyph name="chat" size={15} />
                    </span>
                    <span className="source-text">
                      <b>
                        {item.sender
                          ? `Shared by ${item.sender}`
                          : "Source share"}
                      </b>
                      <span>
                        {shareDate(item) || "Share date not recorded"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
      <RelatedMemories memory={memory} memories={memories} link={link} />
    </article>
  );
}

function Conversation({ memory }: { memory: Memory }) {
  const [expanded, setExpanded] = useState(false);
  const first = memory.messages[0];
  if (!first) return null;
  return (
    <section className="conversation" aria-labelledby="conversation-heading">
      <h2 id="conversation-heading">From the conversation</h2>
      <p className="conversation-origin">
        Imported excerpts, shared in the original conversation.
      </p>
      <blockquote>
        <p>“{first.text}”</p>
      </blockquote>
      <p className="conversation-who">
        {first.name}
        {first.time && `, ${readableDate(first.time)}`}
      </p>
      {memory.messages.length > 1 && (
        <>
          <button
            type="button"
            className="conversation-toggle"
            aria-expanded={expanded}
            aria-controls="conversation-messages"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide conversation" : "Show conversation"}
            <span className="toggle-mark" aria-hidden="true">
              <Glyph name="chevron-right" size={16} />
            </span>
          </button>
          <ol id="conversation-messages" hidden={!expanded}>
            {memory.messages.map((message, index) => (
              <li key={index}>
                <div>
                  <strong>{message.name}</strong>
                  <time>{readableDate(message.time)}</time>
                </div>
                <p>{message.text}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function People({ memory }: { memory: Memory }) {
  const { shared = [], conversation = [] } = memory.people || {};
  const senders = sourceSenders(memory);
  const hasProvenance = provenanceOf(memory).length > 0;
  const chips = (names: string[]) => (
    <ul className="people-chips">
      {names.map((name) => (
        <li key={name}>
          <i className={`avatar-chip tint-${tint(name)}`} aria-hidden="true">
            {initials(name)}
          </i>
          {name}
        </li>
      ))}
    </ul>
  );
  return (
    <section className="fact" aria-labelledby="fact-people">
      <h2 id="fact-people" className="hud-label">
        People in the evidence
      </h2>
      {shared.length === 0 &&
      conversation.length === 0 &&
      senders.length === 0 ? (
        <p className="fact-detail">No one is named in the sources.</p>
      ) : (
        <dl className="people">
          {senders.length > 0 && (
            <div>
              <dt>Shared by</dt>
              <dd>{chips(senders)}</dd>
            </div>
          )}
          {shared.length > 0 && (
            <div>
              <dt>{hasProvenance ? "Added to archive by" : "Shared by"}</dt>
              <dd>{chips(shared)}</dd>
            </div>
          )}
          {conversation.length > 0 && (
            <div>
              <dt>In the conversation</dt>
              <dd>{chips(conversation)}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

/** A small equirectangular plate with the memory's place lit on it. */
function Locator({ memory }: { memory: Memory }) {
  const { latitude, longitude } = memory.place!;
  const x = ((longitude + 180) / 360) * 150;
  const y = ((90 - latitude) / 180) * 104;
  return (
    <svg className="locator" viewBox="0 0 150 104" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <line key={`v${step}`} x1={step * 25} x2={step * 25} y1="0" y2="104" />
      ))}
      {[1, 2, 3].map((step) => (
        <line key={`h${step}`} y1={step * 26} y2={step * 26} x1="0" x2="150" />
      ))}
      <circle className="locator-glow" cx={x} cy={y} r="8" />
      <circle className="locator-node" cx={x} cy={y} r="4" />
    </svg>
  );
}

function RelatedMemories({
  memory,
  memories,
  link,
}: {
  memory: Memory;
  memories: Memory[];
  link: LinkFor;
}) {
  const related = relatedMemories(memory, memories);
  if (!related.length) return null;
  return (
    <section className="related" aria-labelledby="related-heading">
      <h2 id="related-heading" className="hud-label">
        Related memories
      </h2>
      <ul>
        {related.map(({ memory: item, why }) => (
          <li key={item.id}>
            <a
              href={`#/memory/${item.id}`}
              onClick={link(`/memory/${item.id}`, false, true)}
            >
              {item.photos[0] && (
                <img src={item.photos[0].src} alt="" loading="lazy" />
              )}
              <span className="related-why">{why}</span>
              <b>{item.title}</b>
              <span
                className={`related-date${item.approximate && hasDate(item) ? " is-uncertain" : ""}`}
              >
                {displayDate(item)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MemoryNotFound({
  link,
  heading,
}: {
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className="not-found">
      <span className="not-found-mark" aria-hidden="true">
        <Glyph name="compass" size={28} stroke={1.4} />
      </span>
      <h1 ref={heading} tabIndex={-1}>
        Memory not found
      </h1>
      <p>
        This memory is unavailable, or you no longer have access to it. The rest
        of your atlas is still here.
      </p>
      <div className="not-found-actions">
        <a className="primary-action" href="#/" onClick={link("/")}>
          Back <Arrow />
        </a>
        <a
          className="button button--ghost"
          href="#/timeline"
          onClick={link("/timeline")}
        >
          Browse the timeline
        </a>
      </div>
    </section>
  );
}
