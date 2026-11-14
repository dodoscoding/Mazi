import { createPhotoFilters } from "../photoFilters";
import { labelBadges } from "../../memory/labels";
import {
  dateLabel,
  emptyFilters,
  initials,
  plural,
  sharedLine,
  sourceLabel,
  yearsLabel,
} from "../../browse/model";
import { photoDateLabel, photoPlaceLabel } from "../../memory/evidence";
import { placeLine } from "../../memory/facts";

const closeIcon =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const focusable =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * The Memories photo grid: moments from /api/atlas with a filter rail on wide
 * screens and a Filters sheet below 800px. Filters only use fields the Atlas
 * API returns: year, place, people evidence, source and date certainty.
 */
export function createGallery(
  root,
  lifecycle,
  api,
  { photos = false, onSearch, onReset } = {},
) {
  const $ = (id) => root.querySelector(`#${id}`);
  const sheetQuery = matchMedia("(max-width: 800px)");
  let memories = [],
    filters = emptyFilters(),
    view = "moment",
    newest = true,
    run = 0,
    opener = null;
  let matched = new Set(),
    matching = false,
    matchRun = 0,
    facets = null;
  const searchText =
    lifecycle.search ??
    (location.hash.includes("?")
      ? location.hash.split("?").slice(1).join("?")
      : location.search);
  const entry = new URLSearchParams(searchText);
  let undated = photos && entry.get("undated") === "1";
  const photoQuery = $("photos-query");
  if (photoQuery) {
    photoQuery.value = entry.get("q") || "";
    $("photos-search").onsubmit = (event) => {
      event.preventDefault();
      void refreshMatches();
    };
    $("photos-clear-query").onclick = () => {
      photoQuery.value = "";
      photoQuery.focus();
      void refreshMatches();
    };
    if (entry.get("search") === "1") photoQuery.focus({ preventScroll: true });
  }
  const invalidFilters = new Map();
  for (const [key, parameter] of [
    ["years", "years"],
    ["places", "places"],
    ["sources", "source"],
    ["people", "by"],
  ]) {
    const raw = entry.get(parameter) || "";
    let values;
    try {
      values = raw.startsWith("[")
        ? JSON.parse(raw)
        : key === "people"
          ? raw
            ? [raw]
            : []
          : raw.split(",").filter(Boolean);
      if (
        !Array.isArray(values) ||
        values.some((value) => typeof value !== "string")
      )
        throw Error();
    } catch {
      invalidFilters.set(key, raw);
      values = [raw];
    }
    filters[key] = new Set(key === "years" ? values.map(Number) : values);
  }
  filters.uncertain = entry.get("uncertain") === "true";
  view = entry.get("view") === "all" ? "all" : "moment";
  newest = entry.get("order") !== "oldest";
  const photoFilters = createPhotoFilters(
    $("memory-filters"),
    searchText,
    () => void refreshMatches(),
  );
  const searchForm = document.createElement("form");
  searchForm.className = "photo-date-filters";
  for (const [key, text, type] of [
    ...(!photos ? [["q", "Sözcük", "search"]] : []),
    ["from", "Başlangıç", "date"],
    ["through", "Bitiş", "date"],
  ]) {
    const label = document.createElement("label"),
      input = document.createElement("input");
    label.textContent = text;
    input.type = type;
    input.name = key;
    input.value = entry.get(key) || "";
    label.append(input);
    searchForm.append(label);
  }
  const basisLabel = document.createElement("label"),
    basis = document.createElement("select");
  basisLabel.textContent = "Tarih türü";
  basis.name = "date_basis";
  for (const [value, text] of [
    ["chronology", "Gösterilen tarih"],
    ["capture", "Çekim tarihi"],
    ["shared", "Paylaşım tarihi"],
    ["", "Çekim tarihi (eski bağlantı)"],
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    basis.append(option);
  }
  basis.value =
    entry.get("date_basis") ||
    (entry.has("from") || entry.has("through") ? "" : "chronology");
  basisLabel.append(basis);
  searchForm.append(basisLabel);
  const applyDates = document.createElement("button");
  applyDates.textContent = "Filtrele";
  searchForm.append(applyDates);
  searchForm.onsubmit = (event) => {
    event.preventDefault();
    void refreshMatches();
  };
  $("memory-filters").append(
    searchForm,
    $("memory-filters").querySelector(".mem-sheet-foot"),
  );
  function parameters() {
    const params = new URLSearchParams();
    photoFilters.apply(params);
    if (photoQuery?.value) params.set("q", photoQuery.value);
    for (const [key, parameter] of [
      ["years", "years"],
      ["places", "places"],
      ["sources", "source"],
      ["people", "by"],
    ])
      if (filters[key].size)
        params.set(
          parameter,
          invalidFilters.has(key) && filters[key].has(invalidFilters.get(key))
            ? invalidFilters.get(key)
            : key === "years" || key === "sources"
              ? [...filters[key]].join(",")
              : JSON.stringify([...filters[key]]),
        );
    if (filters.uncertain) params.set("uncertain", "true");
    for (const input of searchForm.querySelectorAll("input,select"))
      if (input.value) params.set(input.name, input.value);
    return params;
  }
  function remember() {
    const params = parameters();
    if (!params.get("from") && !params.get("through"))
      params.delete("date_basis");
    if (undated) params.set("undated", "1");
    if (!photos && view === "all") params.set("view", view);
    if (!photos && !newest) params.set("order", "oldest");
    if (entry.get("section")) params.set("section", entry.get("section"));
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      (photos ? "#/photos" : "#/memories") + (query ? "?" + query : ""),
    );
  }
  async function refreshMatches() {
    if (!galleryGroup) return;
    const generation = ++matchRun,
      current = run;
    closeEditor();
    matching = true;
    matched.clear();
    loading();
    $("grid-summary").textContent = "Eşleşmeler aranıyor…";
    $("filters-apply").textContent = "Eşleşmeler aranıyor…";
    update();
    const params = parameters();
    params.set("group", galleryGroup);
    if (params.has("q")) {
      params.set("query", params.get("q"));
      params.delete("q");
    }
    for (const [from, to] of [
      ["by", "shared_by"],
      ["from", "start"],
      ["through", "end"],
    ])
      if (params.has(from)) {
        params.set(to, params.get(from));
        params.delete(from);
      }
    if (photos) onSearch?.(new URLSearchParams(params), galleryGroup);
    try {
      const result = await api("/api/discovery/matches?" + params);
      if (generation !== matchRun || current !== run) return;
      matching = false;
      matched = new Set(result.asset_ids);
      facets = result;
      photoFilters.update(result.photo_facets);
      buildRail();
      remember();
      update();
    } catch (error) {
      if (generation === matchRun && current === run) {
        matching = false;
        matched.clear();
        facets = null;
        photoFilters.update({});
        $("grid-summary").textContent = "Eşleşmeler yüklenemedi.";
        $("filters-apply").textContent = "Filtreleri uygula";
        const retry = node("button", "Yeniden dene", "br-chip");
        retry.type = "button";
        retry.onclick = () => void refreshMatches();
        $("grid").replaceChildren(
          node(
            "p",
            error.code === "capacity_exceeded"
              ? "İşleme sınırı aşıldı. Kısmi sonuç gösterilmez; filtreleri gözden geçirin."
              : "Filtreler yüklenemedi. Seçiminiz korundu; yeniden deneyin.",
          ),
          retry,
        );
      }
    }
  }

  let galleryGroup = "",
    selecting = false,
    selection = new Set(),
    editorGeneration = 0,
    disposeEditor;
  const tools = document.createElement("section");
  tools.className = "mem-label-tools";
  tools.setAttribute("aria-label", "Fotoğraf araçları");
  const choose = document.createElement("button");
  choose.textContent = "Fotoğraf seç";
  choose.type = "button";
  const count = document.createElement("span");
  const edit = document.createElement("button");
  edit.textContent = "Seçili etiketleri düzenle";
  edit.type = "button";
  const cancel = document.createElement("button");
  cancel.textContent = "Seçimi temizle";
  cancel.type = "button";
  const editor = document.createElement("div");
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "Fotoğrafları yenile";
  refresh.onclick = () => void load(galleryGroup);
  tools.append(refresh, choose, count, edit, cancel, editor);
  $("grid").before(tools);
  function closeEditor() {
    editorGeneration++;
    disposeEditor?.();
    disposeEditor = undefined;
    editor.replaceChildren();
  }
  function selectionState() {
    count.textContent = `${selection.size} fotoğraf seçildi · En fazla 50`;
    count.hidden = photos && !selecting;
    edit.disabled = !selection.size;
    edit.hidden = cancel.hidden = !selecting;
    choose.setAttribute("aria-pressed", String(selecting));
    root.querySelectorAll(".mem-photo-select input").forEach((input) => {
      input.checked = selection.has(input.value);
      input.disabled = !input.checked && selection.size === 50;
    });
  }
  choose.onclick = () => {
    selecting = !selecting;
    if (!selecting) selection.clear();
    closeEditor();
    selectionState();
    update();
  };
  cancel.onclick = () => {
    selection.clear();
    closeEditor();
    selectionState();
  };
  edit.onclick = async () => {
    const current = run,
      generation = ++editorGeneration,
      assets = [...selection];
    const { mountLabelEditor } = await import("../../memory/labelEditor");
    if (current !== run || generation !== editorGeneration || !assets.length)
      return;
    disposeEditor?.();
    disposeEditor = mountLabelEditor(editor, {
      group: galleryGroup,
      assets,
      fetch: lifecycle.fetch,
      onClose: closeEditor,
      onSaved: () => {
        void load(galleryGroup);
        window.dispatchEvent(new Event("mazi:archive-changed"));
      },
    });
    editor.scrollIntoView({ block: "nearest" });
  };
  selectionState();
  lifecycle.onDispose(() => {
    run++;
    closeEditor();
    selection.clear();
  });

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
    void refreshMatches();
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
    if (!facets) return;
    const options = {
      years: (facets.photo_facets.years || []).map((item) => ({
        ...item,
        value: Number(item.value),
        label: item.value,
      })),
      places: (facets.photo_facets.places || []).map((item) => ({
        ...item,
        label: item.value,
      })),
      people: (facets.facets.shared_by || []).map((item) => ({
        ...item,
        label: item.value,
      })),
      sources: (facets.facets.sources || []).map((item) => ({
        ...item,
        label: sourceLabel(item.value),
      })),
      uncertain: true,
    };
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
      "Bu fotoğraflarda yer kaydı yok.",
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
      "Paylaşan bilgisi yok.",
    );
    fill(
      "source-filter",
      "filter-sources",
      options.sources.map((option) => check("sources", option)),
      "Kaynak kaydı yok.",
    );
    $("filter-uncertain").disabled = !options.uncertain;
  }
  function sorted(list) {
    return newest ? list : [...list].reverse();
  }
  function activeLabels() {
    const labels = [];
    if (filters.years.size)
      labels.push(["years", yearsLabel([...filters.years])]);
    for (const value of filters.places) labels.push(["places", value, value]);
    for (const value of filters.people) labels.push(["people", value, value]);
    for (const value of filters.sources)
      labels.push(["sources", sourceLabel(value), value]);
    if (filters.uncertain) labels.push(["uncertain", "Belirsiz tarihler"]);
    return labels;
  }
  function renderActive() {
    const labels = activeLabels();
    if (undated) labels.push(["undated", "Undated"]);
    $("active-filters").replaceChildren(
      ...labels.map(([kind, label, value]) => {
        const button = node("button", label, "br-chip mem-active-chip");
        button.type = "button";
        button.setAttribute("aria-label", `Filtreyi kaldır: ${label}`);
        button.insertAdjacentHTML("beforeend", closeIcon);
        button.onclick = () => {
          if (kind === "undated") {
            undated = false;
            yearPicker.value = "";
          } else if (kind === "years") {
            filters.years.clear();
            if (yearPicker) yearPicker.value = "";
          } else if (kind === "uncertain") filters.uncertain = false;
          else filters[kind].delete(value);
          void refreshMatches();
          $("active-filters").querySelector("button")?.focus();
        };
        return button;
      }),
    );
    const count = labels.length + photoFilters.count();
    $("filters-count").textContent = count ? ` · ${count}` : "";
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
    const facts = node("span", undefined, "mem-photo-facts");
    facts.append(
      node("span", photoDateLabel(photo, memory)),
      node("span", photoPlaceLabel(photo, memory)),
    );
    facts.append(
      ...labelBadges(photo.labels).map((text) =>
        node("span", text, "photo-label-badge"),
      ),
    );
    link.append(facts);
    if (!photo.evidence && memory.approximate) {
      const badge = node("span", "Yaklaşık", "mem-about");
      badge.setAttribute("aria-hidden", "true");
      link.append(badge);
    }
    if (!selecting || !photo.assetId) return link;
    const cell = node("div", undefined, "mem-photo-cell");
    const label = node("label", undefined, "mem-photo-select");
    const checkbox = node("input");
    checkbox.type = "checkbox";
    checkbox.value = photo.assetId;
    checkbox.checked = selection.has(photo.assetId);
    checkbox.disabled = !checkbox.checked && selection.size === 50;
    checkbox.onchange = () => {
      if (checkbox.checked && selection.size < 50) selection.add(photo.assetId);
      else selection.delete(photo.assetId);
      closeEditor();
      selectionState();
    };
    label.append(
      checkbox,
      document.createTextNode(`Fotoğraf seç: ${photo.caption || memory.title}`),
    );
    cell.append(label, link);
    return cell;
  }
  function emptyState() {
    const box = node("div", undefined, "mem-empty");
    const frames = node("div", undefined, "mem-empty-frames");
    frames.setAttribute("aria-hidden", "true");
    frames.append(node("i"), node("i"), node("i"));
    const link = node(
      "a",
      photos ? "Fotoğraf ekle" : "İçe aktarımlarım",
      "primary-action",
    );
    link.href = photos ? "#/add" : "/imports";
    box.append(
      frames,
      node("h2", "Henüz fotoğraf yok"),
      node("p", "Grubunuza eklenen fotoğraflar burada görünür."),
      link,
    );
    return box;
  }
  function noMatch() {
    const box = node("div", undefined, "mem-empty");
    const reset = node("button", "Filtreleri temizle", "br-chip");
    reset.type = "button";
    reset.onclick = resetFilters;
    box.append(
      node("h2", "Bu filtrelerle eşleşen fotoğraf yok"),
      node("p", "Bir filtreyi kaldırın veya hepsini temizleyin."),
      reset,
    );
    return box;
  }
  function period(photo) {
    const date = photo.evidence?.chronology;
    return date?.start &&
      !["conflict", "ambiguous", "unknown"].includes(date.status) &&
      date.start.slice(0, 7) === date.through?.slice(0, 7)
      ? date.start.slice(0, 7)
      : null;
  }
  function photographRows(list) {
    const seen = new Set();
    return list.flatMap((memory) =>
      memory.photos.flatMap((photo, index) => {
        const id = photo.assetId || photo.src;
        if (seen.has(id) || !matched.has(photo.assetId)) return [];
        seen.add(id);
        return [{ memory, photo, index, month: period(photo) }];
      }),
    );
  }
  function renderMonths(shown) {
    const rows = photographRows(shown).filter((row) => !undated || !row.month);
    rows.sort(
      (a, b) =>
        (b.photo.evidence?.chronology.start || "").localeCompare(
          a.photo.evidence?.chronology.start || "",
        ) || a.photo.assetId.localeCompare(b.photo.assetId),
    );
    const months = new Map();
    for (const row of rows) {
      const key = row.month || "undated";
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(row);
    }
    const sections = [...months]
      .sort(([a], [b]) =>
        a === "undated" ? 1 : b === "undated" ? -1 : b.localeCompare(a),
      )
      .map(([month, items]) => {
        const section = node("section", undefined, "photo-month");
        const label =
          month === "undated"
            ? "Undated"
            : new Intl.DateTimeFormat("tr-TR", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${month}-01T00:00:00Z`));
        section.setAttribute("aria-label", label);
        section.append(node("h2", label));
        if (month === "undated")
          section.append(
            node(
              "p",
              "Tarihi bilinmeyen veya ayı güvenle belirlenemeyen fotoğraflar.",
            ),
          );
        const tiles = node("div", undefined, "mem-tiles");
        items.forEach((row, index) =>
          tiles.append(tile(row.memory, row.photo, row.index, index)),
        );
        section.append(tiles);
        return section;
      });
    $("grid").replaceChildren(...(sections.length ? sections : [noMatch()]));
  }
  const yearPicker = $("photos-year");
  if (yearPicker)
    yearPicker.onchange = () => {
      filters.years.clear();
      undated = yearPicker.value === "undated";
      if (yearPicker.value && !undated)
        filters.years.add(Number(yearPicker.value));
      void refreshMatches();
    };
  function yearOptions() {
    if (!yearPicker) return;
    const years = [
      ...new Set(
        memories.flatMap((memory) =>
          memory.photos
            .map(period)
            .filter(Boolean)
            .map((month) => month.slice(0, 4)),
        ),
      ),
    ]
      .sort()
      .reverse();
    yearPicker.replaceChildren(
      ...[
        ["", "Tüm yıllar"],
        ...years.map((year) => [year, year]),
        ["undated", "Undated"],
      ].map(([value, label]) => {
        const option = node("option", label);
        option.value = value;
        return option;
      }),
    );
    yearPicker.value = undated ? "undated" : [...filters.years].join(",");
  }
  function renderGrid(shown) {
    const grid = $("grid");
    if (!memories.length) return grid.replaceChildren(emptyState());
    if (!shown.length) return grid.replaceChildren(noMatch());
    if (photos) return renderMonths(shown);
    let position = 0;
    const tiles = (list) => {
      const box = node("div", undefined, "mem-tiles br-grid-stagger");
      for (const memory of list)
        memory.photos.forEach(
          (photo, index) =>
            matched.has(photo.assetId) &&
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
            placeLine(memory),
            `${memory.photos.filter((photo) => matched.has(photo.assetId)).length} eşleşen / ${memory.photos.length} fotoğraf`,
            sharedLine(memory)
              .replace(/^Shared by /, "Paylaşan: ")
              .replace(/^Added by /, "Ekleyen: "),
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
          const notes = node("a", "Notları aç", "notes-link");
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
    root
      .querySelectorAll("#grid-view button")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.view === view),
        ),
      );
    if ($("grid-order-label"))
      $("grid-order-label").textContent = newest
        ? "Önce en yeni"
        : "Önce en eski";
    renderActive();
    if (matching || !facets) {
      remember();
      return;
    }
    const shown = sorted(
      memories.filter((memory) =>
        memory.photos.some((photo) => matched.has(photo.assetId)),
      ),
    );
    const total =
      photos && undated
        ? photographRows(shown).filter((row) => !row.month).length
        : facets?.total || 0;
    $("grid-summary").textContent =
      `${total} eşleşen fotoğraf · ${facets?.photo_facets?.denominator || 0} görünür fotoğraf`;
    $("filters-apply").textContent = `${total} fotoğrafı göster`;
    remember();
    renderGrid(shown);
  }
  function loading() {
    const box = node("div", undefined, "mem-loading");
    box.setAttribute("role", "status");
    box.setAttribute("aria-label", "Fotoğraflar yükleniyor");
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
  function resetFilters() {
    filters = emptyFilters();
    undated = false;
    if (yearPicker) yearPicker.value = "";
    photoFilters.reset(false);
    for (const input of searchForm.querySelectorAll("input")) input.value = "";
    basis.value = "chronology";
    void refreshMatches();
  }
  $("filters-reset").onclick = resetFilters;
  $("filter-uncertain").onclick = () => toggle("uncertain");
  if ($("grid-order"))
    $("grid-order").onclick = () => {
      newest = !newest;
      $("grid-order-label").textContent = newest
        ? "Önce en yeni"
        : "Önce en eski";
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
    onReset?.();
    if (galleryGroup && galleryGroup !== group) {
      filters = emptyFilters();
      photoFilters.reset(false);
      for (const input of searchForm.querySelectorAll("input"))
        input.value = "";
      basis.value = "chronology";
    }
    galleryGroup = group;
    closeEditor();
    selection.clear();
    selecting = false;
    selectionState();
    memories = [];
    matched.clear();
    facets = null;
    if (!group) return;
    loading();
    try {
      const result = await api("/api/atlas?" + new URLSearchParams({ group }));
      if (current !== run) return;
      memories = result.memories;
      yearOptions();
    } catch (error) {
      if (current !== run) return;
      const box = node("div", undefined, "mem-empty");
      const retry = node("button", "Yeniden dene", "br-chip");
      retry.type = "button";
      retry.onclick = () => load(group);
      box.append(
        node("h2", "Fotoğraflar yüklenemedi"),
        node(
          "p",
          `${error.message}. Bağlantınızı kontrol edip yeniden deneyin.`,
        ),
        retry,
      );
      $("grid").replaceChildren(box);
      return;
    }
    await refreshMatches();
  }
  return { load };
}
