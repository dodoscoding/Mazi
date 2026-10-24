import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { Memory } from "../memories";
import {
  provenanceOf,
  sourceSharedLine,
  shareDate,
} from "../memory/provenance";
import { Icon } from "../ui/icons";
import {
  coordinates,
  listNames,
  longDate,
  placeLabel,
  plural,
  shortDate,
  sourceName,
} from "./format";

/**
 * The dive's landing: an organic portal holding the hero photograph over the place,
 * and the editorial dossier beside it (a rising sheet on phones).
 */
export function Portal({
  memory,
  demo,
  closing,
  phone,
  onClose,
  onStep,
  onOpen,
  onNotebook,
  hasPrevious,
  hasNext,
}: {
  memory: Memory;
  demo: boolean;
  closing: boolean;
  phone: boolean;
  onClose: () => void;
  onStep: (direction: -1 | 1) => void;
  onNotebook: (event: MouseEvent<HTMLAnchorElement>) => void;
  onOpen: (event: MouseEvent<HTMLAnchorElement>) => void;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ start: number; offset: number } | null>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [memory.id]);
  const sourceSharing = sourceSharedLine(memory);
  const provenance = provenanceOf(memory);
  const hero = memory.photos[0];
  const strip = memory.photos.slice(1, 4);
  const more = memory.photos.length - 1 - strip.length;
  const sources = (memory.source || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const where = memory.place ? memory.place.name : "No place recorded";
  const moveSheet = (offset: number) => {
    if (sheet.current)
      sheet.current.style.transform = offset ? `translateY(${offset}px)` : "";
  };
  return (
    <div
      className={`portal-layer ${closing ? "is-closing" : ""}`}
      inert={closing}
      aria-hidden={closing || undefined}
    >
      <figure className="portal">
        <div className="portal-aura" />
        <div className="portal-window">
          {hero && (
            <img
              src={hero.src}
              alt={hero.alt}
              style={
                closing ? undefined : { viewTransitionName: "memory-photo" }
              }
            />
          )}
        </div>
        {memory.place && (
          <figcaption className="hud-label">
            {where} · {shortDate(memory)}
          </figcaption>
        )}
      </figure>
      <div className="portal-bar">
        <button
          type="button"
          className="portal-back"
          onClick={onClose}
          aria-label={phone ? "Back to the atlas" : undefined}
        >
          <Icon name="chevron-right" size={14} className="is-back" />
          {!phone && (
            <>
              Back to the atlas <kbd aria-hidden="true">Esc</kbd>
            </>
          )}
        </button>
        {!phone && (
          <span className="hud-label portal-crumb">
            Atlas / {where} / {shortDate(memory)}
          </span>
        )}
      </div>
      <section ref={sheet} className="dossier" aria-labelledby="dossier-title">
        {phone && (
          <button
            type="button"
            className="dossier-handle"
            aria-label="Close the memory summary"
            onClick={onClose}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { start: event.clientY, offset: 0 };
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              drag.current.offset = Math.max(
                0,
                event.clientY - drag.current.start,
              );
              moveSheet(drag.current.offset);
            }}
            onPointerUp={(event) => {
              const offset = drag.current?.offset || 0;
              drag.current = null;
              if (offset > 80) {
                event.preventDefault();
                onClose();
              } else moveSheet(0);
            }}
            onPointerCancel={() => {
              drag.current = null;
              moveSheet(0);
            }}
          />
        )}
        <div className="dossier-head">
          <span className="hud-label">
            {memory.place ? coordinates(memory) : "No place recorded"}
          </span>
          <span className="dossier-steps">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous moment"
              disabled={!hasPrevious}
              onClick={() => onStep(-1)}
            >
              <Icon name="chevron-right" size={14} className="is-back" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Next moment"
              disabled={!hasNext}
              onClick={() => onStep(1)}
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </span>
        </div>
        <div className="dossier-title">
          <h2 id="dossier-title" ref={title} tabIndex={-1}>
            {memory.kind === "memory" ? (
              <a href={`#/memory/${memory.id}?notebook=1`} onClick={onNotebook}>
                {memory.title}
              </a>
            ) : (
              memory.title
            )}
          </h2>
          <p className="dossier-when">
            <span>{longDate(memory)}</span>
            <span>{placeLabel(memory)}</span>
          </p>
        </div>
        {memory.description && (
          <p className="dossier-story">{memory.description}</p>
        )}
        {(sourceSharing ||
          memory.people.shared.length > 0 ||
          memory.people.conversation.length > 0) && (
          <div className="dossier-people">
            {sourceSharing && <p>{sourceSharing}</p>}
            {memory.people.shared.length > 0 && (
              <p>
                {provenance.length ? "Added to archive by" : "Shared by"}{" "}
                {listNames(memory.people.shared)}
              </p>
            )}
            {memory.people.conversation.length > 0 && (
              <p>
                In the conversation: {listNames(memory.people.conversation)}
              </p>
            )}
          </div>
        )}
        {strip.length > 0 && (
          <div className="dossier-strip">
            {strip.map((photo, i) => (
              <span key={photo.src} className="dossier-thumb">
                <img src={photo.src} alt={photo.alt} loading="lazy" />
                {i === strip.length - 1 && more > 0 && (
                  <span className="dossier-more">+{more}</span>
                )}
              </span>
            ))}
          </div>
        )}
        <div className="dossier-sources">
          <span className="hud-label">Gathered from</span>
          {provenanceOf(memory).map((item, index) => (
            <p key={`sharing-${index}`}>
              {[item.sender ? `Shared by ${item.sender}` : "", shareDate(item)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ))}
          {sources.length ? (
            sources.map((source, i) => (
              <p key={source}>
                <span>{sourceName(source)}</span>
                {i === 0 && (
                  <span className="data">
                    {plural(memory.photos.length, "photo")}
                    {memory.messages.length
                      ? ` · ${plural(memory.messages.length, "message")}`
                      : ""}
                  </span>
                )}
              </p>
            ))
          ) : (
            <p>
              <span>Added by {memory.by}</span>
              <span className="data">
                {plural(memory.photos.length, "photo")}
                {memory.messages.length
                  ? ` · ${plural(memory.messages.length, "message")}`
                  : ""}
              </span>
            </p>
          )}
        </div>
        <a
          className="primary-action dossier-open"
          href={`#/memory/${memory.id}`}
          onClick={onOpen}
        >
          Open memory <kbd aria-hidden="true">↵</kbd>
        </a>
        {!demo && memory.kind === "memory" && (
          <a
            className="notes-link"
            href={`#/memory/${memory.id}?notebook=1`}
            onClick={onNotebook}
          >
            View notes <Icon name="chevron-right" size={14} />
          </a>
        )}
      </section>
    </div>
  );
}
