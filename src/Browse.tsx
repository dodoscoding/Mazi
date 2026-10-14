import type { RefObject } from "react";
import type { Memory } from "./memories";
import type { LinkFor } from "./useRoute";
import { Arrow } from "./ui/icons";
import { MemoryMeta } from "./ui/MemoryMeta";
import "./styles/browse.css";

export function Browse({
  isSearch,
  memories,
  demo,
  query,
  setQuery,
  link,
  heading,
}: {
  isSearch: boolean;
  memories: Memory[];
  demo: boolean;
  query: string;
  setQuery: (query: string) => void;
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const filtered = memories.filter((item) =>
    `${item.title} ${item.date} ${item.by} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
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
              <MemoryMeta memory={item} />
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
}
