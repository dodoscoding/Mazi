import {
  applyFilters,
  dateLabel,
  emptyFilters,
  filterOptions,
  initials,
  plural,
  sharedLine,
  sourceLabel,
  yearsLabel,
} from "../../browse/model";

const closeIcon =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const focusable =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * The Memories photo grid: moments from /api/atlas with a filter rail on wide
 * screens and a Filters sheet below 800px. Filters only use fields the Atlas
 * API returns: year, place, people evidence, source and date certainty.
 */
export function createGallery(root, lifecycle, api) {
  const $ = (id) => root.querySelector(`#${id}`);
  const sheetQuery = matchMedia("(max-width: 800px)");
  let memories = [],
    filters = emptyFilters(),
    view = "moment",
    newest = true,
    run = 0,
    opener = null;

  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  const isOn = (kind, value) =>
    kind === "uncertain"
      ? filters.uncertain
      : filters[kind].has(kind === "years" ? Number(value) : value);
  function toggle(kind, value) {
    if (kind === "uncertain") filters.uncertain = !filters.uncertain;
    else {
      const set = filters[kind];
      const key = kind === "years" ? Number(value) : value;
      if (set.has(key)) set.delete(key);
      else set.add(key);
    }
    update();
  }
  function chip(kind, option, className = "mem-chip") {
    const button = node("button", option.label, className);
    button.type = "button";
    button.dataset.filter = kind;
    button.dataset.value = String(option.value);
    button.setAttribute("aria-pressed", "false");
    button.onclick = () => toggle(kind, option.value);
    return button;
  }
  function check(kind, option) {
    const label = node("label", undefined, "mem-check");
    const input = node("input");
    input.type = "checkbox";
    input.dataset.filter = kind;
    input.dataset.value = option.value;
    input.onchange = () => toggle(kind, option.value);
    label.append(
      input,
      node("span", option.label, "mem-check-label"),
      node("span", String(option.count), "mem-count"),
    );
    return label;
  }
  function fill(fieldset, list, items, empty) {
    $(list).replaceChildren(...items);
    const field = $(fieldset);
    field.disabled = !items.length;
    field.querySelector(".mem-filter-note")?.remove();
    if (!items.length) field.append(node("p", empty, "mem-filter-note"));
  }
  function buildRail() {
    const options = filterOptions(memories);
    $("filter-years").replaceChildren(
      ...options.years.map((option) => chip("years", option)),
    );
    $("year-chips").replaceChildren(
      ...options.years.map((option) => chip("years", option)),
    );
    fill(
      "place-filter",
      "filter-places",
      options.places.map((option) => check("places", option)),
      "No places are recorded for these photographs yet.",
    );
    fill(
      "person-filter",
      "filter-people",
      options.people.map((option) => {
        const button = chip(
          "people",
          { ...option, label: initials(option.label) },
          "mem-person",
        );
        button.setAttribute("aria-label", option.label);
        button.title = option.label;
        return button;
      }),
      "No sharers or chat participants are recorded yet.",
    );
    fill(
      "source-filter",
      "filter-sources",
      options.sources.map((option) => check("sources", option)),
      "No import sources are recorded yet.",
    );
    $("filter-uncertain").disabled = !options.uncertain;
  }
  function sorted(list) {
    return newest ? list : [...list].reverse();
  }
  function photoCount(list) {
    return list.reduce((sum, memory) => sum + memory.photos.length, 0);
  }
  function activeLabels() {
    const labels = [];
    if (filters.years.size)
      labels.push(["years", yearsLabel([...filters.years])]);
    for (const value of filters.places) labels.push(["places", value, value]);
    for (const value of filters.people) labels.push(["people", value, value]);
    for (const value of filters.sources)
      labels.push(["sources", sourceLabel(value), value]);
    if (filters.uncertain) labels.push(["uncertain", "Uncertain dates"]);
    return labels;
  }
  function renderActive() {
    const labels = activeLabels();
    $("active-filters").replaceChildren(
      ...labels.map(([kind, label, value]) => {
        const button = node("button", label, "br-chip mem-active-chip");
        button.type = "button";
        button.setAttribute("aria-label", `Remove filter ${label}`);
        button.insertAdjacentHTML("beforeend", closeIcon);
        button.onclick = () => {
          if (kind === "years") filters.years.clear();
          else if (kind === "uncertain") filters.uncertain = false;
          else filters[kind].delete(value);
          update();
          $("active-filters").querySelector("button")?.focus();
        };
        return button;
      }),
    );
    $("filters-count").textContent = labels.length ? ` · ${labels.length}` : "";
  }
  function tile(memory, photo, index, position) {
    const link = node("a", undefined, "mem-tile");
    link.href = `#/memory/${encodeURIComponent(memory.id)}${index ? `?photo=${index}` : ""}`;
    link.style.setProperty("--i", String(position));
    const image = node("img");
    image.src = photo.src;
    image.alt = photo.alt || memory.title;
    image.loading = "lazy";
    image.decoding = "async";
    link.append(image);
    if (memory.approximate) {
      const badge = node("span", "About", "mem-about");
      badge.setAttribute("aria-hidden", "true");
      link.append(badge);
    }
    return link;
  }
  function emptyState() {
    const box = node("div", undefined, "mem-empty");
    const frames = node("div", undefined, "mem-empty-frames");
    frames.setAttribute("aria-hidden", "true");
    frames.append(node("i"), node("i"), node("i"));
    const link = node("a", "Go to My Imports", "primary-action");
    link.href = "/imports";
    box.append(
      frames,
      node("h2", "No memories yet"),
      node(
        "p",
        "Once someone in the circle imports an export, every photo shows up here, grouped by moment. Imports are shared with everyone in the circle straight away.",
      ),
      link,
    );
    return box;
  }
  function noMatch() {
    const box = node("div", undefined, "mem-empty");
    const reset = node("button", "Reset filters", "br-chip");
    reset.type = "button";
    reset.onclick = () => {
      filters = emptyFilters();
      update();
    };
    box.append(
      node("h2", "No memories match these filters"),
      node(
        "p",
        "Remove a filter above or reset them all to see every photograph again.",
      ),
      reset,
    );
    return box;
  }
  function renderGrid(shown) {
    const grid = $("grid");
    if (!memories.length) return grid.replaceChildren(emptyState());
    if (!shown.length) return grid.replaceChildren(noMatch());
    let position = 0;
    const tiles = (list) => {
      const box = node("div", undefined, "mem-tiles br-grid-stagger");
      for (const memory of list)
        memory.photos.forEach((photo, index) =>
          box.append(tile(memory, photo, index, position++)),
        );
      return box;
    };
    if (view === "all") return grid.replaceChildren(tiles(shown));
    grid.replaceChildren(
      ...shown.map((memory) => {
        const section = node("section", undefined, "mem-moment");
        const head = node("div", undefined, "mem-moment-head");
        const title = node("a", memory.title, "mem-moment-title");
        title.href = `#/memory/${encodeURIComponent(memory.id)}${memory.kind === "memory" ? "?notebook=1" : ""}`;
        const meta = node(
          "span",
          [
            dateLabel(memory),
            plural(memory.photos.length, "photo"),
            sharedLine(memory),
          ]
            .filter(Boolean)
            .join(" · "),
          memory.approximate ? "mem-moment-meta is-about" : "mem-moment-meta",
        );
        const id = `moment-${memories.indexOf(memory)}`;
        title.id = id;
        section.setAttribute("aria-labelledby", id);
        head.append(title, meta);
        if (memory.kind === "memory") {
          const notes = node("a", "View notes", "notes-link");
          notes.href = `#/memory/${encodeURIComponent(memory.id)}?notebook=1`;
          head.append(notes);
        }
        section.append(head, tiles([memory]));
        return section;
      }),
    );
  }
  function update() {
    root.querySelectorAll(".mem-layout [data-filter]").forEach((control) => {
      const on = isOn(control.dataset.filter, control.dataset.value);
      if (control instanceof HTMLInputElement) control.checked = on;
      else control.setAttribute("aria-pressed", String(on));
    });
    $("filter-uncertain").setAttribute(
      "aria-checked",
      String(filters.uncertain),
    );
    const shown = sorted(applyFilters(memories, filters));
    const years = [
      ...new Set(shown.flatMap((memory) => (memory.year ? [memory.year] : []))),
    ];
    $("grid-summary").textContent = memories.length
      ? [
          `${photoCount(shown)} of ${plural(photoCount(memories), "photo")}`,
          plural(shown.length, "moment"),
          yearsLabel(years) || "Undated",
          filters.sources.size
            ? [...filters.sources].map(sourceLabel).join(", ")
            : "all sources",
        ].join(" · ")
      : "";
    $("filters-apply").textContent =
      `Show ${plural(photoCount(shown), "photo")}`;
    renderActive();
    renderGrid(shown);
  }
  function loading() {
    const box = node("div", undefined, "mem-loading");
    box.setAttribute("role", "status");
    box.setAttribute("aria-label", "Loading memories");
    const bar = node("i", undefined, "br-skeleton mem-skeleton-title");
    const tiles = node("div", undefined, "mem-tiles");
    for (let index = 0; index < 12; index++)
      tiles.append(node("i", undefined, "br-skeleton mem-skeleton-tile"));
    box.append(bar, tiles);
    $("grid").replaceChildren(box);
    $("grid-summary").textContent = "";
  }

  function trap(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...$("memory-filters").querySelectorAll(focusable)].filter(
      (item) => item.getClientRects().length,
    );
    if (!items.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  function openSheet() {
    const panel = $("memory-filters");
    opener = document.activeElement;
    panel.classList.remove("is-closing");
    panel.classList.add("is-open");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.addEventListener("keydown", trap);
    $("filters-scrim").hidden = false;
    $("filters-open").setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("mem-sheet-lock");
    panel.querySelector(focusable)?.focus({ preventScroll: true });
  }
  function closeSheet(immediate = false) {
    const panel = $("memory-filters");
    if (!panel.classList.contains("is-open")) return;
    const finish = () => {
      panel.classList.remove("is-open", "is-closing");
      panel.removeAttribute("role");
      panel.removeAttribute("aria-modal");
      $("filters-scrim").hidden = true;
      if (opener instanceof HTMLElement && opener.isConnected && !immediate)
        opener.focus({ preventScroll: true });
    };
    panel.removeEventListener("keydown", trap);
    $("filters-open").setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("mem-sheet-lock");
    if (immediate) return finish();
    panel.classList.add("is-closing");
    $("filters-scrim").classList.add("is-closing");
    lifecycle.setTimeout(() => {
      $("filters-scrim").classList.remove("is-closing");
      finish();
    }, 240);
  }
  const widened = () => {
    if (!sheetQuery.matches) closeSheet(true);
  };
  sheetQuery.addEventListener("change", widened);
  lifecycle.onDispose(() => {
    sheetQuery.removeEventListener("change", widened);
    document.documentElement.classList.remove("mem-sheet-lock");
  });

  $("filters-open").onclick = openSheet;
  $("filters-apply").onclick = () => closeSheet();
  $("filters-scrim").onclick = () => closeSheet();
  $("filters-reset").onclick = () => {
    filters = emptyFilters();
    update();
  };
  $("filter-uncertain").onclick = () => toggle("uncertain");
  $("grid-order").onclick = () => {
    newest = !newest;
    $("grid-order-label").textContent = newest
      ? "Newest first"
      : "Oldest first";
    update();
  };
  root.querySelectorAll("#grid-view button").forEach((button) => {
    button.onclick = () => {
      view = button.dataset.view;
      root
        .querySelectorAll("#grid-view button")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      update();
    };
  });

  async function load(group) {
    const current = ++run;
    memories = [];
    filters = emptyFilters();
    if (!group) return;
    loading();
    try {
      const result = await api("/api/atlas?" + new URLSearchParams({ group }));
      if (current !== run) return;
      memories = result.memories;
    } catch (error) {
      if (current !== run) return;
      const box = node("div", undefined, "mem-empty");
      const retry = node("button", "Try again", "br-chip");
      retry.type = "button";
      retry.onclick = () => load(group);
      box.append(
        node("h2", "Memories could not load"),
        node("p", `${error.message}. Check your connection and try again.`),
        retry,
      );
      $("grid").replaceChildren(box);
      return;
    }
    buildRail();
    update();
  }
  return { load };
}
