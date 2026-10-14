import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject,
} from "react";
import { AtlasStage } from "./atlas/AtlasStage";
import type { StageView } from "./atlas/AtlasStage";
import { plural, shortDate } from "./atlas/format";
import { Intro, claimIntro } from "./atlas/Intro";
import {
  buildAtlas,
  firstMemoryOfYear,
  placeIdOf,
  yearCounts,
} from "./atlas/model";
import type { PlaceNode } from "./atlas/model";
import { Portal } from "./atlas/Portal";
import { Scrubber } from "./atlas/Scrubber";
import { useLayout } from "./atlas/useLayout";
import type { Memory } from "./memories";
import { Photo } from "./Photo";
import { useTheme } from "./theme/useTheme";
import type { useArchive } from "./useArchive";
import { readRoute } from "./useRoute";
import type { LinkFor } from "./useRoute";
import { Icon } from "./ui/icons";
import "./styles/home.css";

type Archive = ReturnType<typeof useArchive>;

const PORTAL_OUT = 1100;
const REDUCED_FADE = 300;

/** Route changes the Atlas makes itself; App's router listens for popstate. */
function go(url: string, replace = false) {
  history[replace ? "replaceState" : "pushState"]({}, "", `#${url}`);
  dispatchEvent(new PopStateEvent("popstate"));
}

const isField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest(
    'input, textarea, select, [contenteditable="true"], [role="dialog"], .menu',
  );

export function ArchiveStatus({
  archive,
  heading,
}: {
  archive: Archive;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className="atlas-home atlas-status-page">
      <h1 ref={heading} tabIndex={-1} className="visually-hidden">
        The Atlas of Us
      </h1>
      <div className="status-globe" aria-hidden="true" />
      {archive.status === "loading" ? (
        <div className="atlas-loading" role="status">
          <span className="loading-ring" aria-hidden="true" />
          <span className="hud-label">Loading the atlas</span>
        </div>
      ) : archive.status === "error" ? (
        <div className="atlas-error" role="alert">
          <p className="hud-label atlas-error-label">
            <Icon name="alert" size={16} />
            Couldn't load
          </p>
          <h2>The atlas didn't arrive</h2>
          <p>
            {archive.error} Nothing is lost; check your connection and try
            again.
          </p>
          <button
            type="button"
            className="button button--primary"
            onClick={archive.refresh}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="atlas-empty">
          <h2>Your circle's archive</h2>
          <p>
            Your photographs, shared stories and the places that bring you back.
            Together in one private archive.
          </p>
        </div>
      )}
    </section>
  );
}

export function Home(props: {
  archive: Archive;
  memories: Memory[];
  selected: Memory | undefined;
  demo: boolean;
  reduced: boolean;
  link: LinkFor;
  chooseMemory: (id: string) => void;
  heading: RefObject<HTMLHeadingElement | null>;
  openLink: RefObject<HTMLAnchorElement | null>;
}) {
  if (!props.selected)
    return (
      <EmptyAtlas
        archive={props.archive}
        link={props.link}
        heading={props.heading}
        reduced={props.reduced}
      />
    );
  return <AtlasHome {...props} selected={props.selected} />;
}

