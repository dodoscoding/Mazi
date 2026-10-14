import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import type { Memory } from "../memories";
import { Icon } from "../ui/icons";
import type { LinkFor } from "../useRoute";
import {
  countryName,
  dateLabel,
  initials,
  personLine,
  plural,
  searchArchive,
  sourceLabel,
  sourcesOf,
  suggestions,
} from "./model";
import type { Snippet } from "./model";

type ResultType = "all" | "memories" | "places" | "people" | "chats";
const stagger = (index: number) => ({ "--i": index }) as CSSProperties;

function Excerpt({ snippet }: { snippet: Snippet }) {
  return (
    <>
      {snippet.label} · {snippet.pre}
      {snippet.hit && <mark>{snippet.hit}</mark>}
      {snippet.post}
    </>
  );
}

/** Search across the loaded memories: titles, stories, places, names and chats. */
export function DemoSearch({
  memories,
  demo,
  query,
  setQuery,
  link,
  heading,
}: {
  memories: Memory[];
  demo: boolean;
  query: string;
  setQuery: (query: string) => void;
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const [settled, setSettled] = useState(query);
  const [type, setType] = useState<ResultType>("all");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(query);
      setType("all");
    }, 160);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useMemo(
    () => searchArchive(memories, settled),
    [memories, settled],
  );
  const searching = results.query !== "";
  const show = (key: ResultType) => type === "all" || type === key;
  const types: [ResultType, string, number][] = [
    ["all", "All", results.total],
    ["memories", "Memories", results.memories.length],
    ["places", "Places", results.places.length],
    ["people", "People", results.people.length],
    ["chats", "Chats", results.chats.length],
  ];
  const memoryHref = (memory: Memory) => `/memory/${memory.id}`;
  return (
    <section className="search-page">
      <h1 ref={heading} tabIndex={-1} className="visually-hidden">
        Search
      </h1>
      <div className="search-bar" role="search">
        <Icon name="search" size={22} />
        <label htmlFor="archive-query" className="visually-hidden">
          Search the archive
        </label>
        <input
          id="archive-query"
          ref={input}
          type="search"
          value={query}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="A moment, place, year or friend"
          onChange={(event) => setQuery(event.target.value)}
        />
        {searching && (
          <span className="search-count">
            {plural(results.total, "result")}
          </span>
        )}
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {searching && (
        <div className="result-types" role="group" aria-label="Result types">
          {types.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={type === key}
              onClick={() => setType(key)}
            >
              {label} <span className="data">{count}</span>
            </button>
          ))}
        </div>
      )}
      {searching && results.total === 0 ? (
        <div className="search-none">
          <h2>Nothing for “{settled.trim()}”</h2>
          <p role="status">
            No {demo ? "demo memories" : "memories"} match “{settled.trim()}”.
            Search looks at titles, stories, places, names and chats, not inside
            photos.
          </p>
          {suggestions(memories).length > 0 && (
            <>
              <span className="hud-label">Try</span>
              <div className="search-try">
                {suggestions(memories).map((word) => (
                  <button
                    key={word}
                    type="button"
                    className="br-chip"
                    onClick={() => setQuery(word)}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="search-results" key={settled}>
          <div className="search-main">
            {show("memories") && results.memories.length > 0 && (
              <section aria-labelledby="result-memories">
                <h2 id="result-memories" className="hud-label">
                  Memories · {results.memories.length}
                </h2>
                <div className="br-stagger">
                  {results.memories.map(({ memory, snippet }, index) => (
                    <a
                      key={memory.id}
                      className="result-memory"
                      href={`#${memoryHref(memory)}`}
                      onClick={link(memoryHref(memory))}
                      style={stagger(index)}
                    >
                      <span
                        className={`result-mosaic count-${Math.min(3, memory.photos.length)}`}
                      >
                        {memory.photos.slice(0, 3).map((photo) => (
                          <img key={photo.src} src={photo.src} alt="" />
                        ))}
                      </span>
                      <span className="result-text">
                        <span
                          className={`result-date${memory.approximate ? " is-about" : ""}`}
                        >
                          {[dateLabel(memory), memory.place?.name]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="result-title">{memory.title}</span>
                        <span className="result-snippet">
                          {snippet ? (
                            <Excerpt snippet={snippet} />
                          ) : (
                            memory.description
                          )}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}
            {show("chats") && results.chats.length > 0 && (
              <section aria-labelledby="result-chats">
                <h2 id="result-chats" className="hud-label">
                  Chat snippets · {results.chats.length}
                </h2>
                <div className="br-stagger">
                  {results.chats.map(({ memory, message, snippet }, index) => (
                    <a
                      key={`${memory.id}-${message.time}-${index}`}
                      className="result-chat"
                      href={`#${memoryHref(memory)}`}
                      onClick={link(memoryHref(memory))}
                      style={stagger(index)}
                    >
                      <span className="br-avatar" aria-hidden="true">
                        {initials(message.name)}
                      </span>
                      <span className="result-text">
                        <span className="result-who">
                          <b>{message.name}</b> · {message.time} · in{" "}
                          {memory.shortTitle}
                        </span>
                        <span className="result-quote">
                          “{snippet.pre}
                          <mark>{snippet.hit}</mark>
                          {snippet.post}”
                        </span>
                      </span>
                      <span className="br-source">
                        {sourcesOf(memory).map(sourceLabel).join(", ") ||
                          "Chat"}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
          {searching && (
            <div className="search-side">
              {show("places") && results.places.length > 0 && (
                <section aria-labelledby="result-places">
                  <h2 id="result-places" className="hud-label">
                    Places · {results.places.length}
                  </h2>
                  <div className="br-stagger">
                    {results.places.map(({ place, memories: found }, index) => (
                      <a
                        key={place.name + place.country}
                        className="result-place"
                        href={`#/?selected=${found[0].id}`}
                        onClick={link(`/?selected=${found[0].id}`)}
                        style={stagger(index)}
                      >
                        {found[0].photos[0] && (
                          <img src={found[0].photos[0].src} alt="" />
                        )}
                        <span className="result-text">
                          <span className="result-title">{place.name}</span>
                          <span className="result-who">
                            {countryName(place.country)} ·{" "}
                            {plural(found.length, "memory", "memories")}
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              )}
              {show("people") && results.people.length > 0 && (
                <section aria-labelledby="result-people">
                  <h2 id="result-people" className="hud-label">
                    People · {results.people.length}
                  </h2>
                  <ul className="br-stagger result-people">
                    {results.people.map((person, index) => (
                      <li key={person.name} style={stagger(index)}>
                        <span className="br-avatar" aria-hidden="true">
                          {initials(person.name)}
                        </span>
                        <span className="result-text">
                          <b>{person.name}</b>
                          <span className="result-who">
                            {personLine(person)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
