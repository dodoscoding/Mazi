import { useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Memory, Photo as PhotoData } from "../memories";
import { Photo } from "../Photo";
import { Glyph } from "./glyphs";

const drift = 24;
const settle = { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
const fade = { duration: 150, easing: "linear" };

type Ghost = { key: number; photo: PhotoData; from: number; dir: number };
type Drag = {
  id: number;
  x: number;
  y: number;
  t: number;
  dx: number;
  axis?: "x" | "y";
};

function Thumb({
  photo,
  index,
  current,
  choose,
}: {
  photo: PhotoData;
  index: number;
  current: boolean;
  choose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className={failed ? "is-failed" : undefined}
      aria-label={`Photo ${index + 1}: ${photo.caption}`}
      aria-pressed={current}
      onClick={choose}
    >
      {failed ? (
        <Glyph name="photo-failed" size={18} />
      ) : (
        <img
          src={photo.src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </button>
  );
}

/**
 * The photo viewer: hero, caption, counter, arrows, filmstrip and touch swipe.
 * Photo changes drift 24px and fade over 360ms; a swipe tracks the finger 1:1.
 * Reduced motion keeps swipe and the arrows but turns movement into a 150ms
 * crossfade.
 */
export function Viewer({
  memory,
  index,
  meta,
  reduced,
  go,
}: {
  memory: Memory;
  index: number;
  meta: string;
  reduced: boolean;
  go: (index: number) => void;
}) {
  const photos = memory.photos;
  const photo = photos[index];
  const many = photos.length > 1;
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLImageElement>(null);
  const drag = useRef<Drag | null>(null);
  const released = useRef(0);
  const shown = useRef(index);
  const ghostKey = useRef(0);
  const [ghost, setGhost] = useState<Ghost | null>(null);

  useLayoutEffect(() => {
    const previous = shown.current;
    shown.current = index;
    if (previous === index || !track.current) return;
    const dir = index > previous ? 1 : -1;
    const from = released.current;
    released.current = 0;
    track.current.style.transform = "";
    if (typeof track.current.animate === "function")
      track.current.animate(
        reduced
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: `translateX(${dir * drift}px)` },
              { opacity: 1, transform: "none" },
            ],
        reduced ? fade : settle,
      );
    if (photos[previous])
      setGhost({ key: ++ghostKey.current, photo: photos[previous], from, dir });
  }, [index, photos, reduced]);

  useLayoutEffect(() => {
    const element = ghostRef.current;
    if (!ghost || !element) return;
    if (typeof element.animate !== "function") {
      setGhost(null);
      return;
    }
    const start = `translateX(${ghost.from}px)`;
    const animation = element.animate(
      reduced
        ? [
            { opacity: 1, transform: start },
            { opacity: 0, transform: start },
          ]
        : [
            { opacity: 1, transform: start },
            {
              opacity: 0,
              transform: `translateX(${ghost.from - ghost.dir * drift}px)`,
            },
          ],
      { ...(reduced ? fade : settle), fill: "forwards" },
    );
    const key = ghost.key;
    void animation.finished
      .then(() => setGhost((value) => (value?.key === key ? null : value)))
      .catch(() => {});
  }, [ghost, reduced]);

  const settleBack = (dx: number) => {
    const element = track.current;
    if (!element) return;
    element.style.transform = "";
    if (dx && typeof element.animate === "function")
      element.animate(
        [{ transform: `translateX(${dx}px)` }, { transform: "none" }],
        reduced ? fade : settle,
      );
  };
  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" || !many || drag.current) return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      dx: 0,
    };
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (current.axis === "x")
        stage.current?.setPointerCapture?.(event.pointerId);
    }
    if (current.axis !== "x") return;
    const atEdge =
      (dx > 0 && index === 0) || (dx < 0 && index === photos.length - 1);
    current.dx = atEdge ? dx * 0.3 : dx;
    if (track.current)
      track.current.style.transform = `translateX(${current.dx}px)`;
  };
  const onPointerEnd = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (current.axis !== "x") return;
    const width = stage.current?.clientWidth || 1;
    const velocity = current.dx / Math.max(1, event.timeStamp - current.t);
    const target =
      event.type === "pointerup" &&
      (Math.abs(current.dx) > width * 0.2 || Math.abs(velocity) > 0.5)
        ? index + (current.dx < 0 ? 1 : -1)
        : index;
    if (target !== index && target >= 0 && target < photos.length) {
      released.current = current.dx;
      go(target);
    } else settleBack(current.dx);
  };

  const first = Math.max(0, Math.min(index - 2, photos.length - 5));
  const dots = photos
    .slice(first, first + 5)
    .map((_, offset) => first + offset);

  return (
    <section
      className="gallery viewer"
      aria-label="Memory photographs"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          !["ArrowLeft", "ArrowRight"].includes(event.key)
        )
          return;
        event.preventDefault();
        const next = index + (event.key === "ArrowRight" ? 1 : -1);
        if (next >= 0 && next < photos.length) go(next);
      }}
    >
      <figure className="viewer-stage">
        <div
          ref={stage}
          className="viewer-surface"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <div ref={track} className="viewer-track">
            <Photo key={photo.src} photo={photo} continuity eager />
          </div>
          {ghost && (
            <img
              key={ghost.key}
              ref={ghostRef}
              className="viewer-ghost"
              src={ghost.photo.src}
              alt=""
              aria-hidden="true"
            />
          )}
        </div>
        <div className="viewer-scrim" aria-hidden="true" />
        <figcaption className="viewer-caption">
          <span className="viewer-caption-text">
            <span className="viewer-caption-title">{photo.caption}</span>
            {meta && <span className="viewer-caption-meta">{meta}</span>}
          </span>
          <span className="viewer-count" aria-live="polite">
            {index + 1} / {photos.length}
          </span>
        </figcaption>
        {many && (
          <>
            <button
              type="button"
              className="viewer-arrow viewer-arrow--previous"
              aria-label="Previous photo"
              aria-disabled={index === 0}
              onClick={() => index > 0 && go(index - 1)}
            >
              <Glyph name="chevron-left" size={18} stroke={1.8} />
            </button>
            <button
              type="button"
              className="viewer-arrow viewer-arrow--next"
              aria-label="Next photo"
              aria-disabled={index === photos.length - 1}
              onClick={() => index < photos.length - 1 && go(index + 1)}
            >
              <Glyph name="chevron-right" size={18} stroke={1.8} />
            </button>
            <div className="viewer-dots" aria-hidden="true">
              {dots.map((dot) => (
                <i key={dot} className={dot === index ? "is-current" : ""} />
              ))}
            </div>
          </>
        )}
      </figure>
      {many && (
        <div className="filmstrip" role="group" aria-label="Choose a photo">
          {photos.map((item, position) => (
            <Thumb
              key={item.src}
              photo={item}
              index={position}
              current={position === index}
              choose={() => go(position)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
