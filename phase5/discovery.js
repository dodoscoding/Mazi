const $ = (id) => document.querySelector(id);
let indexRun = 0,
  learned = false;
let group = "",
  groups = [],
  people = [],
  generation = 0,
  next = null,
  similar = "";
function node(tag, value, attrs = {}) {
  const el = document.createElement(tag);
  if (value !== undefined) el.textContent = value;
  for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
  return el;
}
function clearPrivate() {
  generation++;
  indexRun++;
  $("#index-progress").textContent = "";
  $("#stop-index").hidden = true;
  for (const id of [
    "#memories",
    "#hidden-memories",
    "#results",
    "#people",
    "#identities",
    "#hidden-items",
    "#suppressed",
    "#person",
    "#identity-person",
    "#identity-account",
    "#nonmember-person",
    "#nonmember-asset",
  ])
    $(id).replaceChildren();
  $("#count").textContent = "";
  $("#processing-status").textContent = "";
  $("#more").hidden = true;
  people = [];
}
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
      clearPrivate();
      $("#groups").replaceChildren();
      group = "";
      $("#private").hidden = true;
    }
    throw Error(value.error || "Request failed");
  }
  return value;
}
async function run(fn) {
  try {
    await fn();
  } catch (error) {
    $("#notice").textContent = error.message;
  }
}
function action(label, fn) {
  const button = node("button", label, { type: "button" });
  button.onclick = () =>
    run(async () => {
      button.disabled = true;
      try {
        await fn();
      } finally {
        button.disabled = false;
      }
    });
  return button;
}
function options(id, entries, placeholder = "Choose a person") {
  const select = $(id),
    old = select.value;
  select.replaceChildren(
    node("option", placeholder, { value: "" }),
    ...entries.map((p) => node("option", p.name, { value: p.id })),
  );
  if (entries.some((p) => p.id === old)) select.value = old;
}
async function mutate(path, body) {
  await api("/api/discovery/" + path, body);
  await refresh();
  $("#notice").textContent = "Changes saved.";
}
async function search(offset = 0) {
  const revision = ++generation;
  $("#results").replaceChildren();
  $("#more").hidden = true;
  $("#count").textContent = "Searching…";
  const query = new URLSearchParams({
    group,
    query: $("#query").value,
    mode: $("#mode").value,
    person: $("#person").value,
    place: $("#place").value,
    country: $("#country").value,
    object_query: $("#object").value,
    start: $("#start").value,
    end: $("#end").value,
    source: $("#source").value,
    similar,
    offset: String(offset),
  });
  const result = await api("/api/discovery/search?" + query);
  if (revision !== generation) return;
  next = result.next_offset;
  if (result.unindexed)
    $("#index-progress").textContent =
      `${result.unindexed} eligible photographs need indexing; these use words and filters until the index is built.`;
  $("#count").textContent = `${result.total} photographs · ${result.mode}`;
  $("#more").hidden = next === null;
  $("#clear-similar").hidden = !similar;
  options(
    "#nonmember-asset",
    result.items.map((item) => ({
      id: item.id,
      name: item.title || "Untitled photograph",
    })),
    "Choose a photograph",
  );
  for (const item of result.items) {
    const card = node("article");
    card.append(
      node("img", undefined, {
        src: "/api/archive/" + encodeURIComponent(item.id) + "/preview",
        alt: item.title || "Archive photograph",
        loading: "lazy",
      }),
      node("h3", item.title || "Untitled photograph"),
      node(
        "p",
        [item.date || "Undated", item.place].filter(Boolean).join(" · "),
      ),
      node("a", "Open original", {
        href: "/api/archive/" + encodeURIComponent(item.id) + "/original",
        target: "_blank",
        rel: "noopener",
      }),
    );
    for (const person of item.people) {
      const line = node("p", person.name);
      if (person.is_me || person.can_remove)
        line.append(
          action(person.is_me ? "Remove my association" : "Remove tag", () =>
            mutate(person.is_me ? "disassociate" : "untag", {
              person: person.id,
              asset: item.id,
            }),
          ),
        );
      card.append(line);
    }
    const label = node("label", "Confirm someone in this photo");
    const select = node("select", undefined, { "aria-label": "Person to tag" });
    select.append(
      node("option", "Choose a person", { value: "" }),
      ...people.map((p) => node("option", p.name, { value: p.id })),
    );
    label.append(select);
    card.append(
      label,
      action("Confirm tag", async () => {
        if (!select.value) throw Error("Choose a person first.");
        await mutate("tag", {
          person: select.value,
          asset: item.id,
          confirmed: true,
        });
      }),
      action("Hide from my discovery", () =>
        mutate("hide", { asset: item.id, enabled: true }),
      ),
    );
    if ($("#mode").value === "semantic")
      card.append(
        action(
          learned ? "Find similar photographs" : "Find similar colors",
          async () => {
            similar = item.id;
            await search();
          },
        ),
      );
    $("#results").append(card);
  }
  if (!result.items.length)
    $("#results").append(
      node(
        "p",
        "No matching photographs. Try fewer filters or a different word.",
      ),
    );
}
async function refresh() {
  clearPrivate();
  const revision = generation;
  const currentGroup = group;
  const state = await api(
    "/api/discovery/state?group=" + encodeURIComponent(group),
  );
  if (revision !== generation || currentGroup !== group) return;
  $("#mode option[value=semantic]").textContent = state.settings.model_label;
  $("#model-help").textContent = state.settings.model_message;
  $("#build-index").hidden =
    !state.settings.learned ||
    !state.settings.model_ready ||
    !state.settings.group_enabled;
  learned = state.settings.learned;
  people = state.people;
  for (const event of state.memories)
    $("#memories").append(
      action(`Hide memory: ${event.title || "Untitled"}`, () =>
        mutate("hide-memory", { group, event: event.id, enabled: true }),
      ),
    );
  for (const event of state.hidden_memories)
    $("#hidden-memories").append(
      action(`Restore memory: ${event.title || "Untitled"}`, () =>
        mutate("hide-memory", { group, event: event.id, enabled: false }),
      ),
    );
  options(
    "#person",
    people.filter((p) => p.count),
    "Anyone",
  );
  options(
    "#identity-person",
    people.filter((p) => !p.verified),
  );
  options(
    "#nonmember-person",
    people.filter((p) => !p.verified),
  );
  for (const person of people)
    $("#people").append(
      node(
        "span",
        `${person.name} · ${person.count} ${person.count === 1 ? "photo" : "photos"}${person.is_me ? " · You" : ""}${person.places.length ? " · " + person.places.join(", ") : ""}${person.memories.length ? " · Memories: " + person.memories.map((m) => m.title || "Untitled").join(", ") : ""}`,
      ),
    );
  for (const identity of state.identities)
    $("#identities").append(
      action(`Confirm I am ${identity.name}`, () =>
        mutate("identity/confirm", { person: identity.id }),
      ),
    );
  for (const item of state.hidden)
    $("#hidden-items").append(
      action("Restore hidden photograph", () =>
        mutate("hide", { asset: item.id, enabled: false }),
      ),
    );
  for (const item of state.suppressed)
    $("#suppressed").append(
      action(`Restore my ${item.name} association`, () =>
        mutate("restore", { person: item.person, asset: item.asset }),
      ),
    );
  $("#contribution-processing").checked = state.settings.contribution_enabled;
  $("#group-processing").checked = state.settings.group_enabled;
  $("#processing-status").textContent =
    `Group processing ${state.settings.group_enabled ? "on" : "off"}. Face recognition off. No external provider charges.`;
  const admin = groups.find((g) => g.id === group)?.role === "admin";
  $("#group-control").hidden = !admin;
  $("#admin-tools").hidden = !admin;
  if (admin) {
    const members = await api(
      "/api/members?group=" + encodeURIComponent(group),
    );
    if (revision !== generation || currentGroup !== group) return;
    options(
      "#identity-account",
      members.map((m) => ({ id: m.id, name: m.email })),
      "Choose a member",
    );
  }
  $("#private").hidden = false;
  await search();
}
$("#search-form").onsubmit = (event) => {
  event.preventDefault();
  run(() => search());
};
$("#more").onclick = () => run(() => search(next));
$("#clear-similar").onclick = () =>
  run(async () => {
    similar = "";
    await search();
  });
