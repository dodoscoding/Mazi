const $ = (id) => document.getElementById(id);
let group = null;
let offset = 0;
let query = "";
let groupRoles = new Map();

async function api(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
function notice(message) {
  $("notice").textContent = message;
}
async function act(work) {
  try {
    await work();
  } catch (error) {
    notice(error.message);
  }
}
function element(tag, value = "") {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
function button(label, work) {
  const node = element("button", label);
  node.type = "button";
  node.addEventListener("click", () => act(work));
  return node;
}
function image(asset) {
  const node = document.createElement("img");
  node.src = `/api/review/rendition/${encodeURIComponent(asset)}`;
  node.alt = "Archive photograph";
  node.loading = "lazy";
  return node;
}
function empty(container, message) {
  if (!container.children.length) container.append(element("p", message));
}
function params(extra = "") {
  return `group=${encodeURIComponent(group)}${extra}`;
}

async function refresh() {
  let groups;
  try {
    groups = await api("/api/groups");
  } catch {
    $("signed-out").hidden = false;
    $("workspace").hidden = true;
    return;
  }
  $("signed-out").hidden = true;
  $("workspace").hidden = false;
  $("groups").replaceChildren();
  groupRoles = new Map(groups.map((item) => [item.id, item.role]));
  for (const item of groups) {
    const option = element("option", item.name);
    option.value = item.id;
    $("groups").append(option);
  }
  group = groups.find((item) => item.id === group)?.id || groups[0]?.id || null;
  $("groups").value = group || "";
  if (group) await refreshGroup();
}
async function refreshGroup() {
  offset = 0;
  query = $("query").value;
  $("leave-group").hidden = groupRoles.get(group) !== "member";
  $("export").href = `/api/review/export?${params()}`;
  await Promise.all([timeline(), duplicates(), events(), today(), mine()]);
}
async function timeline(more = false) {
  if (!more) {
    offset = 0;
    $("timeline").replaceChildren();
  }
  const page = await api(
    `/api/review/timeline?${params(`&offset=${offset}&q=${encodeURIComponent(query)}`)}`,
  );
  $("count").textContent = `${page.total} photographs`;
  for (const item of page.items) {
    const card = document.createElement("article");
    card.append(
      image(item.id),
      element("h3", item.title || "Untitled photograph"),
      element(
        "p",
        `${item.date || "Date unknown"} · ${item.place || "Place unknown"} · ${item.origin_count} source records`,
      ),
    );
    const original = element("a", "Download original");
    original.href = `/api/archive/${encodeURIComponent(item.id)}/original`;
    original.download = item.id;
    card.append(original);
    const form = document.createElement("form");
    const title = document.createElement("input");
    title.name = "title";
    title.maxLength = 200;
    title.value = item.title;
    const date = document.createElement("input");
    date.name = "capture_date";
    date.type = "date";
    date.value = item.date || "";
    const place = document.createElement("input");
    place.name = "place";
    place.maxLength = 200;
    place.value = item.place || "";
    const anniversary = document.createElement("input");
    anniversary.name = "anniversary";
    anniversary.type = "checkbox";
    anniversary.checked = item.anniversary;
    for (const [label, input] of [
      ["Title", title],
      ["Capture date", date],
      ["Place", place],
      ["Approved for On this day", anniversary],
    ]) {
      const wrapper = document.createElement("label");
      wrapper.append(element("span", label + " "), input);
      form.append(wrapper);
    }
    const save = element("button", "Save correction");
    save.type = "submit";
    form.append(save);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      act(async () => {
        await api("/api/review/correct", {
          asset: item.id,
          title: title.value,
          capture_date: date.value || null,
          place: place.value,
          anniversary: anniversary.checked,
        });
        notice("Correction saved for the group.");
        await refreshGroup();
      });
    });
    card.append(form);
    $("timeline").append(card);
  }
  offset = page.next_offset ?? 0;
  $("more").hidden = page.next_offset === null;
  empty($("timeline"), "No photographs match this search.");
}
async function duplicates() {
  const [pairs, reviewed] = await Promise.all([
    api(`/api/review/duplicates?${params()}`),
    api(`/api/review/reviewed-pairs?${params()}`),
  ]);
  $("duplicates").replaceChildren();
  $("reviewed-pairs").replaceChildren();
  for (const pair of pairs) {
    const card = document.createElement("article");
    const side = document.createElement("div");
    side.className = "pair";
    side.append(image(pair.left), image(pair.right));
    card.append(
      side,
      element("p", `${pair.reason} · pixel distance ${pair.distance}`),
    );
    for (const asset of [pair.left, pair.right]) {
      const link = element("a", `Original ${asset.slice(0, 8)} `);
      link.href = `/api/archive/${encodeURIComponent(asset)}/original`;
      link.target = "_blank";
      link.rel = "noopener";
      card.append(link);
    }
    card.append(
      button("Merge presentation", async () => {
        await api("/api/review/pair", {
          group,
          left: pair.left,
          right: pair.right,
          action: "merge",
        });
        notice("Merged for presentation. Originals remain available.");
        await duplicates();
        await timeline();
      }),
      button("Keep separate", async () => {
        await api("/api/review/pair", {
          group,
          left: pair.left,
          right: pair.right,
          action: "dismiss",
        });
        await duplicates();
      }),
    );
    $("duplicates").append(card);
  }
  empty($("duplicates"), "No unreviewed suggestions.");
  for (const pair of reviewed) {
    const card = document.createElement("article");
    const side = document.createElement("div");
    side.className = "pair";
    side.append(image(pair.left), image(pair.right));
    card.append(
      side,
      element(
        "p",
        pair.status === "merged" ? "Merged for presentation" : "Kept separate",
      ),
    );
    if (pair.status === "merged") {
      for (const [label, asset, selected] of [
        ["Use first photo", pair.right, pair.left],
        ["Use second photo", pair.left, pair.right],
      ]) {
        card.append(
          button(label, async () => {
            await api("/api/review/rendition", { group, asset, selected });
            notice("Preferred rendition saved for the group.");
            await duplicates();
            await timeline();
          }),
        );
      }
    }
    card.append(
      button(
        pair.status === "merged" ? "Split pair" : "Undo decision",
        async () => {
          await api("/api/review/pair", {
            group,
            left: pair.left,
            right: pair.right,
            action: "undo",
          });
          notice("Review decision undone.");
          await duplicates();
          await timeline();
        },
      ),
    );
    $("reviewed-pairs").append(card);
  }
  empty($("reviewed-pairs"), "No reviewed pairs yet.");
}
async function events() {
  const [candidates, reviewed] = await Promise.all([
    api(`/api/review/events?${params()}`),
    api(`/api/review/reviewed-events?${params()}`),
  ]);
  $("events").replaceChildren();
  $("reviewed-events").replaceChildren();
  for (const candidate of candidates) {
    const card = document.createElement("article");
    card.append(
      element(
        "h3",
        `${candidate.date} · ${candidate.place || "place unknown"}`,
      ),
      element(
        "p",
        `${candidate.assets.length} photographs · ${candidate.reason}`,
      ),
    );
    const title = document.createElement("input");
    title.placeholder = "Event title";
    title.maxLength = 200;
    title.setAttribute("aria-label", "Event title");
    card.append(title);
    const selections = [];
    for (const asset of candidate.assets) {
      const choice = document.createElement("label");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = true;
      choice.append(
        check,
        image(asset),
        element("span", `Include photo ${asset.slice(0, 8)}`),
      );
      card.append(choice);
      selections.push([asset, check]);
    }
    card.append(
      button("Accept selected photos", async () => {
        const selected = selections
          .filter(([, check]) => check.checked)
          .map(([asset]) => asset);
        if (selected.length < 2)
          throw new Error("Select at least two photos for an event.");
        if (selected.length < candidate.assets.length) {
          await api("/api/review/event", {
            group,
            assets: candidate.assets,
            title: "",
            decision: "reject",
          });
        }
        await api("/api/review/event", {
          group,
          assets: selected,
          title: title.value,
          decision: "accept",
        });
        await events();
      }),
      button("Reject suggestion", async () => {
        await api("/api/review/event", {
          group,
          assets: candidate.assets,
          title: "",
          decision: "reject",
        });
        await events();
      }),
    );
    $("events").append(card);
  }
  for (const event of reviewed) {
    const card = document.createElement("article");
    card.append(
      element(
        "h3",
        event.title ||
          (event.status === "rejected"
            ? "Rejected suggestion"
            : "Untitled event"),
      ),
      element("p", `${event.assets.length} photographs · ${event.status}`),
    );
    card.append(
      button("Undo event", async () => {
        await api("/api/review/event", {
          group,
          assets: event.assets,
          title: event.title,
          decision: "undo",
        });
        await events();
      }),
    );
    $("reviewed-events").append(card);
  }
  empty($("events"), "No unreviewed event suggestions.");
  empty($("reviewed-events"), "No reviewed events yet.");
}
async function today() {
  const items = await api(`/api/review/on-this-day?${params()}`);
  $("today").replaceChildren();
  for (const item of items) {
    const card = document.createElement("article");
    card.append(
      image(item.id),
      element("h3", item.title || "A memory"),
      element("p", item.date),
    );
    $("today").append(card);
  }
  empty($("today"), "No approved memories for today.");
}
async function mine() {
  const items = await api(`/api/review/my-contributions?${params()}`);
  $("mine").replaceChildren();
  for (const item of items) {
    const card = document.createElement("article");
    card.append(image(item.asset), element("h3", item.filename));
    card.append(
      button("Remove my source record", async () => {
        await api("/api/review/delete-contribution", { origin: item.id });
        notice("Your source record is no longer shared.");
        await refreshGroup();
      }),
    );
    $("mine").append(card);
  }
  empty($("mine"), "You have no active source records in this group.");
}
$("groups").addEventListener("change", () =>
  act(async () => {
    group = $("groups").value;
    await refreshGroup();
  }),
);
$("leave-group").addEventListener("click", () =>
  act(async () => {
    await api("/api/review/leave-group", { group });
    group = null;
    notice("You left the group. Your contributions are no longer shared.");
    await refresh();
  }),
);
$("search").addEventListener("submit", (event) => {
  event.preventDefault();
  act(async () => {
    query = $("query").value;
    await timeline();
  });
});
$("more").addEventListener("click", () => act(() => timeline(true)));
act(refresh);
