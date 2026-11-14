import { buildChronology } from "./memory/chronology";
import { sourceSharedLine } from "./memory/provenance";
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
import { plural, shortDate, placeLabel } from "./atlas/format";
import { Intro, claimIntro } from "./atlas/Intro";
import { buildAtlas, placeIdOf } from "./atlas/model";
import type { PlaceNode } from "./atlas/model";
import { PlaceForm, UnplacedTray } from "./atlas/PlaceMemories";
import type { OnPlaced } from "./atlas/PlaceMemories";
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
  history[replace ? "replaceState" : "pushState"](
    replace ? history.state : {},
    "",
    `#${url}`,
  );
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
        Atlas
      </h1>
      <div className="status-globe" aria-hidden="true" />
      {archive.status === "loading" ? (
        <div className="atlas-loading" role="status">
          <span className="loading-ring" aria-hidden="true" />
          <span className="hud-label">Atlas yükleniyor</span>
        </div>
      ) : archive.status === "error" ? (
        <div className="atlas-error" role="alert">
          <p className="hud-label atlas-error-label">
            <Icon name="alert" size={16} />
            Yüklenemedi
          </p>
          <h2>Atlas yüklenemedi</h2>
          <p>{archive.error} Bağlantını kontrol edip yeniden dene.</p>
          <button
            type="button"
            className="button button--primary"
            onClick={archive.refresh}
          >
            Yeniden dene
          </button>
        </div>
      ) : (
        <div className="atlas-empty">
          <h2>Grubunun arşivi</h2>
          <p>
            Fotoğraflarınız, ortak hikâyeleriniz ve hatırladığınız yerler
            grubunuza özel bir arşivde buluşur.
          </p>
        </div>
      )}
    </section>
  );
}

