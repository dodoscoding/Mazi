import { useState } from "react";
import type { RefObject } from "react";
import type { Memory } from "./memories";
import { Photo } from "./Photo";
import type { LinkFor } from "./useRoute";
import { Arrow } from "./ui/icons";
import { MemoryMeta } from "./ui/MemoryMeta";
import "./styles/memory.css";

type Navigate = (url: string, animate?: boolean, replace?: boolean) => void;

export function MemoryView({
  memory,
  photo,
  demo,
  backUrl,
  link,
  navigate,
  heading,
}: {
  memory: Memory;
  photo: number;
  demo: boolean;
  backUrl: string;
  link: LinkFor;
  navigate: Navigate;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const photoIndex = Math.min(Math.floor(photo), memory.photos.length - 1);
  return (
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
        <MemoryMeta memory={memory} />
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
              {memory.photos.map((item, index) => (
                <button
                  key={item.src}
                  aria-label={`Photo ${index + 1}: ${item.caption}`}
                  aria-pressed={photoIndex === index}
                  onClick={() =>
                    navigate(`/memory/${memory.id}?photo=${index}`, false, true)
                  }
                >
                  <img src={item.src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>
        <Context key={memory.id} memory={memory} />
      </div>
    </article>
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
