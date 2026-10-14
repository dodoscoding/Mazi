import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

/**
 * The time scrubber: one slider over the archive's year span. Ticks grow with the
 * number of memories in each year; ← → and Home/End move between years that have memories.
 */
export function Scrubber({
  years,
  counts,
  year,
  valueText,
  onYear,
  playing,
  compact,
}: {
  years: number[];
  counts: Record<number, number>;
  year: number | null;
  valueText: string;
  onYear: (year: number) => void;
  playing: boolean;
  compact: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  if (!years.length)
    return (
      <div className="scrubber is-empty" aria-hidden="true">
        <div className="scrubber-rule" />
      </div>
    );
  const first = years[0];
  const last = years[years.length - 1];
  const span = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...Object.values(counts));
  const position = (value: number) =>
    span.length === 1 ? 50 : ((value - first + 0.5) / span.length) * 100;
  const current = year ?? first;
  const index = years.indexOf(current);
  const step = (direction: number) => {
    const next =
      index < 0
        ? direction > 0
          ? years.find((value) => value > current)
          : [...years].reverse().find((value) => value < current)
        : years[index + direction];
    if (next !== undefined) onYear(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowDown: () => step(-1),
      ArrowRight: () => step(1),
      ArrowUp: () => step(1),
      PageDown: () => step(-1),
      PageUp: () => step(1),
      Home: () => onYear(first),
      End: () => onYear(last),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    action();
  };
  const pick = (clientX: number) => {
    const rect = inner.current?.getBoundingClientRect();
    if (!rect) return;
    const at = first + ((clientX - rect.left) / rect.width) * span.length - 0.5;
    const nearest = years.reduce((best, value) =>
      Math.abs(value - at) < Math.abs(best - at) ? value : best,
    );
    if (nearest !== year) onYear(nearest);
  };
  const labelled = (value: number) =>
    !compact && span.length <= 14
      ? true
      : value === first || value === last || value === current;
  return (
    <div
      ref={track}
      className={`scrubber ${playing ? "is-playing" : ""}`}
      role="slider"
      tabIndex={0}
      aria-label="Year"
      aria-valuemin={first}
      aria-valuemax={last}
      aria-valuenow={current}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onPointerDown={(event: PointerEvent) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        pick(event.clientX);
      }}
      onPointerMove={(event: PointerEvent) => {
        if (dragging.current) pick(event.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <div className="scrubber-track" ref={inner} aria-hidden="true">
        <div className="scrubber-rule" />
        <div className="scrubber-ticks">
          {span.map((value) =>
            counts[value] ? (
              <i
                key={value}
                className={value === current ? "is-current" : undefined}
                style={{
                  left: `${position(value)}%`,
                  height: `${6 + 12 * Math.sqrt(counts[value] / max)}px`,
                }}
              />
            ) : null,
          )}
        </div>
        {year !== null && (
          <>
            <div
              className="scrubber-band"
              style={{
                left: `${position(current) - 50 / span.length}%`,
                width: `${100 / span.length}%`,
              }}
            />
            <div
              className="scrubber-head"
              style={{ left: `${position(current)}%` }}
            />
          </>
        )}
        <div className="scrubber-years">
          {span.map((value) =>
            labelled(value) ? (
              <span
                key={value}
                className={
                  value === current && year !== null ? "is-current" : undefined
                }
                style={{ left: `${position(value)}%` }}
              >
                {value}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