export function Atlas(props: {
  archive: Archive;
  memories: Memory[];
  selected: Memory | undefined;
  demo: boolean;
  reduced: boolean;
  link: LinkFor;
  chooseMemory: (id: string) => void;
  openMemory: (id: string) => void;
  onPlaced: OnPlaced;
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
        Atlas
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
            {circle.name} · yeni grup
          </p>
        )}
        <h2>
          {archive.group
            ? "Atlas ilk anısını bekliyor"
            : "Grubunun Atlas’ını başlat"}
        </h2>
        <p>
          {archive.group
            ? "Apple Photos, WhatsApp, Discord veya Messenger arşivi ekle. Bilinen tarihler ve izinli yerler Atlas’ta görünür."
            : "Ortak arşivinizi başlatmak için bir grup oluştur veya gruba katıl."}
        </p>
        {archive.group && (
          <div className="atlas-note" role="note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="9" r="3" />
              <circle cx="17" cy="10" r="2.2" />
              <path d="M3 19c1-3 3.3-4.5 6-4.5s5 1.5 6 4.5" />
            </svg>
            <span>
              Eklediğin içerik içe aktarılınca grubundaki herkesle paylaşılır.
            </span>
          </div>
        )}
        <div className="atlas-empty-actions">
          <a
            className="primary-action"
            href="#/imports"
            onClick={link("/imports")}
          >
            {archive.group ? "Fotoğraf ekle" : "Grup oluştur veya gruba katıl"}
          </a>
          <a
            className="button button--secondary"
            href="#/introduction"
            onClick={link("/introduction")}
          >
            Tanıtımı yeniden izle
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
  openMemory,
  onPlaced,
  openLink,
}: {
  archive: Archive;
  memories: Memory[];
  selected: Memory;
  demo: boolean;
  reduced: boolean;
  link: LinkFor;
  chooseMemory: (id: string) => void;
  openMemory: (id: string) => void;
  onPlaced: OnPlaced;
  heading: RefObject<HTMLHeadingElement | null>;
  openLink: RefObject<HTMLAnchorElement | null>;
}) {
  const layout = useLayout();
  const phone = layout === "phone";
  const compact = phone || layout === "tablet";
  const { theme } = useTheme();
  const chronology = useMemo(() => buildChronology(memories), [memories]);
  const yearOf = useCallback(
    (memory: Memory) => chronology.byId.get(memory.id)!.date.year,
    [chronology],
  );
  const atlas = useMemo(() => buildAtlas(memories, yearOf), [memories, yearOf]);
  const counts = useMemo(() => {
    const values: Record<number, number> = {};
    for (const entry of chronology.ordered) {
      const year = entry.date.year!;
      values[year] = (values[year] || 0) + 1;
    }
    return values;
  }, [chronology]);
  const byPlace = useMemo(
    () => new Map(atlas.places.map((place) => [place.id, place])),
    [atlas],
  );
  const byId = useMemo(
    () => new Map(memories.map((memory) => [memory.id, memory])),
    [memories],
  );
  const selectedPlace = placeIdOf(selected);
  const selectedDate = chronology.byId.get(selected.id)!.date;
  const year = selectedDate.year;
  const [focusPlace, setFocusPlace] = useState<string | null>(null);
  const [view, setView] = useState<StageView>("globe");
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [snap, setSnap] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
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
      setPlaying(false);
      openMemory(id);
    },
    [selected.id, openMemory],
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
          ? ids.find((id) => yearOf(byId.get(id)!) === year)
          : undefined;
      return inYear ?? ids[0];
    },
    [byId, year, yearOf],
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
      const memory = chronology.ordered.find(
        (entry) => entry.date.year === value,
      )?.memory;
      if (memory) chooseMemory(memory.id);
    },
    [chronology, chooseMemory],
  );

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => {
        const index = chronology.ordered.findIndex(
          (entry) => entry.memory.id === selected.id,
        );
        const next = chronology.ordered[index + 1];
        if (!next) setPlaying(false);
        else chooseMemory(next.memory.id);
      },
      reduced ? 1500 : 1200,
    );
    return () => clearTimeout(timer);
  }, [playing, selected.id, chronology, chooseMemory, reduced]);
  const toggleReplay = () => {
    if (playing) return setPlaying(false);
    const index = chronology.ordered.findIndex(
      (entry) => entry.memory.id === selected.id,
    );
    if (index < 0 || index === chronology.ordered.length - 1)
      chooseMemory(chronology.ordered[0].memory.id);
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

  // Page shortcuts: ← → yıllar, ↑ ↓ yerler, Enter aç, Esc geri, / ara.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (readRoute().path !== "/" || isField(event.target)) return;
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
        go("/photos?search=1");
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
    ? "Örnek Atlas"
    : archive.groups.find((group) => group.id === archive.group)?.name;
  const placesThisYear =
    year === null
      ? 0
      : atlas.places.filter((place) => place.years[year]).length;
  const memoriesThisYear = year === null ? 0 : counts[year] || 0;
  const yearSummary =
    year === null
      ? selectedDate.label
      : `${selectedDate.basis === "shared" ? selectedDate.label + " · " : ""}${plural(placesThisYear, "yer", "yer")} · ${plural(memoriesThisYear, "anı", "anı")}`;
  const valueText =
    year === null
      ? `${selected.shortTitle}: tarih bilinmiyor`
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
              meta: `${shortDate(memory)} · ${plural(place.count, "anı", "anı")}`,
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
  const summary = `${plural(atlas.places.length, "yer", "yer")}. ${plural(memories.length, "anı", "anı")}. Ortak bir yolculuk.`;

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
      aria-label="Yerler ve anılar"
      onKeyDown={onIndexKey}
      onMouseLeave={() => setFocusPlace(null)}
    >
      <p className="hud-label index-title">
        Yerler ve anılar · {atlas.places.length}
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
                    <span className="visually-hidden">{" anı"}</span>
                  </span>
                </button>
              </li>
            );
          }
          const memory = row.memory;
          return (
            <li key={row.key} style={style}>
              {index === atlas.places.length && (
                <p className="hud-label index-group">Yer bilinmiyor</p>
              )}
              <button
                type="button"
                className="index-row is-unplaced"
                aria-current={current ? "true" : undefined}
                tabIndex={tabIndex}
                onClick={() => activateRow(index)}
              >
                <span className="index-name">{memory.shortTitle}</span>
                <span className="index-meta">
                  {[
                    shortDate(memory),
                    placeLabel(memory),
                    sourceSharedLine(memory),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
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
          label: `${selected.shortTitle} anısını aç`,
          onClick: openFeatured,
        }}
      />
      <div className="feature-info">
        <h2 id="featured-title" aria-live="polite">
          {selected.kind === "memory" ? (
            <a
              href={`#/memory/${selected.id}?notebook=1`}
              onClick={link(`/memory/${selected.id}?notebook=1`)}
            >
              {selected.title}
            </a>
          ) : (
            selected.title
          )}
        </h2>
        <p className="featured-meta">
          {[
            shortDate(selected),
            sourceSharedLine(selected),
            placeLabel(selected),
            plural(selected.photos.length, "fotoğraf", "fotoğraf"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {!demo && (
          <button
            type="button"
            className="button button--ghost feature-place"
            aria-expanded={placing === selected.id}
            onClick={() =>
              setPlacing(placing === selected.id ? null : selected.id)
            }
          >
            {selected.place ? "Yeri değiştir" : "Yer ekle"}
          </button>
        )}
        {!demo && placing === selected.id && (
          <PlaceForm
            key={selected.id}
            group={archive.group}
            memory={selected}
            autoFocus
            onPlaced={(id, pin) => {
              setPlacing(null);
              onPlaced(id, pin);
            }}
          />
        )}
        <a
          ref={openLink}
          className="primary-action"
          href={`#/memory/${selected.id}`}
          onClick={openFeatured}
        >
          Anıyı aç
        </a>
        {!demo && selected.kind === "memory" && (
          <a
            className="notes-link"
            href={`#/memory/${selected.id}?notebook=1`}
            onClick={link(`/memory/${selected.id}?notebook=1`)}
          >
            Notları aç <Icon name="chevron-right" size={14} />
          </a>
        )}
      </div>
    </article>
  );

  const memoryList = (
    <section className="atlas-card atlas-recent" aria-labelledby="recent-title">
      <div className="recent-head">
        <h2 id="recent-title" className="hud-label">
          {demo ? "Örnek anılar" : "Anılar"} · {memories.length}
        </h2>
        <a
          href="#/photos"
          onClick={link("/photos")}
          aria-label="Fotoğraflarda gezin"
        >
          Fotoğraflar
        </a>
      </div>
      <div className="memory-list">
        {memories.map((item) => (
          <button
            key={item.id}
            type="button"
            className="memory-choice"
            aria-label={`${item.shortTitle} anısını seç`}
            aria-pressed={selected.id === item.id}
            onClick={() => chooseMemory(item.id)}
            onMouseEnter={() => setFocusPlace(placeIdOf(item))}
            onMouseLeave={() => setFocusPlace(null)}
          >
            <img src={item.photos[0].src} alt="" loading="lazy" />
            <span className="choice-copy">
              <span className="choice-title">{item.shortTitle}</span>
              <span className="choice-meta">
                {[shortDate(item), placeLabel(item), sourceSharedLine(item)]
                  .filter(Boolean)
                  .join(" · ")}
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
        <button
          type="button"
          className="replay"
          onClick={toggleReplay}
          disabled={chronology.ordered.length < 2}
          title={
            chronology.ordered.length < 2
              ? "Yeniden oynatmak için tarihli en az iki anı gerekir"
              : undefined
          }
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            {playing ? (
              <path d="M2 1h3v10H2zM7 1h3v10H7z" />
            ) : (
              <path d="M2 1l9 5-9 5z" />
            )}
          </svg>
          {playing ? "Duraklat" : "Yeniden oynat"}
        </button>
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
      {chronology.ordered.length < 2 && (
        <p className="hud-label">
          Yeniden oynatmak için tarihli en az iki anı gerekir.
        </p>
      )}
      {!compact && (
        <p className="hud-label atlas-hints" aria-hidden="true">
          <span>Döndürmek için sürükle</span>
          <span>↑ ↓ yerler</span>
          <span>← → yıllar</span>
          <span>Enter aç</span>
          <span>Esc geri</span>
          <span>/ ara</span>
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
      <h1
        id="atlas-title"
        ref={heading}
        tabIndex={-1}
        className="visually-hidden"
      >
        Atlas
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
          <p className="readout-year">{year ?? "Tarih bilinmiyor"}</p>
          <p className="hud-label readout-summary">{yearSummary}</p>
        </div>
        <div className="atlas-view" role="group" aria-label="Görünüm">
          <button
            type="button"
            aria-pressed={!flat}
            onClick={() => {
              if (failed) setRetryKey((value) => value + 1);
              setView("globe");
            }}
          >
            Küre
          </button>
          <button
            type="button"
            aria-pressed={flat}
            onClick={() => setView("flat")}
          >
            Düz harita
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
            Yerler
          </button>
        )}
        {!phone && indexRows}
        {!demo && (
          <UnplacedTray
            group={archive.group}
            memories={atlas.unplaced}
            onPlaced={onPlaced}
            onSelect={chooseMemory}
            defaultOpen={!phone}
            closeOnPlace={phone}
          />
        )}
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
          demo={demo}
          closing={portal.closing}
          phone={compact}
          onClose={closePortal}
          onStep={stepPortal}
          onOpen={link(`/memory/${portalMemory.id}`, true, true)}
          onNotebook={link(
            `/memory/${portalMemory.id}?notebook=1`,
            false,
            true,
          )}
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
      aria-label="Yerler ve anılar"
    >
      {timebar}
      <button
        type="button"
        className="atlas-sheet-handle"
        aria-label={snap < 2 ? "Daha fazla yer ve anı göster" : "Paneli küçült"}
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