$("#mode").onchange = () => {
  similar = "";
};
$("#groups").onchange = () =>
  run(async () => {
    group = $("#groups").value;
    similar = "";
    await refresh();
  });
$("#person-form").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    await mutate("person", { group, name: $("#new-name").value });
    $("#new-name").value = "";
  });
};
$("#contribution-processing").onchange = () =>
  run(() =>
    mutate("processing", {
      group,
      enabled: $("#contribution-processing").checked,
    }),
  );
$("#group-processing").onchange = () =>
  run(() =>
    mutate("processing", {
      group,
      enabled: $("#group-processing").checked,
      group_wide: true,
    }),
  );
$("#identity-form").onsubmit = (event) => {
  event.preventDefault();
  run(() =>
    mutate("identity/propose", {
      person: $("#identity-person").value,
      account: $("#identity-account").value,
    }),
  );
};
$("#nonmember-form").onsubmit = (event) => {
  event.preventDefault();
  run(() =>
    mutate("nonmember-review", {
      person: $("#nonmember-person").value,
      asset: $("#nonmember-asset").value,
      verified: $("#verified-request").checked,
      restore: $("#nonmember-action").value === "restore",
    }),
  );
};
run(async () => {
  groups = await api("/api/groups");
  $("#groups").replaceChildren(
    ...groups.map((g) => node("option", g.name, { value: g.id })),
  );
  group = $("#groups").value;
  if (!group) {
    $("#notice").textContent =
      "Sign in and join a group through Imports to explore your archive.";
    return;
  }
  await refresh();
});

$("#build-index").onclick = () =>
  run(async () => {
    const runId = ++indexRun,
      targetGroup = group;
    let completed = 0;
    $("#build-index").disabled = true;
    $("#stop-index").hidden = false;
    try {
      while (runId === indexRun && group === targetGroup) {
        const progress = await api("/api/discovery/index", {
          group: targetGroup,
          limit: 2,
        });
        if (runId !== indexRun || group !== targetGroup) break;
        completed += progress.indexed;
        $("#index-progress").textContent =
          `${completed} photographs indexed; ${progress.remaining} remaining.`;
        if (progress.discarded) {
          $("#index-progress").textContent =
            "Permissions or source data changed. Old work was discarded; restart indexing when ready.";
          break;
        }
        if (!progress.remaining) {
          await search();
          break;
        }
      }
    } finally {
      $("#build-index").disabled = false;
      $("#stop-index").hidden = true;
    }
  });
$("#stop-index").onclick = () => {
  indexRun++;
  $("#index-progress").textContent =
    "Indexing stopped after the current small batch. You can resume later.";
};
