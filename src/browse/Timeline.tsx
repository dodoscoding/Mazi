import { buildChronology } from "../memory/chronology";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  RefObject,
} from "react";
import { AtlasStage } from "../atlas/AtlasStage";
import { buildAtlas, placeIdOf } from "../atlas/model";
import { useLayout } from "../atlas/useLayout";
import type { Memory } from "../memories";
import { useTheme } from "../theme/useTheme";
import { Icon } from "../ui/icons";
import { useReducedMotion } from "../useRoute";
import type { LinkFor } from "../useRoute";
import { dateLabel, placeLabel, plural, sharedLine } from "./model";
import { placeLine } from "../memory/facts";

type Order = "oldest" | "newest";
const noBirths: Record<string, number> = {};
const noThumbnails = {};
const ignore = () => {};
const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

/** The journey leg into each memory: from the previous place, in date order. */
function legs(memories: Memory[]) {
  const map = new Map<string, string>();
  const dated = buildChronology(memories).ordered.map((entry) => entry.memory);
  dated.forEach((memory, index) => {
    const from = dated[index - 1]?.place;
    const to = memory.place;
    if (from && to && from.name !== to.name)
      map.set(memory.id, `${from.name} → ${to.name}`);
  });
  return map;
}

export function Timeline({
  memories,
  link,
  heading,
}: {
  memories: Memory[];
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const reduced = useReducedMotion();
  const [order, setOrder] = useState<Order>("oldest");
  const chronology = useMemo(() => buildChronology(memories), [memories]);
  const chronological = useMemo(() => {
    const grouped = new Map<number | null, Memory[]>();
    for (const entry of [
      ...chronology.ordered,
      ...chronology.entries.filter((entry) => entry.date.basis === "unknown"),
    ]) {
      const list = grouped.get(entry.date.year) || [];
      list.push(entry.memory);
      grouped.set(entry.date.year, list);
    }
    return [...grouped].map(([year, memories]) => ({ year, memories }));
  }, [chronology]);
  const groups = useMemo(
    () =>
      order === "oldest"
        ? chronological
        : [...chronological.filter((group) => group.year !== null)]
            .reverse()
            .map((group) => ({
              ...group,
              memories: [...group.memories].reverse(),
            }))
            .concat(chronological.filter((group) => group.year === null)),
    [chronological, order],
  );
  const years = useMemo(
    () =>
      groups
        .flatMap((group) => (group.year === null ? [] : [group.year]))
        .sort((a, b) => a - b),
    [groups],
  );
  const journey = useMemo(() => legs(memories), [memories]);
  const atlas = useMemo(
    () =>
      buildAtlas(
        memories,
        (memory) => chronology.byId.get(memory.id)!.date.year,
      ),
    [memories, chronology],
  );

  const layout = useLayout();
  const { theme } = useTheme();
  const [year, setYear] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [activeMemory, setActiveMemory] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const aside = useRef<HTMLElement>(null);
  const lockUntil = useRef(0);
  const skipScroll = useRef(false);
  const current =
    year !== null && years.includes(year) ? year : (groups[0]?.year ?? null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (skipScroll.current) {
        skipScroll.current = false;
        return;
      }
      if (performance.now() < lockUntil.current || !list.current) return;
      const banded = matchMedia("(max-width: 800px)").matches;
      const top = banded
        ? aside.current?.getBoundingClientRect().bottom || 0
        : 0;
      // The reading line slides down as the page nears its end, so the
      // first and last years are both reachable by scrolling.
      const room = document.documentElement.scrollHeight - innerHeight;
      const progress = room > 0 ? Math.min(1, scrollY / room) : 0;
      const line = top + (innerHeight - top) * (0.1 + 0.75 * progress);
      let found: number | null = null;
      for (const item of list.current.querySelectorAll<HTMLElement>(
        "li[data-year]",
      )) {
        if (item.getBoundingClientRect().top > line) break;
        if (item.dataset.year !== "undated") found = Number(item.dataset.year);
      }
      const first = list.current.querySelector<HTMLElement>(
        "li[data-year]:not([data-year='undated'])",
      );
      found ??= first ? Number(first.dataset.year) : null;
      if (found !== null) setYear(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [groups]);

  const goTo = (target: number, scroll = true) => {
    setReplaying(false);
    setActiveMemory(
      chronology.ordered.find((entry) => entry.date.year === target)?.memory
        .id || null,
    );
    setYear(target);
    if (!scroll) return;
    const before = scrollY;
    // An instant jump fires one scroll event of its own; a smooth one fires many.
    if (!reduced) lockUntil.current = performance.now() + 800;
    list.current?.querySelector(`li[data-year="${target}"]`)?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    if (reduced) skipScroll.current = scrollY !== before;
  };
  const step = (delta: number) => {
    const index = current === null ? -1 : years.indexOf(current);
    const next = years[Math.min(years.length - 1, Math.max(0, index + delta))];
    if (next !== undefined && next !== current) goTo(next);
  };

  const showMemory = (id: string) => {
    setActiveMemory(id);
    const entry = chronology.byId.get(id)!;
    setYear(entry.date.year);
    lockUntil.current = performance.now() + 800;
    list.current
      ?.querySelector(`[data-memory-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
  };
  useEffect(() => {
    if (!replaying) return;
    const timer = setTimeout(() => {
      const index = chronology.ordered.findIndex(
        (entry) => entry.memory.id === activeMemory,
      );
      const next = chronology.ordered[index + 1];
      if (!next) setReplaying(false);
      else showMemory(next.memory.id);
    }, 1400);
    return () => clearTimeout(timer);
  }, [replaying, activeMemory, chronology, reduced]);
  const toggleReplay = () => {
    if (replaying) return setReplaying(false);
    const index = chronology.ordered.findIndex(
      (entry) => entry.memory.id === activeMemory,
    );
    if (index < 0 || index === chronology.ordered.length - 1)
      showMemory(chronology.ordered[0].memory.id);
    setReplaying(true);
  };

  if (!memories.length)
    return (
      <section className="timeline-page is-empty">
        <h1 ref={heading} tabIndex={-1} className="browse-title">
          Timeline
        </h1>
        <div className="browse-empty">
          <h2>Your years start with the first import</h2>
          <p>
            Each photo’s date and place builds the timeline automatically.
            Undated items are placed as “about” dates you can fix later.
          </p>
          <a
            className="primary-action"
            href="#/imports"
            onClick={link("/imports")}
          >
            Add an export
          </a>
        </div>
      </section>
    );

  const min = years[0];
  const max = years[years.length - 1];
  const position = (value: number) =>
    max === min ? 50 : ((value - min) / (max - min)) * 100;
  const inView = groups.find((group) => group.year === current);
  const active = activeMemory
    ? chronology.byId.get(activeMemory)?.memory
    : undefined;
  const inViewMemories =
    active && chronology.byId.get(active.id)?.date.year === current
      ? [
          active,
          ...(inView?.memories || []).filter(
            (memory) => memory.id !== active.id,
          ),
        ]
      : inView?.memories || [];
  const photos = inViewMemories.reduce(
    (sum, memory) => sum + memory.photos.length,
    0,
  );
  const places = [
    ...new Set(
      inViewMemories.flatMap((memory) =>
        memory.place ? [placeLabel(memory.place)] : [],
      ),
    ),
  ];
  const route = inViewMemories
    .map((memory) => journey.get(memory.id))
    .find(Boolean);
  const firstPlace =
    (active && chronology.byId.get(active.id)?.date.year === current
      ? placeIdOf(active)
      : null) ??
    chronological
      .find((group) => group.year === current)
      ?.memories.map(placeIdOf)
      .find(Boolean) ??
    null;
  const previous =
    current === null ? undefined : years[years.indexOf(current) - 1];
  const next = current === null ? undefined : years[years.indexOf(current) + 1];
  const yearFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const value =
      min + ((event.clientX - rect.left) / rect.width) * (max - min);
    return years.reduce((best, candidate) =>
      Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
    );
  };
  const onSliderKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowDown: () => step(-1),
      PageDown: () => step(-1),
      ArrowRight: () => step(1),
      ArrowUp: () => step(1),
      PageUp: () => step(1),
      Home: () => goTo(min),
      End: () => goTo(max),
    };
    if (!moves[event.key]) return;
    event.preventDefault();
    setReplaying(false);
    moves[event.key]();
  };
  const subtitle = !years.length
    ? `${plural(memories.length, "moment")}, none dated yet.`
    : min === max
      ? `${plural(memories.length, "moment")} in ${min}. Scroll and the year in view follows.`
      : `${plural(memories.length, "moment")}, ${min} to ${max}. Scroll and the year in view follows.`;

  return (
    <section className="timeline-page">
      <header className="browse-head">
        <div>
          <h1 ref={heading} tabIndex={-1} className="browse-title">
            Timeline
          </h1>
          <p className="browse-sub">{subtitle}</p>
        </div>
        <div className="br-segmented" role="group" aria-label="Order">
          {(["oldest", "newest"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={order === value}
              onClick={() => setOrder(value)}
            >
              {value === "oldest" ? "Oldest first" : "Newest first"}
            </button>
          ))}
        </div>
      </header>
      <div className="timeline-main">
        <ol
          ref={list}
          key={order}
          className="timeline-years br-stagger"
          aria-label="Moments by year"
        >
          {groups.map((group, index) => (
            <li
              key={group.year ?? "undated"}
              data-year={group.year ?? "undated"}
              className={group.year === current ? "is-current" : undefined}
              style={stagger(index)}
            >
              <h2 className="tl-year">{group.year ?? "Date unknown"}</h2>
              <span className="tl-rail" aria-hidden="true">
                <i />
              </span>
              <div className="tl-moments">
                {group.memories.map((memory) => {
                  const leg = journey.get(memory.id);
                  return (
                    <Fragment key={memory.id}>
                      {leg && order === "oldest" && (
                        <span className="tl-leg">Journey · {leg}</span>
                      )}
                      <a
                        className="tl-card"
                        data-memory-id={memory.id}
                        aria-current={
                          activeMemory === memory.id ? "true" : undefined
                        }
                        href={`#/memory/${memory.id}`}
                        onClick={link(`/memory/${memory.id}`)}
                      >
                        {memory.photos[0] && (
                          <img
                            src={memory.photos[0].src}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <span className="tl-text">
                          <span
                            className={`tl-date${memory.approximate ? " is-about" : ""}`}
                          >
                            {dateLabel(memory)}
                          </span>
                          <h3 className="tl-title">{memory.title}</h3>
                          <span className="tl-meta">
                            {[
                              placeLine(memory),
                              plural(memory.photos.length, "photo"),
                              sharedLine(memory),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </a>
                    </Fragment>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <aside ref={aside} className="timeline-aside" aria-label="Year in view">
        <div
          className={`timeline-globe${reduced ? "" : " has-globe"}`}
          data-year={current ?? ""}
        >
          {/* Reduced motion keeps the still year card; otherwise the globe follows the year. */}
          {!reduced && (
            <AtlasStage
              compact
              atlas={atlas}
              selectedPlace={firstPlace}
              focusPlace={null}
              year={current}
              day={theme === "day"}
              reduced={reduced}
              layout={layout}
              portal={false}
              introStart={null}
              born={noBirths}
              thumbnails={noThumbnails}
              view="globe"
              onView={ignore}
              onPick={ignore}
              onFailedChange={ignore}
              retryKey={0}
            />
          )}
          <div className="globe-fallback">
            <span className="hud-label">In view</span>
            <span className="globe-year">{current ?? "Date unknown"}</span>
            <span className="globe-route">
              {route || places.join(" · ") || "No place recorded"}
            </span>
            <span className="globe-count">
              {plural(inViewMemories.length, "moment")} ·{" "}
              {plural(photos, "photo")}
            </span>
            {places.length > 0 && (
              <ul className="globe-places" aria-label="Places that year">
                {places.map((place) => (
                  <li key={place}>{place}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="year-stepper" role="group" aria-label="Year">
          <button
            type="button"
            aria-label={
              previous ? `Previous year, ${previous}` : "Previous year"
            }
            disabled={previous === undefined}
            onClick={() => step(-1)}
          >
            <Icon name="chevron-right" size={18} className="is-back" />
          </button>
          <span className="stepper-years">
            <span aria-hidden="true">{previous ?? ""}</span>
            <span className="is-current">{current ?? "Date unknown"}</span>
            <span aria-hidden="true">{next ?? ""}</span>
          </span>
          <button
            type="button"
            aria-label={next ? `Next year, ${next}` : "Next year"}
            disabled={next === undefined}
            onClick={() => step(1)}
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
        <div className="timeline-controls">
          <div
            className="year-scrubber"
            role="slider"
            tabIndex={0}
            aria-label="Year"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={current ?? min}
            aria-valuetext={`${current ?? min}, ${plural(inViewMemories.length, "moment")}`}
            onKeyDown={onSliderKey}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setReplaying(false);
              goTo(yearFromPointer(event));
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
              const value = yearFromPointer(event);
              if (value !== current) goTo(value);
            }}
          >
            <span className="scrubber-axis" aria-hidden="true" />
            {Array.from(
              { length: max - min + 1 },
              (_, offset) => min + offset,
            ).map((value) => (
              <span
                key={value}
                aria-hidden="true"
                className={`scrubber-tick${years.includes(value) ? " has-moments" : ""}`}
                style={{ left: `${position(value)}%` }}
              />
            ))}
            <span
              className="scrubber-head"
              aria-hidden="true"
              style={{ left: `${position(current ?? min)}%` }}
            />
            <span className="scrubber-labels" aria-hidden="true">
              {[min, max].map(
                (value) =>
                  Math.abs(position(value) - position(current ?? min)) > 12 && (
                    <span key={value} style={{ left: `${position(value)}%` }}>
                      {value}
                    </span>
                  ),
              )}
              <span
                className="is-current"
                style={{ left: `${position(current ?? min)}%` }}
              >
                {current ?? min}
              </span>
            </span>
          </div>
          <p className="scrubber-help">
            The scrubber and the list move together: drag here and the list
            scrolls; scroll the list and the year follows. ← → step by year.
          </p>
        </div>
        {chronology.ordered.length < 2 && (
          <p className="scrubber-help">
            Replay needs at least two memories with capture or sharing dates.
          </p>
        )}
        <div className="timeline-actions">
          <button
            type="button"
            className="button button--primary"
            disabled={chronology.ordered.length < 2}
            title={
              chronology.ordered.length < 2
                ? "Replay needs at least two memories with capture or sharing dates"
                : undefined
            }
            onClick={toggleReplay}
          >
            {replaying ? "Pause replay" : "Replay memories"}
          </button>
          {inViewMemories[0] && (
            <a
              className="button button--secondary"
              href={`#/?selected=${inViewMemories[0].id}`}
              onClick={link(`/?selected=${inViewMemories[0].id}`)}
            >
              Open on the atlas
            </a>
          )}
        </div>
      </aside>
    </section>
  );
}
