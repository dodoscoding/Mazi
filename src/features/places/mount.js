import {
  el,
  formatDay,
  icon,
  reducedMotion,
  sourceIcons,
  sourceNames,
  toastNotice,
} from "../ui.js";

const regionNames = (() => {
  try {
    return new Intl.DisplayNames([navigator.language], { type: "region" });
  } catch {
    return null;
  }
})();
function countryName(code) {
  try {
    return regionNames?.of(String(code).toUpperCase()) || code;
  } catch {
    return code;
  }
}
function sourceKey(type) {
  const value = String(type || "").toLowerCase();
  if (value.startsWith("apple")) return "apple";
  return value;
}

export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  const $ = (selector) => root.querySelector(selector);
  let group = "";
  let generation = 0;
  let land;
  let counted = "";
  toastNotice($("#notice"), lifecycle);
  async function api(path, body) {
    const response = await fetch(
      path,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {},
    );
    const value = await response.json();
    if (!response.ok) {
      if (response.status === 403) {
        generation++;
        for (const id of [
          "#places",
          "#map",
          "#sources",
          "#resources",
          "#origins",
          "#country",
          "#city",
          "#origin-counts",
        ])
          $(id).replaceChildren();
        $("#place-count").textContent =
          "Access unavailable. Sign in again to refresh your archive.";
      }
      throw Error(value.error || "Request failed");
    }
    return value;
  }
  function node(tag, text, attributes = {}) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value);
    return element;
  }
  function action(label, handler, className = "fx-button fx-button--quiet") {
    const button = node("button", label, { type: "button", class: className });
    button.onclick = () => run(handler);
    return button;
  }
  async function run(handler, saved = "Changes saved.") {
    try {
      await handler();
      if (!saved) return;
      $("#notice").dataset.tone = "success";
      $("#notice").textContent = saved;
    } catch (error) {
      $("#notice").dataset.tone = "error";
      $("#notice").textContent = error.message;
    }
  }
  function options(select, values, first, label = (value) => value) {
    const old = select.value;
    select.replaceChildren(
      node("option", first, { value: "" }),
      ...values.map((value) => node("option", label(value), { value })),
    );
    select.value = values.includes(old) ? old : "";
  }
  function svg(tag, attributes) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value);
    return element;
  }
  function setView(canvas, x, y, width, height) {
    canvas.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    // Node radius and labels are in map units; keep them a constant on-screen size.
    canvas.style.setProperty("--k", String(width / 720));
  }
  async function decorateMap(canvas, revision) {
    const current = () =>
      revision === generation && root.isConnected && !root.hidden;
    try {
      if (!land) {
        const response = await fetch("/land.geojson");
        if (!response.ok) throw Error("Map outlines unavailable");
        const data = await response.json();
        if (!current()) return;
        if (!Array.isArray(data?.features)) throw Error("Invalid map outlines");
        land = data;
      }
      if (!current()) return;
      const landLayer = svg("g", { "aria-hidden": "true" });
      for (const feature of land.features) {
        const polygons =
          feature.geometry.type === "Polygon"
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates;
        for (const polygon of polygons) {
          const d = polygon
            .map(
              (ring) =>
                ring
                  .map(
                    ([lon, lat], i) =>
                      `${i ? "L" : "M"}${(lon + 180) * 2},${(90 - lat) * 2}`,
                  )
                  .join(" ") + "Z",
            )
            .join(" ");
          landLayer.append(svg("path", { d, class: "land" }));
        }
      }
      canvas.insertBefore(landLayer, canvas.children[1] || null);
      $("#map-warning").hidden = true;
    } catch (error) {
      if (!current() || error.name === "AbortError") return;
      land = null;
      $("#map-warning").textContent =
        "Map outlines could not load. Shared places and sources still work. Refresh places to retry.";
      $("#map-warning").hidden = false;
    }
  }
  async function map() {
    const revision = ++generation;
    $("#places").replaceChildren();
    $("#map").replaceChildren();
    $("#place-count").textContent = "Loading places…";
    const query = new URLSearchParams({
      group,
      country: $("#country").value,
      city: $("#city").value,
      paths: $("#paths").checked ? "1" : "0",
    });
    const result = await api("/api/places?" + query);
    if (revision !== generation) return;
    options($("#country"), result.countries, "All countries", (code) =>
      code ? `${countryName(code)}` : code,
    );
    options($("#city"), result.cities, "All cities");
    const cities = new Set(result.points.map((p) => `${p.city}|${p.country}`));
    const countries = new Set(result.points.map((p) => p.country));
    $("#place-count").textContent = result.points.length
      ? `${result.points.length} shared locations · ${cities.size} ${cities.size === 1 ? "place" : "places"} in ${countries.size} ${countries.size === 1 ? "country" : "countries"}`
      : "No shared places here yet. Photographs without a shared location remain in the archive.";
    $("#jump-places").textContent = `· ${cities.size}`;
    const canvas = $("#map");
    setView(canvas, 0, 0, 720, 360);
    const graticule = svg("g", { class: "graticule", "aria-hidden": "true" });
    for (let x = 0; x <= 720; x += 60)
      graticule.append(
        svg("line", { x1: x, y1: 0, x2: x, y2: 360, class: "grid" }),
      );
    for (let y = 0; y <= 360; y += 60)
      graticule.append(
        svg("line", { x1: 0, y1: y, x2: 720, y2: y, class: "grid" }),
      );
    canvas.append(graticule);

    $("#world-map").onclick = () => setView(canvas, 0, 0, 720, 360);
    $("#fit-map").onclick = () => {
      if (!result.points.length) return;
      const xs = result.points.map((p) => (p.longitude + 180) * 2),
        ys = result.points.map((p) => (90 - p.latitude) * 2);
      const width = Math.max(40, Math.max(...xs) - Math.min(...xs) + 24);
      const height = Math.max(30, Math.max(...ys) - Math.min(...ys) + 24);
      setView(
        canvas,
        Math.min(...xs) - 12,
        Math.min(...ys) - 12,
        width,
        height,
      );
    };
    const xy = (p) => [(p.longitude + 180) * 2, (90 - p.latitude) * 2];
    for (const [a, b] of result.paths) {
      const left = result.points.find((p) => p.origin === a),
        right = result.points.find((p) => p.origin === b);
      if (Math.abs(left.longitude - right.longitude) > 180) continue;
      const [x1, y1] = xy(left),
        [x2, y2] = xy(right);
      canvas.append(svg("line", { x1, y1, x2, y2, class: "route" }));
    }
    const perPlace = new Map();
    for (const point of result.points) {
      const key = `${point.city}|${point.country}`;
      perPlace.set(key, (perPlace.get(key) || 0) + 1);
    }
    const labelled = new Set();
    for (const [index, point] of result.points.entries()) {
      const [cx, cy] = xy(point);
      const key = `${point.city}|${point.country}`;
      const weight = Math.min(3, Math.sqrt(perPlace.get(key)));
      const dot = svg("circle", {
        cx,
        cy,
        class: "node",
        style: `--w: ${weight.toFixed(2)}`,
      });
      const title = svg("title", {});
      title.textContent = `${index + 1}. ${point.city}, ${point.country}`;
      dot.append(title);
      const link = svg("a", {
        href: `/api/archive/${encodeURIComponent(point.asset_id)}/preview`,
        "aria-label": `Open photograph in ${point.city}`,
      });
      link.append(dot);
      canvas.append(link);
      if (!labelled.has(key)) {
        labelled.add(key);
        const label = svg("text", {
          x: cx,
          y: cy,
          class: "node-label",
          "aria-hidden": "true",
        });
        label.textContent = `${point.city.toUpperCase()} ${perPlace.get(key)}`;
        canvas.append(label);
      }
      const card = node("article", undefined, { class: "place-row" });
      card.style.setProperty("--i", String(Math.min(index, 8)));
      const name = node("h3");
      name.append(
        `${index + 1}. ${point.city}, ${point.country}`,
        node("span", ` ${countryName(point.country)}`, {
          class: "place-country",
          "aria-hidden": "true",
        }),
      );
      card.append(
        name,
        node("p", point.day ? formatDay(point.day) : "Date not shared", {
          class: "place-day",
        }),
        node("p", `${point.latitude}, ${point.longitude}`, {
          class: "place-coords",
        }),
        node("a", "Open photograph", {
          href: `/api/archive/${encodeURIComponent(point.asset_id)}/preview`,
          class: "fx-text-link",
        }),
      );
      $("#places").append(card);
    }
    if (!result.points.length)
      $("#places").append(
        node("p", "Shared locations will be listed here.", {
          class: "fx-empty",
        }),
      );
    void decorateMap(canvas, revision);
  }
  async function originCounts() {
    const selectedGroup = group;
    const tally = new Map();
    let items = 0;
    // The archive pages 30 items at a time; the local prototype caps groups at 1,000.
    for (let offset = 0; offset < 1020;) {
      const page = await api(
        `/api/archive?group=${encodeURIComponent(group)}&offset=${offset}`,
      );
      if (group !== selectedGroup) return;
      for (const item of page) {
        items++;
        const kinds = new Set(
          item.origins.map((o) => sourceKey(o.source_type)),
        );
        for (const kind of kinds) tally.set(kind, (tally.get(kind) || 0) + 1);
      }
      if (page.length < 30) break;
      offset += page.length;
    }
    const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    $("#jump-sources").textContent = `· ${rows.length}`;
    $("#origin-sub").textContent = items
      ? `Where all ${items} shared ${items === 1 ? "item" : "items"} came from. An item shared from two sources counts under both.`
      : "Nothing has been shared yet. Items appear here as imports finish.";
    const list = $("#origin-counts");
    list.replaceChildren();
    const max = Math.max(1, ...rows.map(([, count]) => count));
    for (const [kind, count] of rows) {
      const row = node("div", undefined, { class: "origin-row" });
      const head = node("p", undefined, { class: "origin-head" });
      head.append(
        icon(sourceIcons[kind] || "zip", 18),
        node("b", sourceNames[kind] || kind.replaceAll("_", " ")),
        node("span", count.toLocaleString(), { class: "origin-count" }),
      );
      const bar = node("span", undefined, {
        class: "origin-bar",
        "aria-hidden": "true",
      });
      bar.style.setProperty("--share", `${(count * 100) / max}%`);
      row.append(
        head,
        bar,
        node(
          "p",
          `${count} of ${items} shared ${items === 1 ? "item" : "items"}`,
          { class: "fx-small" },
        ),
      );
      list.append(row);
    }
  }
  async function loadSources() {
    const selectedGroup = group;
    $("#sources").replaceChildren();
    $("#resources").replaceChildren();
    const items = await api("/api/sources?" + new URLSearchParams({ group }));
    if (group !== selectedGroup) return;
    for (const source of items) {
      const card = node("article", undefined, { class: "connection" });
      const head = node("div", undefined, { class: "connection-head" });
      const badge = node("span", undefined, { class: "source-badge" });
      badge.append(icon(source.kind === "apple" ? "photo" : "discord", 18));
      head.append(
        badge,
        node("h4", source.label),
        node("span", source.enabled ? "On" : "Paused", {
          class: `connection-state ${source.enabled ? "is-on" : ""}`,
        }),
      );
      card.append(
        head,
        node(
          "p",
          `${source.kind} · ${source.enabled ? "On" : "Paused"} · permission: ${source.permission}`,
          { class: "fx-small" },
        ),
        node("p", `${source.scope.start} – ${source.scope.end}`, {
          class: "fx-small",
        }),
        node("code", source.id),
      );
      const actions = node("div", undefined, { class: "fx-actions" });
      if (
        source.kind === "apple" &&
        !["authorized", "limited"].includes(source.permission)
      ) {
        card.append(
          node("p", "Authorize this source in the macOS companion to begin.", {
            class: "fx-small",
          }),
        );
      } else
        actions.append(
          action(
            source.enabled ? "Pause source" : "Enable source",
            async () => {
              await api("/api/sources/state", {
                id: source.id,
                enabled: !source.enabled,
                permission:
                  source.kind === "apple" ? source.permission : "authorized",
              });
              await loadSources();
            },
          ),
        );
      if (source.kind === "apple")
        card.append(
          node(
            "p",
            "Open the macOS companion and paste this source ID. Photos permission is checked on your Mac before transfer.",
            { class: "fx-small" },
          ),
        );
      actions.append(
        action("View transfers", async () => {
          $("#resources").replaceChildren();
          for (const resource of await api(
            "/api/sources/resources?" +
              new URLSearchParams({ connection: source.id }),
          )) {
            const labels = {
              AVAILABLE_TO_GROUP: "Shared with group",
              RETAINED_NO_PREVIEW: "Original retained · preview unavailable",
              UPLOADING: "Transfer in progress",
              QUEUED: "Preparing preview",
              CANCELLED: "Paused · resume from companion",
              FAILED: "Could not prepare preview",
              UNSUPPORTED: "Preview format unsupported",
            };
            const stateLabel =
              !source.enabled && resource.state === "UPLOADING"
                ? "Paused · resume from companion"
                : labels[resource.state] ||
                  resource.state.toLowerCase().replaceAll("_", " ");
            const item = node("article", undefined, { class: "resource" });
            item.append(
              node("h4", resource.metadata.filename),
              node(
                "p",
                `${resource.metadata.component} · ${resource.metadata.version}`,
                { class: "fx-small" },
              ),
              node(
                "p",
                `${stateLabel} · ${resource.received} / ${resource.size} bytes`,
                { class: "fx-small" },
              ),
            );
            const links = node("div", undefined, { class: "fx-actions" });
            if (
              !resource.withdrawn &&
              ["AVAILABLE_TO_GROUP", "RETAINED_NO_PREVIEW"].includes(
                resource.state,
              )
            )
              links.append(
                node("a", "Download original resource", {
                  href:
                    "/api/sources/original?" +
                    new URLSearchParams({ id: resource.id }),
                  download: resource.metadata.filename,
                  class: "fx-text-link",
                }),
              );
            if (!resource.withdrawn)
              links.append(
                action(
                  "Withdraw resource",
                  async () => {
                    await api("/api/sources/withdraw", { id: resource.id });
                    counted = "";
                    await refresh();
                  },
                  "fx-button fx-button--danger-quiet",
                ),
              );
            item.append(links);
            $("#resources").append(item);
          }
        }),
      );
      card.append(actions);
      $("#sources").append(card);
    }
    if (!items.length)
      $("#sources").append(
        node("p", "No connections yet.", { class: "fx-empty" }),
      );
  }
  async function refresh() {
    $("#origins").replaceChildren();
    await map();
    await loadSources();
    // Counting pages through the whole archive, so it runs once per circle
    // and again only after a withdrawal changes what is shared.
    if (counted !== group)
      try {
        await originCounts();
        counted = group;
      } catch {
        $("#origin-counts").replaceChildren();
      }
    const origins = await api(
      "/api/review/my-contributions?" + new URLSearchParams({ group }),
    );
    $("#origins").replaceChildren(
      ...origins.map((origin) =>
        node("option", origin.filename, { value: origin.id }),
      ),
    );
  }
  root.querySelectorAll("[data-jump]").forEach((jump) =>
    jump.addEventListener("click", () => {
      root
        .querySelectorAll("[data-jump]")
        .forEach((other) =>
          other.setAttribute("aria-current", String(other === jump)),
        );
      const target = $(`#${jump.dataset.jump}`);
      target.tabIndex = -1;
      target.scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    }),
  );
  $("#filters").onsubmit = (event) => {
    event.preventDefault();
    run(map, null);
  };
  $("#country").onchange = () => {
    $("#city").value = "";
    run(map, null);
  };
  $("#city").onchange = () => run(map, null);
  $("#paths").onchange = () => run(map, null);
  $("#place-form").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      const data = Object.fromEntries(new FormData(event.target));
      await api("/api/places", {
        ...data,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        day: data.day || null,
      });
      await map();
    });
  };
  $("#remove-place").onclick = () =>
    run(async () => {
      await api("/api/places", {
        origin: $("#origins").value,
        latitude: null,
        longitude: null,
      });
      await map();
    });
  $("#kind").onchange = () => {
    $("#apple-fields").hidden = $("#kind").value !== "apple";
    $("#discord-fields").hidden = $("#kind").value !== "discord";
  };
  $("#source-form").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      const data = Object.fromEntries(new FormData(event.target));
      const split = (value) =>
        value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      const scope = {
        start: data.start,
        end: data.end,
        ...(data.kind === "apple"
          ? { albums: split(data.albums), types: split(data.types) }
          : { guild: data.guild.trim(), channels: split(data.channels) }),
      };
      await api("/api/sources/create", {
        group,
        kind: data.kind,
        label: data.label,
        scope,
      });
      await loadSources();
    });
  };
  $("#groups").onchange = () => {
    group = lifecycle.selectGroup($("#groups"));
    $("#country").value = "";
    $("#city").value = "";
    run(refresh, null);
  };
  (async () => {
    try {
      const groups = await api("/api/groups");
      if (!groups.length)
        throw Error("Create or join a group on the imports page.");
      $("#groups").replaceChildren(
        ...groups.map((g) => node("option", g.name, { value: g.id })),
      );
      $(".places-group").classList.toggle("is-single", groups.length < 2);
      group = lifecycle.selectGroup($("#groups"));
      $("#workspace").hidden = false;
      await refresh();
    } catch (error) {
      $("#signed-out").hidden = false;
      $("#notice").dataset.tone = "error";
      $("#notice").textContent = error.message;
    }
  })();
}