function EmptyAtlas({
  archive,
  link,
  heading,
  reduced,
}: {
  archive: Archive;
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
  reduced: boolean;
}) {
  const layout = useLayout();
  const { theme } = useTheme();
  const atlas = useMemo(() => buildAtlas([]), []);
  const circle = archive.groups.find((group) => group.id === archive.group);
  return (
    <section className="atlas-home atlas-empty-page" data-layout={layout}>
      <h1 ref={heading} tabIndex={-1} className="visually-hidden">
        The Atlas of Us
      </h1>
      <div className="atlas-dim">
        <AtlasStage
          atlas={atlas}
          selectedPlace={null}
          focusPlace={null}
          year={null}
          day={theme === "day"}
          reduced={reduced}
          layout={layout}
          portal={false}
          introStart={null}
          born={{}}
          thumbnails={{}}
          view="globe"
          onView={() => {}}
          onPick={() => {}}
          onFailedChange={() => {}}
          retryKey={0}
        />
      </div>
      <div className="atlas-empty">
        {circle && (
          <p className="hud-label atlas-empty-circle">
            {circle.name} · new circle
          </p>
        )}
        <h2>
          {archive.group
            ? "The atlas is waiting for its first memory"
            : "Start your circle's atlas"}
        </h2>
        <p>
          {archive.group
            ? "Add an export from Apple Photos, WhatsApp, Discord or Messenger. Mazi pins each photo and chat to where and when it happened, and the globe lights up."
            : "Create or join your circle to start your shared archive."}
        </p>
        {archive.group && (
          <div className="atlas-note" role="note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="9" r="3" />
              <circle cx="17" cy="10" r="2.2" />
              <path d="M3 19c1-3 3.3-4.5 6-4.5s5 1.5 6 4.5" />
            </svg>
            <span>
              Whatever you add is shared with everyone in your circle as soon as
              it's imported.
            </span>
          </div>
        )}
        <div className="atlas-empty-actions">
          <a
            className="primary-action"
            href="#/imports"
            onClick={link("/imports")}
          >
            {archive.group ? "Add photographs" : "Create or join a circle"}
          </a>
          <a
            className="button button--secondary"
            href="#/introduction"
            onClick={link("/introduction")}
          >
            Replay introduction
          </a>
        </div>
      </div>
    </section>
  );
}

