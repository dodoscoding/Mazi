const $ = (selector) => document.querySelector(selector);
let group = "";
let generation = 0;
let land;
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
function action(label, handler) {
  const button = node("button", label, { type: "button" });
  button.onclick = () => run(handler);
  return button;
}
async function run(handler) {
  try {
    await handler();
    $("#notice").textContent = "Changes saved.";
  } catch (error) {
    $("#notice").textContent = error.message;
  }
}
function options(select, values, first) {
  const old = select.value;
  select.replaceChildren(
    node("option", first, { value: "" }),
    ...values.map((value) => node("option", value, { value })),
  );
  select.value = values.includes(old) ? old : "";
}
function svg(tag, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, value);
  return element;
}
async function map() {
  const revision = ++generation;
  // Clear stale private results before every reauthorization, including failures.
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
  options($("#country"), result.countries, "All countries");
  options($("#city"), result.cities, "All cities");
  $("#place-count").textContent = result.points.length
    ? `${result.points.length} shared locations`
    : "No shared places here yet. Photographs without a shared location remain in the archive.";
  const canvas = $("#map");
  canvas.setAttribute("viewBox", "0 0 720 360");
  if (!land) land = await (await fetch("/land.geojson")).json();
  if (revision !== generation) return;
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
      canvas.append(svg("path", { d, class: "land" }));
    }
  }
  $("#world-map").onclick = () => canvas.setAttribute("viewBox", "0 0 720 360");
  $("#fit-map").onclick = () => {
    if (!result.points.length) return;
    const xs = result.points.map((p) => (p.longitude + 180) * 2),
      ys = result.points.map((p) => (90 - p.latitude) * 2);
    const width = Math.max(40, Math.max(...xs) - Math.min(...xs) + 24);
    const height = Math.max(30, Math.max(...ys) - Math.min(...ys) + 24);
    canvas.setAttribute(
      "viewBox",
      `${Math.min(...xs) - 12} ${Math.min(...ys) - 12} ${width} ${height}`,
    );
  };
  for (let x = 0; x <= 720; x += 60)
    canvas.append(svg("line", { x1: x, y1: 0, x2: x, y2: 360, class: "grid" }));
  for (let y = 0; y <= 360; y += 60)
    canvas.append(svg("line", { x1: 0, y1: y, x2: 720, y2: y, class: "grid" }));
  const xy = (p) => [(p.longitude + 180) * 2, (90 - p.latitude) * 2];
  for (const [a, b] of result.paths) {
    const left = result.points.find((p) => p.origin === a),
      right = result.points.find((p) => p.origin === b);
    // Avoid drawing an implied journey across the whole map at the date line.
    if (Math.abs(left.longitude - right.longitude) > 180) continue;
    const [x1, y1] = xy(left),
      [x2, y2] = xy(right);
    canvas.append(svg("line", { x1, y1, x2, y2, class: "route" }));
  }
  for (const [index, point] of result.points.entries()) {
    const [cx, cy] = xy(point);
    const dot = svg("circle", { cx, cy, r: 5 });
    const title = svg("title", {});
    title.textContent = `${index + 1}. ${point.city}, ${point.country}`;
    dot.append(title);
    const link = svg("a", {
      href: `/api/archive/${encodeURIComponent(point.asset_id)}/preview`,
      "aria-label": `Open photograph in ${point.city}`,
    });
    link.append(dot);
    canvas.append(link);
    const card = node("article");
    card.append(
      node("h3", `${index + 1}. ${point.city}, ${point.country}`),
      node("p", point.day || "Date not shared"),
      node("p", `${point.latitude}, ${point.longitude}`),
      node("a", "Open photograph", {
        href: `/api/archive/${encodeURIComponent(point.asset_id)}/preview`,
      }),
    );
    $("#places").append(card);
  }
}
async function loadSources() {
  const selectedGroup = group;
  $("#sources").replaceChildren();
  $("#resources").replaceChildren();
  const items = await api("/api/sources?" + new URLSearchParams({ group }));
  if (group !== selectedGroup) return;
  for (const source of items) {
    const card = node("article");
    card.append(
      node("h3", source.label),
      node(
        "p",
        `${source.kind} · ${source.enabled ? "On" : "Paused"} · permission: ${source.permission}`,
      ),
      node("p", `${source.scope.start} – ${source.scope.end}`),
      node("code", source.id),
    );
    if (
      source.kind === "apple" &&
      !["authorized", "limited"].includes(source.permission)
    ) {
      card.append(
        node("p", "Authorize this source in the macOS companion to begin."),
      );
    } else
      card.append(
        action(source.enabled ? "Pause source" : "Enable source", async () => {
          await api("/api/sources/state", {
            id: source.id,
            enabled: !source.enabled,
            permission:
              source.kind === "apple" ? source.permission : "authorized",
          });
          await loadSources();
        }),
      );
    if (source.kind === "apple")
      card.append(
        node(
          "p",
          "Open the macOS companion and paste this source ID. Photos permission is checked on your Mac before transfer.",
        ),
      );
    card.append(
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
          const item = node("article");
          item.append(
            node("h3", resource.metadata.filename),
            node(
              "p",
              `${resource.metadata.component} · ${resource.metadata.version}`,
            ),
            node(
              "p",
              `${stateLabel} · ${resource.received} / ${resource.size} bytes`,
            ),
          );
          if (
            !resource.withdrawn &&
            ["AVAILABLE_TO_GROUP", "RETAINED_NO_PREVIEW"].includes(
              resource.state,
            )
          )
            item.append(
              node("a", "Download original resource", {
                href:
                  "/api/sources/original?" +
                  new URLSearchParams({ id: resource.id }),
                download: resource.metadata.filename,
              }),
            );
          if (!resource.withdrawn)
            item.append(
              action("Withdraw resource", async () => {
                await api("/api/sources/withdraw", { id: resource.id });
                await refresh();
              }),
            );
          $("#resources").append(item);
        }
      }),
    );
    $("#sources").append(card);
  }
}
async function refresh() {
  $("#origins").replaceChildren();
  await map();
  await loadSources();
  const origins = await api(
    "/api/review/my-contributions?" + new URLSearchParams({ group }),
  );
  $("#origins").replaceChildren(
    ...origins.map((origin) =>
      node("option", origin.filename, { value: origin.id }),
    ),
  );
}
$("#filters").onsubmit = (event) => {
  event.preventDefault();
  run(map);
};
$("#country").onchange = () => {
  $("#city").value = "";
  run(map);
};
$("#city").onchange = () => run(map);
$("#paths").onchange = () => run(map);
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
  group = $("#groups").value;
  $("#country").value = "";
  $("#city").value = "";
  run(refresh);
};
(async () => {
  try {
    const groups = await api("/api/groups");
    if (!groups.length)
      throw Error("Create or join a group on the imports page.");
    $("#groups").replaceChildren(
      ...groups.map((g) => node("option", g.name, { value: g.id })),
    );
    group = groups[0].id;
    $("#workspace").hidden = false;
    await refresh();
  } catch (error) {
    $("#signed-out").hidden = false;
    $("#notice").textContent = error.message;
  }
})();
