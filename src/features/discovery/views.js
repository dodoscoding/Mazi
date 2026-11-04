import {
  countryName,
  dateLabel,
  firstDate,
  initials,
  monthYear,
  personLine,
  placeLabel,
  plural,
  rediscover,
  searchArchive,
  sharedLine,
  sharersOf,
  sourceLabel,
  sourcesOf,
  suggestions,
  yearsSince,
} from "../../browse/model";

export function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
const memoryHref = (memory, photo = 0) =>
  `#/memory/${encodeURIComponent(memory.id)}${photo ? `?photo=${photo}` : ""}`;
function image(src, alt = "") {
  const img = node("img");
  img.src = src;
  img.alt = alt;
  img.loading = "lazy";
  img.decoding = "async";
  return img;
}
function stagger(el, index) {
  el.style.setProperty("--i", String(index));
  return el;
}
function excerpt(target, snippet) {
  target.append(`${snippet.label} · ${snippet.pre}`);
  if (snippet.hit) target.append(node("mark", snippet.hit));
  target.append(snippet.post);
  return target;
}
function quote(target, snippet) {
  target.append(
    `“${snippet.pre}`,
    node("mark", snippet.hit),
    `${snippet.post}”`,
  );
  return target;
}

export function skeletonRows(count = 4) {
  return Array.from({ length: count }, () => {
    const row = node("div", undefined, "disc-skeleton-row");
    const lines = node("span", undefined, "disc-skeleton-lines");
    lines.append(
      node("i", undefined, "br-skeleton"),
      node("i", undefined, "br-skeleton"),
      node("i", undefined, "br-skeleton"),
    );
    row.append(node("i", undefined, "br-skeleton disc-skeleton-thumb"), lines);
    return row;
  });
}

const noFacets = { sources: [], shared_by: [] };

/** Source chips and Shared by choices, offered only from the server's authorized facets. */
export function renderFilters(root, facets = noFacets, filters) {
  const $ = (id) => root.querySelector(`#${id}`);
  const selectedSources = new Set(filters.source.split(",").filter(Boolean));
  let selectedNames;
  try {
    selectedNames = new Set(
      filters.sharedBy.startsWith("[")
        ? JSON.parse(filters.sharedBy)
        : filters.sharedBy
          ? [filters.sharedBy]
          : [],
    );
  } catch {
    selectedNames = new Set();
  }
  const sources = [
    ...new Set([
      ...facets.sources.map((option) => option.value),
      ...selectedSources,
    ]),
  ];
  const names = [
    ...new Set([
      ...facets.shared_by.map((option) => option.value),
      ...selectedNames,
    ]),
  ];
  $("source-filter").replaceChildren(
    ...[["", "Tümü"], ...sources.map((code) => [code, sourceLabel(code)])].map(
      ([code, label]) => {
        const button = node("button", label);
        button.type = "button";
        button.dataset.source = code;
        button.setAttribute(
          "aria-pressed",
          String(code ? selectedSources.has(code) : !selectedSources.size),
        );
        return button;
      },
    ),
  );
  const select = $("shared-by");
  select.replaceChildren(
    ...[["", "Herkes"], ...names.map((name) => [name, name])].map(
      ([value, label]) => {
        const option = node("option", label);
        option.value = value;
        return option;
      },
    ),
  );
  select.multiple = true;
  select.size = Math.min(5, names.length + 1);
  for (const option of select.options)
    option.selected = selectedNames.has(option.value);
  $("search-filters").hidden = !sources.length && !names.length;
}

