import { lazy, Suspense } from "react";
import type { RefObject } from "react";
import type { Memory } from "./memories";
import { Photo } from "./Photo";
import type { useArchive } from "./useArchive";
import type { LinkFor } from "./useRoute";
import { Arrow } from "./ui/icons";
import { MemoryMeta } from "./ui/MemoryMeta";
import "./styles/home.css";
const Atlas = lazy(() => import("./Atlas"));

type Archive = ReturnType<typeof useArchive>;

export function ArchiveStatus({
  archive,
  heading,
}: {
  archive: Archive;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className="archive-welcome">
      <div className="welcome-globe" aria-hidden="true" />
      <p className="welcome-kicker">A place for your circle</p>
      <h1 ref={heading} tabIndex={-1}>
        The Atlas of Us
      </h1>
      <p>
        {archive.status === "loading"
          ? "Opening your archive…"
          : archive.status === "error"
            ? archive.error
            : "Your photographs, shared stories and the places that bring you back. Together in one private archive."}
      </p>
      {archive.status === "error" ? (
        <button className="primary-action" onClick={archive.refresh}>
          Retry archive
        </button>
      ) : null}
    </section>
  );
}

export function Home({
  archive,
  memories,
  selected,
  demo,
  reduced,
  link,
  chooseMemory,
  heading,
  openLink,
}: {
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
  if (!selected)
    return (
      <section className="archive-welcome">
        <div className="welcome-globe" aria-hidden="true" />
        <h1 ref={heading} tabIndex={-1}>
          The Atlas of Us
        </h1>
        <p>
          {archive.group
            ? "Your Atlas is ready for its first photographs. Import an archive, then gather your photographs into memories."
            : "Create or join your circle to start your shared archive."}
        </p>
        <a
          className="primary-action"
          href="#/imports"
          onClick={link("/imports")}
        >
          {archive.group ? "Add photographs" : "Create or join a circle"}{" "}
          <Arrow />
        </a>
      </section>
    );
  return (
    <>
      <div className="home-grid">
        <section className="atlas-panel" aria-labelledby="atlas-title">
          <div className="atlas-intro">
            <h1 id="atlas-title">The Atlas of Us</h1>
            <p>Our memories through time</p>
            <span className="copper-rule" />
          </div>
          <Suspense
            fallback={
              <div className="atlas-scene">
                <p className="scene-loading">Drawing your atlas…</p>
              </div>
            }
          >
            <Atlas
              memories={memories}
              selected={selected.id}
              onSelect={chooseMemory}
              reduced={reduced}
            />
          </Suspense>
        </section>
        <section className="featured" aria-labelledby="featured-title">
          <Photo
            key={selected.photos[0].src}
            photo={selected.photos[0]}
            continuity
            eager
            openMemory={{
              href: `#/memory/${selected.id}`,
              label: `Open ${selected.shortTitle}`,
              onClick: link(`/memory/${selected.id}`, true),
            }}
          />
          <div className="feature-info">
            <div>
              <h2 id="featured-title" aria-live="polite">
                {selected.title}
              </h2>
              <MemoryMeta memory={selected} />
            </div>
            <a
              ref={openLink}
              className="primary-action"
              href={`#/memory/${selected.id}`}
              onClick={link(`/memory/${selected.id}`, true)}
            >
              Open memory <Arrow />
            </a>
          </div>
        </section>
      </div>
      <section className="memories-section" aria-labelledby="demo-title">
        <div className="section-heading">
          <h2 id="demo-title">
            {demo ? "Demo memories" : "Our archive"}{" "}
            <span className="copper-rule" />
          </h2>
          <a href="#/timeline" onClick={link("/timeline")}>
            View all memories <Arrow />
          </a>
        </div>
        <div className="memory-list">
          {memories.map((item) => (
            <button
              key={item.id}
              className="memory-choice"
              aria-label={`Select ${item.shortTitle}`}
              aria-pressed={selected.id === item.id}
              onClick={() => chooseMemory(item.id)}
            >
              <img src={item.photos[0].src} alt="" loading="lazy" />
              <span className="choice-copy">
                <span className="choice-title">{item.shortTitle}</span>
                <span>{item.date}</span>
                <span className="choice-meta">
                  {item.photos.length}{" "}
                  {item.photos.length === 1 ? "photo" : "photos"} ·{" "}
                  {item.source ? "Shared archive" : `Added by ${item.by}`}
                </span>
              </span>
              <span className="selection-ring" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
