import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useArchive } from "./useArchive";
import { FeaturePage } from "./features";
import type { Memory } from "./memories";
import { Photo } from "./Photo";
import { useReducedMotion, useRoute } from "./useRoute";
const Atlas = lazy(() => import("./Atlas"));
function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={back ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}
function Meta({ memory }: { memory: Memory }) {
  return (
    <p className="memory-meta">
      <span>{memory.date}</span>
      <span>
        {memory.photos.length} {memory.photos.length === 1 ? "photo" : "photos"}
      </span>
      <span>
        {memory.source ? "Shared with your circle" : `Added by ${memory.by}`}
      </span>
    </p>
  );
}
export default function App() {
  const reduced = useReducedMotion();
  const { route, navigate } = useRoute(reduced);
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  const archive = useArchive(route.path, demo);
  const memories = archive.memories;
  const memoryById = (id: string) => memories.find((item) => item.id === id);
  const memoryId = route.path.startsWith("/memory/") ? route.path.slice(8) : "";
  const memory = memoryById(memoryId);
  const selected = memoryById(route.selected) || memories[0];
  const [query, setQuery] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const openLink = useRef<HTMLAnchorElement>(null);
  const previousPath = useRef(route.path);
  const homeScroll = useRef(0);
  const navigateTo = (url: string, animate = false) => {
    if (route.path === "/") homeScroll.current = window.scrollY;
    navigate(url, animate);
  };
  function link(url: string, animate = false) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      navigateTo(url, animate);
    };
  }
  useLayoutEffect(() => {
    const oldPath = previousPath.current;
    previousPath.current = route.path;
    if (route.path === "/" && oldPath.startsWith("/memory/")) {
      window.scrollTo(0, homeScroll.current);
      openLink.current?.focus({ preventScroll: true });
    } else if (route.path !== "/") {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    }
  }, [route.path, memory?.id]);
  const chooseMemory = (id: string) =>
    navigate(`/?selected=${id}`, false, true);
  const navLink = (url: string, label: string) => (
    <a
      href={`#${url}`}
      onClick={link(url)}
      aria-current={route.path === url ? "page" : undefined}
    >
      {label}
    </a>
  );
  const backUrl = `/?selected=${memory?.id || selected?.id || ""}`;
  let content: ReactNode;
  const featurePaths = [
    "/imports",
    "/circle",
    "/review",
    "/places",
    "/discover",
    "/ask",
    "/answer-evidence",
    "/memories",
  ];
  if (featurePaths.includes(route.path) || (route.path === "/search" && !demo))
    content = <FeaturePage key={route.path} path={route.path + route.search} />;
  else if (archive.status !== "ready")
    content = (
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
        ) : (
          archive.status === "signed-out" && (
            <a
              className="primary-action"
              href="#/imports"
              onClick={link("/imports")}
            >
              Sign in or create your circle <Arrow />
            </a>
          )
        )}
        {archive.status === "signed-out" && (
          <a className="sample-link" href="/?demo=1">
            Explore the sample Atlas
          </a>
        )}
      </section>
    );
  else if (route.path === "/" && !selected)
    content = (
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
  else if (route.path === "/" && selected)
    content = (
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
                <Meta memory={selected} />
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
  else if (memory) {
    const photoIndex = Math.min(
      Math.floor(route.photo),
      memory.photos.length - 1,
    );
    content = (
      <article className="detail">
        <a
          className="back-link"
          href={`#${backUrl}`}
          onClick={link(backUrl, true)}
        >
          <Arrow back /> Back to atlas
        </a>
        <header className="detail-heading">
          <h1 ref={heading} tabIndex={-1}>
            {memory.title}
          </h1>
          <Meta memory={memory} />
          {!demo && (
            <div className="memory-tools">
              <a href="#/review" onClick={link("/review")}>
                Review this archive
              </a>
              {memory.kind === "memory" && (
                <a href="#/memories" onClick={link("/memories")}>
                  Write a shared story
                </a>
              )}
            </div>
          )}
        </header>
        <div className="detail-grid">
          <section
            className="gallery"
            aria-label="Memory photographs"
            onKeyDown={(event) => {
              if (
                event.target !== event.currentTarget ||
                !["ArrowLeft", "ArrowRight"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next = Math.max(
                0,
                Math.min(
                  memory.photos.length - 1,
                  photoIndex + (event.key === "ArrowRight" ? 1 : -1),
                ),
              );
              navigate(`/memory/${memory.id}?photo=${next}`, false, true);
            }}
            tabIndex={0}
          >
            <Photo
              key={memory.photos[photoIndex].src}
              photo={memory.photos[photoIndex]}
              continuity
              eager
            />
            <div className="photo-toolbar">
              <p>{memory.photos[photoIndex].caption}</p>
              <div className="photo-controls">
                {memory.photos.length > 1 && (
                  <button
                    aria-label="Previous photo"
                    disabled={photoIndex === 0}
                    onClick={() =>
                      navigate(
                        `/memory/${memory.id}?photo=${photoIndex - 1}`,
                        false,
                        true,
                      )
                    }
                  >
                    <Arrow back />
                  </button>
                )}
                <span aria-live="polite">
                  {photoIndex + 1} / {memory.photos.length}
                </span>
                {memory.photos.length > 1 && (
                  <button
                    aria-label="Next photo"
                    disabled={photoIndex === memory.photos.length - 1}
                    onClick={() =>
                      navigate(
                        `/memory/${memory.id}?photo=${photoIndex + 1}`,
                        false,
                        true,
                      )
                    }
                  >
                    <Arrow />
                  </button>
                )}
              </div>
            </div>
            {memory.photos.length > 1 && (
              <div className="thumbnails" aria-label="Choose a photo">
                {memory.photos.map((photo, index) => (
                  <button
                    key={photo.src}
                    aria-label={`Photo ${index + 1}: ${photo.caption}`}
                    aria-pressed={photoIndex === index}
                    onClick={() =>
                      navigate(
                        `/memory/${memory.id}?photo=${index}`,
                        false,
                        true,
                      )
                    }
                  >
                    <img src={photo.src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </section>
          <Context key={memory.id} memory={memory} />
        </div>
      </article>
    );
  } else if (route.path === "/timeline" || route.path === "/search") {
    const isSearch = route.path === "/search";
    const filtered = memories.filter((item) =>
      `${item.title} ${item.date} ${item.by} ${item.description}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
    );
    content = (
      <section className="browse-page">
        <h1 ref={heading} tabIndex={-1}>
          {isSearch ? "Find a memory" : "Our memories through time"}
        </h1>
        <p className="muted">
          {demo
            ? "Three fictional memories, a few familiar feelings."
            : "Photographs and approved memories from your shared archive."}
        </p>
        {isSearch && (
          <label className="search-field">
            Search demo memories
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="A moment, year or friend…"
            />
          </label>
        )}
        <div className="timeline-list">
          {(isSearch ? filtered : memories).map((item) => (
            <a
              key={item.id}
              href={`#/memory/${item.id}`}
              onClick={link(`/memory/${item.id}`)}
            >
              <span className="timeline-year">{item.year || "Undated"}</span>
              <img src={item.photos[0].src} alt="" />
              <div>
                <h2>{item.title}</h2>
                <Meta memory={item} />
              </div>
              <Arrow />
            </a>
          ))}
        </div>
        {isSearch && filtered.length === 0 && (
          <p role="status">
            No {demo ? "demo memories" : "archive photographs"} match “{query}”.
            Try a year or a different word.
          </p>
        )}
      </section>
    );
  } else
    content = (
      <section className="simple-page">
        <h1 ref={heading} tabIndex={-1}>
          Memory not found
        </h1>
        <p>This memory is unavailable or you no longer have access to it.</p>
        <a className="primary-action" href="#/" onClick={link("/")}>
          Back to atlas <Arrow />
        </a>
      </section>
    );
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a
          className="wordmark"
          href="#/"
          onClick={link("/")}
          aria-label="Mazi home"
        >
          mazi
        </a>
        <nav aria-label="Main navigation">
          {navLink("/", "Home")}
          {navLink("/timeline", "Timeline")}
          {navLink("/search", "Search")}
          <span className="imports-link">
            {navLink("/imports", "My Imports")}
          </span>
        </nav>
        <a className="circle-link" href="#/circle" onClick={link("/circle")}>
          <span className="circle-emblem" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Our circle{" "}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="m3 6 5 5 5-5" />
          </svg>
        </a>
      </header>
      <div
        className="archive-navigation"
        role="region"
        aria-label="Archive navigation"
      >
        <nav aria-label="Archive tools">
          {navLink("/memories", "Memories")}
          {navLink("/review", "Archive review")}
          {navLink("/places", "Places & sources")}
          {navLink("/ask", "Ask your archive")}
        </nav>
        {!demo && archive.groups.length > 0 && (
          <label className="circle-picker">
            Current circle
            <select
              aria-label="Current circle"
              value={archive.group}
              onChange={(event) => archive.chooseGroup(event.target.value)}
            >
              {archive.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {demo && <a href="/">Leave sample Atlas</a>}
      </div>
      <main id="main-content" tabIndex={-1}>
        {content}
      </main>
      <footer>
        <span>
          Mazi <span className="footer-dot" /> The Atlas of Us
        </span>
        <span>
          {demo
            ? "Sample Atlas · Fictional memories & AI-generated photographs"
            : "Your shared archive · Stored on this computer"}
        </span>
        <a
          className="mobile-imports"
          href="#/imports"
          onClick={link("/imports")}
        >
          My Imports
        </a>
      </footer>
    </>
  );
}
function Context({ memory }: { memory: Memory }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <aside className="memory-context" aria-labelledby="context-heading">
      <h2 id="context-heading">A little of the story</h2>
      <p className="memory-description">{memory.description}</p>
      <dl className="source-facts">
        <div>
          <dt>Remembered by</dt>
          <dd>{memory.by}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>
            {memory.date}
            {memory.approximate && <span>Approximate date</span>}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {memory.source || "Synthetic demo archive"}
            <span>
              {memory.source
                ? memory.dateBasis
                : "Story and conversation are fictional"}
            </span>
          </dd>
        </div>
      </dl>
      <section className="conversation">
        <h3>From the conversation</h3>
        {memory.messages.length ? (
          <>
            <p className="conversation-preview">“{memory.messages[0].text}”</p>
            <button
              aria-expanded={expanded}
              aria-controls="conversation-messages"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Hide conversation" : "Show conversation"}
              <span aria-hidden="true">{expanded ? "−" : "+"}</span>
            </button>
            <ol id="conversation-messages" hidden={!expanded}>
              {memory.messages.map((message, index) => (
                <li key={index}>
                  <div>
                    <strong>{message.name}</strong>
                    <time>{message.time}</time>
                  </div>
                  <p>{message.text}</p>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="muted">No conversation attached.</p>
        )}
      </section>
    </aside>
  );
}