export function sharedByLine(item) {
  return [
    item.shared_by?.length ? `Paylaşan: ${item.shared_by.join(", ")}` : "",
    (item.sources || []).map(sourceLabel).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Client-side groups for memories, chats, places and people from /api/atlas. */
export function renderGroups(root, atlas, query, people, filters) {
  const $ = (id) => root.querySelector(`#${id}`);
  const filtered = filters.source || filters.sharedBy;
  const results = searchArchive(
    atlas.filter(
      (memory) =>
        (!filters.source || sourcesOf(memory).includes(filters.source)) &&
        (!filters.sharedBy || sharersOf(memory).includes(filters.sharedBy)),
    ),
    query,
  );
  const term = results.query;
  const memories = term ? results.memories : [];
  $("memory-list").replaceChildren(
    ...memories.map(({ memory, snippet }, index) => {
      const link = stagger(node("a", undefined, "result-memory"), index);
      link.href = memoryHref(memory);
      const mosaic = node(
        "span",
        undefined,
        `result-mosaic count-${Math.min(3, memory.photos.length)}`,
      );
      mosaic.append(
        ...memory.photos.slice(0, 3).map((photo) => image(photo.src)),
      );
      const text = node("span", undefined, "result-text");
      text.append(
        node(
          "span",
          [dateLabel(memory), memory.place?.name].filter(Boolean).join(" · "),
          memory.approximate ? "result-date is-about" : "result-date",
        ),
        node("span", memory.title, "result-title"),
        snippet
          ? excerpt(node("span", undefined, "result-snippet"), snippet)
          : node("span", memory.description, "result-snippet"),
      );
      link.append(mosaic, text);
      return link;
    }),
  );
  $("chat-list").replaceChildren(
    ...results.chats.map(({ memory, message, snippet }, index) => {
      const link = stagger(node("a", undefined, "result-chat"), index);
      link.href = memoryHref(memory);
      const avatar = node("span", initials(message.name), "br-avatar");
      avatar.setAttribute("aria-hidden", "true");
      const who = node("span", undefined, "result-who");
      who.append(
        node("b", message.name),
        ` · ${message.time} · in ${memory.shortTitle}`,
      );
      const text = node("span", undefined, "result-text");
      text.append(who, quote(node("span", undefined, "result-quote"), snippet));
      link.append(
        avatar,
        text,
        node(
          "span",
          sourcesOf(memory).map(sourceLabel).join(", ") || "Chat",
          "br-source",
        ),
      );
      return link;
    }),
  );
  $("place-list").replaceChildren(
    ...results.places.map(({ place, memories: found }, index) => {
      const link = stagger(node("a", undefined, "result-place"), index);
      link.href = `#/?selected=${encodeURIComponent(found[0].id)}`;
      if (found[0].photos[0]) link.append(image(found[0].photos[0].src));
      const text = node("span", undefined, "result-text");
      text.append(
        node("span", place.name, "result-title"),
        node(
          "span",
          `${countryName(place.country)} · ${plural(found.length, "memory", "memories")}`,
          "result-who",
        ),
      );
      link.append(text);
      return link;
    }),
  );
  // Person records from discovery join the evidence names from the archive.
  const byName = new Map(
    results.people.map((person) => [person.name, personLine(person)]),
  );
  if (term && !filtered)
    for (const person of people)
      if (person.name.toLowerCase().includes(term)) {
        const line = `${plural(person.count, "photo")}${person.memories.length ? ` · in ${person.memories.map((m) => m.title || "Untitled").join(", ")}` : ""}`;
        byName.set(
          person.name,
          [byName.get(person.name), line].filter(Boolean).join(" · "),
        );
      }
  $("people-list").replaceChildren(
    ...[...byName.entries()].map(([name, line], index) => {
      const item = stagger(node("li"), index);
      const avatar = node("span", initials(name), "br-avatar");
      avatar.setAttribute("aria-hidden", "true");
      const text = node("span", undefined, "result-text");
      text.append(node("b", name), node("span", line, "result-who"));
      item.append(avatar, text);
      return item;
    }),
  );
  $("memory-results-heading").textContent = `Memories · ${memories.length}`;
  $("chat-results-heading").textContent =
    `Chat snippets · ${results.chats.length}`;
  $("place-results-heading").textContent = `Places · ${results.places.length}`;
  $("people-results-heading").textContent = `People · ${byName.size}`;
  return {
    term,
    memories: memories.length,
    chats: results.chats.length,
    places: results.places.length,
    people: byName.size,
  };
}

export { suggestions };

function heroCard(hero) {
  const { memory, kicker } = hero;
  const card = node("article", undefined, "disc-hero");
  const photo = memory.photos[0];
  card.append(image(photo.src, photo.alt || memory.title));
  card.append(node("span", undefined, "disc-hero-shade"));
  const text = node("div", undefined, "disc-hero-text");
  const actions = node("div", undefined, "disc-hero-actions");
  const open = node("a", "Open memory", "primary-action");
  open.href = memoryHref(memory);
  actions.append(open);
  if (memory.place) {
    const fly = node("a", "Fly there on the globe", "disc-hero-ghost");
    fly.href = `#/?selected=${encodeURIComponent(memory.id)}`;
    actions.append(fly);
  }
  text.append(
    node("span", kicker, "disc-kicker"),
    node("h2", memory.title, "disc-hero-title"),
    node(
      "span",
      [
        placeLabel(memory.place),
        dateLabel(memory),
        plural(memory.photos.length, "photo"),
        sharedLine(memory),
      ]
        .filter(Boolean)
        .join(" · "),
      "disc-hero-meta",
    ),
    actions,
  );
  card.append(text);
  return card;
}

/** Rediscovery prompts for /discover, built from the archive's own dates and places. */
export function renderPrompts(root, atlas, heroIndex) {
  const $ = (id) => root.querySelector(`#${id}`);
  const prompts = rediscover(atlas);
  const today = new Date();
  const box = $("prompts");
  $("shuffle").hidden = prompts.heroes.length < 2;
  if (!prompts.heroes.length) {
    $("discover-sub").textContent =
      "Prompts appear once there is something to look back on.";
    const empty = node("div", undefined, "disc-empty");
    const frames = node("div", undefined, "disc-empty-frames");
    frames.setAttribute("aria-hidden", "true");
    frames.append(node("i"), node("i"), node("i"));
    const link = node("a", "Add an export", "primary-action");
    link.href = "/imports";
    empty.append(
      frames,
      node("h2", "Nothing to rediscover yet"),
      node(
        "p",
        "Discover needs at least a year of memories to find anniversaries and places you haven’t been back to. It fills in as the circle imports more.",
      ),
      link,
    );
    box.replaceChildren(empty);
    return prompts;
  }
  $("discover-sub").textContent =
    `Picked from the archive for ${today.toLocaleDateString(navigator.language, { weekday: "long", day: "numeric", month: "long" })}. New prompts every morning.`;
  const blocks = [heroCard(prompts.heroes[heroIndex % prompts.heroes.length])];
  const lower = node("div", undefined, "disc-lower");
  if (prompts.places.length) {
    const section = node("section", undefined, "disc-places");
    section.setAttribute("aria-labelledby", "not-back-heading");
    const head = node("div", undefined, "disc-section-head");
    const title = node("h2", "Places you haven’t been back to");
    title.id = "not-back-heading";
    const all = node("a", "All places");
    all.href = "/places";
    head.append(title, all);
    const grid = node("div", undefined, "disc-place-grid");
    grid.append(
      ...prompts.places.map(({ place, last, lastDate, count }) => {
        const link = node("a", undefined, "disc-place");
        link.href = `#/?selected=${encodeURIComponent(last.id)}`;
        link.append(
          image(last.photos[0].src),
          node("span", place.name, "disc-place-name"),
          node(
            "span",
            `Last time ${monthYear(lastDate)} · ${plural(count, "memory", "memories")}`,
            "disc-place-meta",
          ),
        );
        return link;
      }),
    );
    section.append(head, grid);
    lower.append(section);
    lower.classList.add("has-places");
  }
  const side = node("div", undefined, "disc-side");
  if (prompts.year) {
    const { year, photos, memories, places } = prompts.year;
    const section = node("section", undefined, "disc-card disc-year");
    section.setAttribute("aria-labelledby", "year-photos-heading");
    const head = node("div", undefined, "disc-card-head");
    const label = node(
      "h2",
      `A year in ${photos.length === 5 ? "five photos" : plural(photos.length, "photo")}`,
      "disc-card-label",
    );
    label.id = "year-photos-heading";
    head.append(label, node("span", String(year), "disc-card-year"));
    const strip = node("div", undefined, "disc-year-strip");
    strip.append(
      ...photos.map(({ memory, photo, index }) => {
        const link = node("a");
        link.href = memoryHref(memory, index);
        link.append(image(photo.src, photo.alt || memory.title));
        return link;
      }),
    );
    section.append(
      head,
      strip,
      node(
        "p",
        [plural(memories, "memory", "memories"), places.join(", ")]
          .filter(Boolean)
          .join(" · "),
        "disc-card-note",
      ),
    );
    side.append(section);
  }
  if (prompts.uncertain) {
    const section = node("section", undefined, "disc-card disc-settle");
    section.setAttribute("aria-label", "Dates to settle");
    const text = node("span", undefined, "disc-settle-text");
    text.append(
      node(
        "b",
        `${prompts.uncertain === 1 ? "memory has" : "memories have"} “about” dates`,
      ),
      node("span", "If you remember when, settle them in Archive review."),
    );
    const review = node("a", "Review", "disc-pill");
    review.href = "/review";
    section.append(
      node("span", String(prompts.uncertain), "disc-settle-count"),
      text,
      review,
    );
    side.append(section);
  }
  const first = prompts.first;
  if (
    first &&
    first !== prompts.heroes[heroIndex % prompts.heroes.length].memory
  ) {
    const link = node("a", undefined, "disc-card disc-first");
    link.href = memoryHref(first);
    const text = node("span", undefined, "disc-first-text");
    const date = firstDate(first) || today;
    text.append(
      node("span", "Where it started", "disc-card-label"),
      node("span", first.title, "disc-first-title"),
      node(
        "span",
        [first.place?.name, dateLabel(first), yearsSince(date, today)]
          .filter(Boolean)
          .join(" · "),
        "disc-place-meta",
      ),
    );
    link.append(image(first.photos[0].src), text);
    side.append(link);
  }
  if (side.childElementCount) lower.append(side);
  if (lower.childElementCount) blocks.push(lower);
  box.replaceChildren(...blocks.map((block, index) => stagger(block, index)));
  return prompts;
}

export function promptSkeleton(root) {
  const box = root.querySelector("#prompts");
  const hero = node("div", undefined, "disc-hero-skeleton");
  hero.setAttribute("role", "status");
  hero.setAttribute("aria-label", "Loading prompts");
  hero.append(node("i", undefined, "br-skeleton"));
  box.replaceChildren(hero);
}
