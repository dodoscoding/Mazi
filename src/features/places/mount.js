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
  let countRequest = 0;
  let sourceRequest = 0;
  let resourceRequest = 0;
  let originRequest = 0;
  let runRequest = 0;
  let originReady = false;
  let guildRequest = 0;
  let channelRequest = 0;
  const guildNames = new Map();
  const channelNames = new Map();
  const active = () => root.isConnected && !root.hidden;
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
      if (response.status === 401 || response.status === 403) {
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
      throw Object.assign(new Error(value.error || "Request failed"), {
        status: response.status,
        code: value.code,
      });
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
    const request = ++runRequest;
    if (active()) {
      $("#notice").textContent = "";
      $("#notice").dataset.tone = "";
    }
    try {
      const message = await handler();
      if (!saved || request !== runRequest || !active()) return;
      $("#notice").dataset.tone = "success";
      $("#notice").textContent = typeof message === "string" ? message : saved;
    } catch (error) {
      if (request !== runRequest || !active() || error.name === "AbortError")
        return;
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
    $("#places-error").hidden = true;
    $("#map-warning").hidden = true;
    $("#world-map").disabled = $("#fit-map").disabled = true;
    const query = new URLSearchParams({
      group,
      country: $("#country").value,
      city: $("#city").value,
      paths: $("#paths").checked ? "1" : "0",
    });
    let result;
    try {
      result = await api("/api/places?" + query);
    } catch (error) {
      if (revision !== generation || !active() || error.name === "AbortError")
        return;
      $("#place-count").textContent = "Shared places unavailable.";
      $("#jump-places").textContent = "";
      $("#places-error").textContent =
        error.code === "capacity_exceeded"
          ? `${error.message}. The map limit applies before filters. Sources and location controls load separately below; removing a shared location keeps its photograph. Refresh places to retry.`
          : "Shared places could not load. Sources and location controls load separately below. Refresh places to retry.";
      $("#places-error").hidden = false;
      throw error;
    }
    if (revision !== generation || !active()) return;
    $("#places-error").hidden = true;
    $("#world-map").disabled = $("#fit-map").disabled = false;
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
  async function originCounts(request) {
    const selectedGroup = group;
    const current = () =>
      request === countRequest &&
      group === selectedGroup &&
      root.isConnected &&
      !root.hidden;
    const tally = new Map();
    let items = 0;
    let moreItems = false;
    let partialOrigins = false;
    // Bound this overview to 1,020 items, plus one page to detect truncation.
    for (let offset = 0; offset <= 1020;) {
      const page = await api(
        `/api/archive?group=${encodeURIComponent(selectedGroup)}&offset=${offset}`,
      );
      if (!current()) return false;
      if (offset === 1020) {
        moreItems = page.length > 0;
        break;
      }
      for (const item of page) {
        items++;
        partialOrigins ||= item.next_origin_offset != null;
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
    const scope = moreItems
      ? `the first ${items.toLocaleString("en-US")}`
      : partialOrigins
        ? `${items.toLocaleString("en-US")}`
        : `all ${items.toLocaleString("en-US")}`;
    $("#origin-sub").textContent = items
      ? `Sources recorded for ${scope} shared ${items === 1 ? "item" : "items"}. ${partialOrigins ? "Counts use the first 100 source records per item; additional source types may be omitted. " : ""}${moreItems ? "This overview is limited; more shared items are available in the archive. " : ""}An item with two listed sources counts under both.`
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
          `${count} of ${items.toLocaleString("en-US")} ${moreItems || partialOrigins ? "sampled " : ""}shared ${items === 1 ? "item" : "items"}`,
          { class: "fx-small" },
        ),
      );
      list.append(row);
    }
    return true;
  }
  async function loadSources() {
    const request = ++sourceRequest;
    resourceRequest++;
    const selectedGroup = group;
    $("#sources").replaceChildren();
    $("#resources").replaceChildren();
    let items;
    try {
      items = await api("/api/sources?" + new URLSearchParams({ group }));
    } catch (error) {
      if (
        request !== sourceRequest ||
        group !== selectedGroup ||
        !active() ||
        error.name === "AbortError"
      )
        return;
      $("#sources").replaceChildren(
        node("p", "Sources could not load. Refresh places to retry.", {
          role: "status",
          class: "fx-small",
        }),
      );
      throw error;
    }
    if (request !== sourceRequest || group !== selectedGroup || !active())
      return;
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
      );
      if (source.kind === "discord") {
        const { guild, channels } = source.scope;
        const names = channels.map((id) => channelNames.get(id));
        card.append(
          node(
            "p",
            `${guildNames.get(guild) || "Discord server"} · ${
              names.every(Boolean)
                ? names.map((name) => `#${name}`).join(", ")
                : `${channels.length} ${channels.length === 1 ? "channel" : "channels"}`
            }`,
            { class: "fx-small" },
          ),
        );
      }
      card.append(node("code", source.id));
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
          const request = ++resourceRequest;
          $("#resources").replaceChildren();
          const resources = await api(
            "/api/sources/resources?" +
              new URLSearchParams({ connection: source.id }),
          );
          if (
            request !== resourceRequest ||
            group !== selectedGroup ||
            !active()
          )
            return;
          for (const resource of resources) {
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
  function originControls() {
    $("#origins").disabled = !originReady;
    const disabled = !originReady || !$("#origins").value;
    $("#place-form button").disabled = disabled;
    $("#remove-place").disabled = disabled;
  }
  async function loadOrigins() {
    const request = ++originRequest;
    const selectedGroup = group;
    originReady = false;
    originControls();
    $("#origins-status").textContent = "Loading your contributions…";
    try {
      const origins = await api(
        "/api/review/my-contributions?" + new URLSearchParams({ group }),
      );
      if (request !== originRequest || group !== selectedGroup || !active())
        return;
      const selected = $("#origins").value;
      $("#origins").replaceChildren(
        ...origins.map((origin) =>
          node("option", origin.filename, { value: origin.id }),
        ),
      );
      if (selected)
        $("#origins").value = origins.some((origin) => origin.id === selected)
          ? selected
          : "";
      originReady = true;
      originControls();
      $("#origins-status").textContent =
        selected && !$("#origins").value
          ? "The selected contribution is no longer available. Choose another contribution."
          : origins.length
            ? ""
            : "You have no available contributions in this circle.";
    } catch (error) {
      if (
        request !== originRequest ||
        group !== selectedGroup ||
        !active() ||
        error.name === "AbortError"
      )
        return;
      $("#origins-status").textContent =
        "Your contributions could not load. Your draft is still here. Refresh places to retry.";
      throw error;
    }
  }
  async function loadOverview() {
    if (counted === group) return;
    const request = ++countRequest;
    try {
      if (await originCounts(request)) counted = group;
    } catch {
      if (request === countRequest && active()) {
        $("#origin-counts").replaceChildren();
        $("#origin-sub").textContent =
          "Source overview could not load. Refresh places to retry.";
      }
    }
  }
  async function loadGuilds(preferred) {
    const request = ++guildRequest;
    const selectedGroup = group;
    const select = $("#guild");
    const previous = select.value;
    let guilds;
    try {
      guilds = await api(
        "/api/sources/discord/guilds?" + new URLSearchParams({ group }),
      );
    } catch (error) {
      if (request !== guildRequest || !active() || error.name === "AbortError")
        return;
      $("#guild-status").textContent =
        "Connected servers could not load. Refresh places to retry.";
      return;
    }
    if (request !== guildRequest || group !== selectedGroup || !active())
      return;
    for (const guild of guilds) guildNames.set(guild.id, guild.name);
    select.replaceChildren(
      node("option", guilds.length ? "Choose a server" : "No servers yet", {
        value: "",
      }),
      ...guilds.map((guild) => node("option", guild.name, { value: guild.id })),
    );
    select.disabled = !guilds.length;
    const wanted = preferred || previous;
    select.value = guilds.some((guild) => guild.id === wanted) ? wanted : "";
    $("#guild-status").textContent = guilds.length
      ? ""
      : "Connect a Discord server first. It will be listed here for everyone in this circle.";
    if (select.value !== previous || preferred) await loadChannels();
  }
  async function loadChannels() {
    const request = ++channelRequest;
    const guild = $("#guild").value;
    const status = $("#channels-status");
    $("#channel-list").replaceChildren();
    if (!guild) {
      status.textContent = "Choose a server to see its channels.";
      return;
    }
    status.textContent = "Loading channels…";
    let channels;
    try {
      channels = await api(
        "/api/sources/discord/channels?" +
          new URLSearchParams({ group, guild }),
      );
    } catch (error) {
      if (
        request !== channelRequest ||
        !active() ||
        error.name === "AbortError"
      )
        return;
      status.textContent = `Channels could not load: ${error.message}. Choose the server again to retry.`;
      return;
    }
    if (request !== channelRequest || !active()) return;
    for (const channel of channels) channelNames.set(channel.id, channel.name);
    $("#channel-list").replaceChildren(
      ...channels.map((channel) => {
        const label = node("label", undefined, { class: "fx-check" });
        label.append(
          node("input", undefined, {
            type: "checkbox",
            name: "channels",
            value: channel.id,
          }),
          `#${channel.name}`,
        );
        return label;
      }),
    );
    status.textContent = channels.length
      ? "Choose up to 20 channels."
      : "The bot cannot read any text channel here yet. Give it View Channel and Read Message History, then choose the server again.";
  }
  async function refresh() {
    await Promise.allSettled([
      map(),
      loadGuilds().then(loadSources),
      loadOrigins(),
      loadOverview(),
    ]);
  }
  $("#origins").onchange = originControls;
  originControls();
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
    run(refresh, null);
  };
  $("#country").onchange = () => {
    $("#city").value = "";
    run(map, null);
  };
  $("#city").onchange = () => run(map, null);
  $("#paths").onchange = () => run(map, null);
  $("#place-form").onsubmit = (event) => {
    event.preventDefault();
    if (!originReady || !$("#origins").value) return;
    run(async () => {
      const data = Object.fromEntries(new FormData(event.target));
      await api("/api/places", {
        ...data,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        day: data.day || null,
      });
      // The write is complete; map() reports refresh failures in its own panel.
      await Promise.allSettled([map()]);
    });
  };
  $("#remove-place").onclick = () => {
    if (!originReady || !$("#origins").value) return;
    return run(async () => {
      await api("/api/places", {
        origin: $("#origins").value,
        latitude: null,
        longitude: null,
      });
      // The write is complete; map() reports refresh failures in its own panel.
      await Promise.allSettled([map()]);
    });
  };
  $("#kind").onchange = () => {
    $("#apple-fields").hidden = $("#kind").value !== "apple";
    $("#discord-fields").hidden = $("#kind").value !== "discord";
  };
  $("#guild").onchange = () => run(loadChannels, null);
  $("#discord-connect").onclick = () =>
    run(async () => {
      const { url } = await api("/api/sources/discord/connect", { group });
      location.assign(url);
    }, null);
  $("#source-form").onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      const data = Object.fromEntries(new FormData(event.target));
      const split = (value) =>
        value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      const channels = [
        ...root.querySelectorAll("#channel-list input:checked"),
      ].map((input) => input.value);
      if (data.kind === "discord" && !data.guild)
        throw Error("Choose a connected Discord server.");
      if (data.kind === "discord" && !channels.length)
        throw Error("Choose at least one channel.");
      if (data.kind === "discord" && channels.length > 20)
        throw Error(
          `Choose at most 20 channels; ${channels.length} are selected.`,
        );
      const scope = {
        start: data.start,
        end: data.end,
        ...(data.kind === "apple"
          ? { albums: split(data.albums), types: split(data.types) }
          : { guild: data.guild, channels }),
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
  async function loadWorkspace() {
    const restoreFocus = document.activeElement === $("#retry-workspace");
    $("#retry-workspace").disabled = true;
    try {
      const groups = await api("/api/groups");
      if (!active()) return;
      if (!groups.length)
        throw Error("Create or join a group on the imports page.");
      $("#groups").replaceChildren(
        ...groups.map((g) => node("option", g.name, { value: g.id })),
      );
      $(".places-group").classList.toggle("is-single", groups.length < 2);
      group = lifecycle.selectGroup($("#groups"));
      $("#signed-out").hidden = true;
      $("#retry-workspace").hidden = true;
      $("#notice").textContent = "";
      $("#workspace").hidden = false;
      if (restoreFocus) {
        $("h1").tabIndex = -1;
        $("h1").focus();
      }
      void refresh();
    } catch (error) {
      if (!active() || error.name === "AbortError") return;
      const denied = error.status === 401 || error.status === 403;
      $("#signed-out").hidden = !denied;
      $("#retry-workspace").hidden = denied;
      $("#notice").dataset.tone = "error";
      $("#notice").textContent = error.message;
    } finally {
      if (active()) $("#retry-workspace").disabled = false;
    }
  }
  $("#retry-workspace").onclick = loadWorkspace;
  // Discord returns here with code and state, or error when the member cancels.
  const returned =
    lifecycle.discordReturn?.params || new URLSearchParams(location.search);
  const link = returned.get("code") &&
    returned.get("state") && {
      code: returned.get("code"),
      state: returned.get("state"),
    };
  const cancelled = returned.has("error");
  if (link || cancelled)
    window.history.replaceState(
      window.history.state,
      "",
      location.pathname + location.hash,
    );
  loadWorkspace().then(async () => {
    if (!active() || $("#workspace").hidden) return;
    const focusEntry = () => {
      if (lifecycle.mountKind === "refresh" || !active()) return;
      const sources =
        new URLSearchParams(lifecycle.search).get("section") === "sources";
      const target = $(sources ? "#source-title" : "h1");
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      if (sources) {
        root
          .querySelectorAll("[data-jump]")
          .forEach((jump) =>
            jump.setAttribute(
              "aria-current",
              String(jump.dataset.jump === "source-title"),
            ),
          );
        target.scrollIntoView({ block: "start" });
      }
    };
    if (!(link || cancelled)) {
      focusEntry();
      return;
    }
    $("#kind").value = "discord";
    $("#kind").onchange();
    if (cancelled) {
      returned.delete("error");
      $("#notice").dataset.tone = "";
      $("#notice").textContent =
        "Discord connection cancelled. Nothing was changed.";
      focusEntry();
      return;
    }
    await run(async () => {
      let result;
      try {
        result = lifecycle.discordReturn
          ? await lifecycle.discordReturn.finish()
          : await api("/api/sources/discord/link", link);
        if (!active()) throw new DOMException("Feature disposed", "AbortError");
        await loadGuilds(result.guild.id);
        if (!active()) throw new DOMException("Feature disposed", "AbortError");
      } finally {
        if (active()) for (const key of ["code", "state"]) returned.delete(key);
      }
      const { guild } = result;
      return `${guild.name} is connected. Choose its channels to create a source.`;
    });
    focusEntry();
  });
}