function AtlasHome({
  archive,
  memories,
  selected,
  demo,
  reduced,
  link,
  chooseMemory,
  openLink,
}: {
  archive: Archive;
  memories: Memory[];
  selected: Memory;
  demo: boolean;
  reduced: boolean;
  link: LinkFor;
  chooseMemory: (id: string) => void;
  heading: RefObject<HTMLHeadingElement | null>;
  openLink: RefObject<HTMLAnchorElement | null>;
}) {
  const layout = useLayout();
  const phone = layout === "phone";
  const compact = phone || layout === "tablet";
  const { theme } = useTheme();
  const atlas = useMemo(() => buildAtlas(memories), [memories]);
  const counts = useMemo(() => yearCounts(memories), [memories]);
  const byPlace = useMemo(
    () => new Map(atlas.places.map((place) => [place.id, place])),
    [atlas],
  );
  const byId = useMemo(
    () => new Map(memories.map((memory) => [memory.id, memory])),
    [memories],
  );
  const selectedPlace = placeIdOf(selected);
  const year = selected.year;
  const [focusPlace, setFocusPlace] = useState<string | null>(null);
  const [view, setView] = useState<StageView>("globe");
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [snap, setSnap] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [introStart, setIntroStart] = useState<number | null>(() =>
    claimIntro() ? performance.now() / 1000 : null,
  );
  const [phase, setPhase] = useState<"intro" | "return" | "skip" | "done">(
    () => (introStart === null ? "return" : "intro"),
  );
  const flat = failed || view === "flat";

  // New places get a birth time so the globe can pulse them in.
  const known = useRef<Set<string> | null>(null);
  const [born, setBorn] = useState<Record<string, number>>({});
  useEffect(() => {
    const ids = atlas.places.map((place) => place.id);
    if (!known.current) {
      known.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !known.current!.has(id));
    fresh.forEach((id) => known.current!.add(id));
    if (fresh.length) {
      const now = performance.now() / 1000;
      setBorn((previous) => ({
        ...previous,
        ...Object.fromEntries(fresh.map((id) => [id, now])),
      }));
    }
  }, [atlas]);

  // The portal lives in the URL; it stays mounted while it closes.
  const wanted =
    new URLSearchParams(readRoute().search).get("view") === "portal";
  const [portal, setPortal] = useState<{
    id: string;
    closing: boolean;
  } | null>(() => (wanted ? { id: selected.id, closing: false } : null));
  const opener = useRef<Element | null>(null);
  const pushed = useRef(false);
  useEffect(() => {
    if (wanted) {
      setPortal({ id: selected.id, closing: false });
      return;
    }
    setPortal((current) =>
      current && !current.closing ? { ...current, closing: true } : current,
    );
  }, [wanted, selected.id]);
  useEffect(() => {
    if (!portal?.closing) return;
    const timer = setTimeout(
      () => {
        setPortal(null);
        const target = opener.current;
        if (target instanceof HTMLElement && target.isConnected)
          target.focus({ preventScroll: true });
        else openLink.current?.focus({ preventScroll: true });
      },
      reduced ? REDUCED_FADE : PORTAL_OUT,
    );
    return () => clearTimeout(timer);
  }, [portal?.closing, reduced, openLink]);
  const portalOpen = !!portal && !portal.closing;

  const openPortal = useCallback(
    (id = selected.id) => {
      const active = document.activeElement;
      opener.current =
        active && active !== document.body ? active : openLink.current;
      pushed.current = true;
      setPlaying(false);
      setFocusPlace(null);
      go(`/?selected=${id}&view=portal`);
    },
    [selected.id, openLink],
  );
  const closePortal = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else go(`/?selected=${selected.id}`, true);
  }, [selected.id]);
  const portalIndex = memories.findIndex((memory) => memory.id === selected.id);
  const stepPortal = (direction: -1 | 1) => {
    const next = memories[portalIndex + direction];
    if (next) go(`/?selected=${next.id}&view=portal`, true);
  };

  const representative = useCallback(
    (place: PlaceNode) => {
      const ids = place.memories;
      const inYear =
        year !== null
          ? ids.find((id) => byId.get(id)?.year === year)
          : undefined;
      return inYear ?? ids[0];
    },
    [byId, year],
  );
  const choosePlace = useCallback(
    (placeId: string) => {
      if (placeId === selectedPlace) return openPortal();
      const place = byPlace.get(placeId);
      if (place) chooseMemory(representative(place));
    },
    [selectedPlace, openPortal, byPlace, chooseMemory, representative],
  );
  const chooseYear = useCallback(
    (value: number) => {
      const memory = firstMemoryOfYear(memories, value);
      if (memory) chooseMemory(memory.id);
    },
    [memories, chooseMemory],
  );

  // Replay walks the years, 1.2 s each (1.5 s steps under reduced motion).
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => {
        const next = atlas.years.find((value) => value > (year ?? -Infinity));
        if (next === undefined) setPlaying(false);
        else chooseYear(next);
      },
      reduced ? 1500 : 1200,
    );
    return () => clearTimeout(timer);
  }, [playing, year, atlas.years, chooseYear, reduced]);
  const toggleReplay = () => {
    if (playing) return setPlaying(false);
    const last = atlas.years[atlas.years.length - 1];
    if (year === null || year === last) chooseYear(atlas.years[0]);
    setPlaying(true);
  };

  // Index rows in order: places, then memories with no place.
  const rows = useMemo(
    () => [
      ...atlas.places.map((place) => ({ key: place.id, place })),
      ...atlas.unplaced.map((memory) => ({ key: memory.id, memory })),
    ],
    [atlas],
  );
  const currentRow = rows.findIndex((row) =>
    "place" in row
      ? row.place.id === selectedPlace
      : row.memory.id === selected.id,
  );
  const indexNav = useRef<HTMLElement>(null);
  const activateRow = (index: number) => {
    const row = rows[index];
    if (!row) return;
    if ("place" in row) choosePlace(row.place.id);
    else if (row.memory.id === selected.id) openPortal();
    else chooseMemory(row.memory.id);
  };
  const onIndexKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = Array.from(
      indexNav.current?.querySelectorAll<HTMLButtonElement>(".index-row") || [],
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = Math.max(
      0,
      Math.min(buttons.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)),
    );
    buttons[next]?.focus();
  };

  // Page shortcuts: ← → years, ↑ ↓ places, Enter open, Esc back, / search.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (isField(event.target)) return;
      if (portalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closePortal();
        }
        return;
      }
      const target = event.target as HTMLElement;
      const onControl = !!target.closest?.("a, button, [role='slider']");
      if (event.key === "/") {
        event.preventDefault();
        go("/search");
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const step = event.key === "ArrowRight" ? 1 : -1;
        const index = atlas.years.indexOf(year ?? NaN);
        const next =
          index < 0
            ? atlas.years[step > 0 ? 0 : atlas.years.length - 1]
            : atlas.years[index + step];
        if (next !== undefined) {
          event.preventDefault();
          chooseYear(next);
        }
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (onControl) return;
        event.preventDefault();
        const next = Math.max(
          0,
          Math.min(
            rows.length - 1,
            currentRow + (event.key === "ArrowDown" ? 1 : -1),
          ),
        );
        const row = rows[next];
        if (row)
          chooseMemory(
            "place" in row ? representative(row.place) : row.memory.id,
          );
      } else if (event.key === "Enter" && !onControl) {
        event.preventDefault();
        openPortal();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [
    portalOpen,
    closePortal,
    atlas.years,
    year,
    chooseYear,
    rows,
    currentRow,
    chooseMemory,
    representative,
    openPortal,
  ]);

  const circle = demo
    ? "Sample Atlas"
    : archive.groups.find((group) => group.id === archive.group)?.name;
  const placesThisYear =
    year === null
      ? 0
      : atlas.places.filter((place) => place.years[year]).length;
  const memoriesThisYear = year === null ? 0 : counts[year] || 0;
  const yearSummary =
    year === null
      ? "Date not recorded"
      : `${plural(placesThisYear, "place")} · ${plural(memoriesThisYear, "memory", "memories")}`;
  const valueText =
    year === null
      ? `No date recorded for ${selected.shortTitle}`
      : `${year}, ${yearSummary.replace(" · ", ", ")}`;
  const thumbnails = useMemo(
    () =>
      Object.fromEntries(
        atlas.places.map((place) => {
          const memory = byId.get(place.memories[0])!;
          return [
            place.id,
            {
              src: memory.photos[0]?.src || "",
              title: place.name,
              meta: `${shortDate(memory)} · ${plural(place.count, "memory", "memories")}`,
            },
          ];
        }),
      ),
    [atlas, byId],
  );
  const span = atlas.years.length
    ? atlas.years.length === 1
      ? String(atlas.years[0])
      : `${atlas.years[0]} – ${atlas.years[atlas.years.length - 1]}`
    : "";
  const kicker = [circle, span].filter(Boolean).join(" · ");
  const summary = `${plural(atlas.places.length, "place")}. ${plural(memories.length, "memory", "memories")}. One thread.`;

  const openFeatured = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    openPortal();
  };
  const portalMemory = portal ? byId.get(portal.id) || selected : undefined;

  const indexRows = (
    <nav
      ref={indexNav}
      className={`atlas-index ${drawer ? "is-open" : ""}`}
      aria-label="Places and moments"
      onKeyDown={onIndexKey}
      onMouseLeave={() => setFocusPlace(null)}
    >
      <p className="hud-label index-title">
        Places &amp; moments · {atlas.places.length}
      </p>
      <ul className="index-list">
        {rows.map((row, index) => {
          const current = index === currentRow;
          const style = { "--i": Math.min(index, 8) } as CSSProperties;
          const tabIndex = current || (currentRow < 0 && index === 0) ? 0 : -1;
          if ("place" in row) {
            const place = row.place;
            const latest = byId.get(representative(place))!;
            return (
              <li key={row.key} style={style}>
                <button
                  type="button"
                  className="index-row"
                  aria-current={current ? "true" : undefined}
                  tabIndex={tabIndex}
                  onClick={() => activateRow(index)}
                  onMouseEnter={() => setFocusPlace(place.id)}
                  onFocus={() => setFocusPlace(place.id)}
                  onBlur={() => setFocusPlace(null)}
                >
                  <span className="index-name">{place.name}</span>
                  <span
                    className={`index-meta ${latest.approximate && !current ? "is-approximate" : ""}`}
                  >
                    {current ? selected.shortTitle : shortDate(latest)} ·{" "}
                    {place.count}
                    <span className="visually-hidden">
                      {place.count === 1 ? " memory" : " memories"}
                    </span>
                  </span>
                </button>
              </li>
            );
          }
          const memory = row.memory;
          return (
            <li key={row.key} style={style}>
              {index === atlas.places.length && (
                <p className="hud-label index-group">No place recorded</p>
              )}
              <button
                type="button"
                className="index-row is-unplaced"
                aria-current={current ? "true" : undefined}
                tabIndex={tabIndex}
                onClick={() => activateRow(index)}
              >
                <span className="index-name">{memory.shortTitle}</span>
                <span className="index-meta">{shortDate(memory)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const featured = (
    <article className="featured atlas-card" aria-labelledby="featured-title">
      <Photo
        key={selected.photos[0].src}
        photo={selected.photos[0]}
        continuity={!portal}
        eager
        openMemory={{
          href: `#/memory/${selected.id}`,
          label: `Open ${selected.shortTitle}`,
          onClick: openFeatured,
        }}
      />
      <div className="feature-info">
        <h2 id="featured-title" aria-live="polite">
          {selected.title}
        </h2>
        <p className="featured-meta">
          {[
            shortDate(selected),
            selected.place?.name,
            plural(selected.photos.length, "photo"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <a
          ref={openLink}
          className="primary-action"
          href={`#/memory/${selected.id}`}
          onClick={openFeatured}
        >
          Open memory
        </a>
      </div>
    </article>
  );

  const memoryList = (
    <section className="atlas-card atlas-recent" aria-labelledby="recent-title">
      <div className="recent-head">
        <h2 id="recent-title" className="hud-label">
          {demo ? "Sample memories" : "Memories"} · {memories.length}
        </h2>
        <a
          href="#/timeline"
          onClick={link("/timeline")}
          aria-label="All memories"
        >
          All
        </a>
      </div>
      <div className="memory-list">
        {memories.map((item) => (
          <button
            key={item.id}
            type="button"
            className="memory-choice"
            aria-label={`Select ${item.shortTitle}`}
            aria-pressed={selected.id === item.id}
            onClick={() => chooseMemory(item.id)}
            onMouseEnter={() => setFocusPlace(placeIdOf(item))}
            onMouseLeave={() => setFocusPlace(null)}
          >
            <img src={item.photos[0].src} alt="" loading="lazy" />
            <span className="choice-copy">
              <span className="choice-title">{item.shortTitle}</span>
              <span className="choice-meta">
                {shortDate(item)}
                {item.place ? ` · ${item.place.name}` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  const timebar = (
    <div className="atlas-timebar">
      <div className="timebar-row">
        {!phone && (
          <button
            type="button"
            className="replay"
            onClick={toggleReplay}
            disabled={atlas.years.length < 2}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              {playing ? (
                <path d="M2 1h3v10H2zM7 1h3v10H7z" />
              ) : (
                <path d="M2 1l9 5-9 5z" />
              )}
            </svg>
            {playing ? "Pause" : "Replay"}
          </button>
        )}
        <Scrubber
          years={atlas.years}
          counts={counts}
          year={year}
          valueText={valueText}
          onYear={(value) => {
            setPlaying(false);
            chooseYear(value);
          }}
          playing={playing}
          compact={compact}
        />
      </div>
      {!compact && (
        <p className="hud-label atlas-hints" aria-hidden="true">
          <span>Drag to turn</span>
          <span>↑ ↓ places</span>
          <span>← → years</span>
          <span>Enter open</span>
          <span>Esc back</span>
          <span>/ search</span>
        </p>
      )}
    </div>
  );

  return (
    <section
      className="atlas-home"
      data-layout={layout}
      data-phase={phase}
      data-portal={portal ? (portal.closing ? "closing" : "open") : undefined}
      data-flat={flat || undefined}
      aria-labelledby="atlas-title"
    >
      <h1 id="atlas-title" className="visually-hidden">
        The Atlas of Us
      </h1>
      <AtlasStage
        atlas={atlas}
        selectedPlace={selectedPlace}
        focusPlace={focusPlace}
        year={year}
        day={theme === "day"}
        reduced={reduced}
        layout={layout}
        portal={portalOpen}
        introStart={phase === "intro" ? introStart : null}
        born={born}
        thumbnails={thumbnails}
        view={view}
        onView={setView}
        onPick={choosePlace}
        onFailedChange={setFailed}
        retryKey={retryKey}
      />
      <div
        className="atlas-hud"
        inert={portalOpen}
        aria-hidden={portalOpen || undefined}
      >
        <div className="atlas-readout">
          <p className="readout-year">{year ?? "Undated"}</p>
          <p className="hud-label readout-summary">{yearSummary}</p>
        </div>
        <div className="atlas-view" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={!flat}
            onClick={() => {
              if (failed) setRetryKey((value) => value + 1);
              setView("globe");
            }}
          >
            Globe
          </button>
          <button
            type="button"
            aria-pressed={flat}
            onClick={() => setView("flat")}
          >
            Flat map
          </button>
        </div>
        {layout === "tablet" && (
          <button
            type="button"
            className="button button--secondary index-toggle"
            aria-expanded={drawer}
            onClick={() => setDrawer((open) => !open)}
          >
            <Icon name={drawer ? "close" : "chevron-right"} size={14} />
            Places
          </button>
        )}
        {!phone && indexRows}
        {!phone && (
          <div className="atlas-aside">
            {featured}
            {memoryList}
          </div>
        )}
        {phone ? (
          <AtlasSheet snap={snap} onSnap={setSnap} timebar={timebar}>
            {featured}
            {indexRows}
            {memoryList}
          </AtlasSheet>
        ) : (
          timebar
        )}
      </div>
      {portal && portalMemory && (
        <Portal
          memory={portalMemory}
          closing={portal.closing}
          phone={compact}
          onClose={closePortal}
          onStep={stepPortal}
          onOpen={link(`/memory/${portalMemory.id}`, true)}
          hasPrevious={portalIndex > 0}
          hasNext={portalIndex >= 0 && portalIndex < memories.length - 1}
        />
      )}
      {phase === "intro" && (
        <Intro
          kicker={kicker}
          summary={summary}
          reduced={reduced}
          onDone={(skipped) => {
            setPhase(skipped ? "skip" : "done");
            setIntroStart(null);
          }}
        />
      )}
    </section>
  );
}

const SNAPS = [0.3, 0.6, 1];

/** Phone bottom sheet over the globe, snapping at 30%, 60% and full height. */
function AtlasSheet({
  snap,
  onSnap,
  timebar,
  children,
}: {
  snap: number;
  onSnap: (snap: number) => void;
  timebar: ReactNode;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ start: number; height: number; moved: number } | null>(
    null,
  );
  const settle = (height: number) => {
    const parent = sheet.current?.parentElement?.getBoundingClientRect().height;
    if (sheet.current) sheet.current.style.height = "";
    if (!parent) return;
    const ratio = height / parent;
    onSnap(
      SNAPS.reduce(
        (best, value, index) =>
          Math.abs(value - ratio) < Math.abs(SNAPS[best] - ratio)
            ? index
            : best,
        0,
      ),
    );
  };
  return (
    <section
      ref={sheet}
      className="atlas-sheet"
      data-snap={snap}
      aria-label="Places and memories"
    >
      {timebar}
      <button
        type="button"
        className="atlas-sheet-handle"
        aria-label={
          snap < 2 ? "Show more places and memories" : "Show less of the sheet"
        }
        aria-expanded={snap > 0}
        onClick={() => {
          if (drag.current && drag.current.moved > 6) return;
          onSnap(snap < 2 ? snap + 1 : 0);
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            start: event.clientY,
            height: sheet.current?.getBoundingClientRect().height || 0,
            moved: 0,
          };
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state || !sheet.current) return;
          state.moved = Math.abs(event.clientY - state.start);
          if (state.moved < 6) return;
          sheet.current.style.transition = "none";
          sheet.current.style.height = `${Math.max(120, state.height - (event.clientY - state.start))}px`;
        }}
        onPointerUp={(event) => {
          const state = drag.current;
          if (!state || !sheet.current) return;
          sheet.current.style.transition = "";
          if (state.moved >= 6)
            settle(state.height - (event.clientY - state.start));
          setTimeout(() => {
            drag.current = null;
          });
        }}
        onPointerCancel={() => {
          if (sheet.current) {
            sheet.current.style.transition = "";
            sheet.current.style.height = "";
          }
          drag.current = null;
        }}
      />
      <div className="atlas-sheet-body">{children}</div>
    </section>
  );
}
