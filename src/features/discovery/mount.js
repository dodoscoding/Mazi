import {
  promptSkeleton,
  renderFilters,
  renderGroups,
  renderPrompts,
  sharedByLine,
  skeletonRows,
  suggestions,
} from "./views";
import "./discovery.css";

export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  const $ = (id) => root.querySelector(id);
  // One template serves /discover and, outside the sample, /search.
  const path = (
    location.hash.startsWith("#/") ? location.hash.slice(1) : location.pathname
  ).split("?")[0];
  const view = path === "/search" ? "search" : "discover";
  root.querySelector(".discovery-page").dataset.view = view;
  // The URL holds the search so Back from a result restores it.
  const urlFields = [
    ["q", "#query"],
    ["place", "#place"],
    ["country", "#country"],
    ["object", "#object"],
    ["from", "#start"],
    ["through", "#end"],
  ];
  const restored = new URLSearchParams(
    location.hash.startsWith("#/")
      ? location.hash.split("?").slice(1).join("?")
      : location.search,
  );
  const filters = {
    source: restored.get("source") || "",
    sharedBy: restored.get("by") || "",
  };
  for (const [key, id] of urlFields) $(id).value = restored.get(key) || "";
  $("#clear-query").hidden = !$("#query").value;
  $(".disc-refine").open = urlFields
    .slice(1)
    .some(([key]) => restored.get(key));
  function rememberSearch() {
    const params = new URLSearchParams();
    for (const [key, id] of urlFields)
      if ($(id).value) params.set(key, $(id).value);
    if (filters.source) params.set("source", filters.source);
    if (filters.sharedBy) params.set("by", filters.sharedBy);
    const query = params.toString();
    const url = path + (query ? `?${query}` : "");
    window.history.replaceState(
      window.history.state,
      "",
      location.hash.startsWith("#/") ? `#${url}` : url,
    );
  }
  let atlas = [],
    atlasKey = null,
    heroIndex = 0,
    resultType = "all",
    counts = null;
  if (view === "search") {
    $("#discovery-title").textContent = "Search";
    $("#search-title").textContent = "Search the archive";
    $("#prompts").hidden = true;
    $("#discover-sub").hidden = true;
  } else promptSkeleton(root);
  let contextController = new AbortController();
  lifecycle.onDispose(() => contextController.abort());
  let contextRevision = 0,
    contextReady = false,
    contextWanted = false,
    contextLoading = false,
    photoTotal = null,
    completedQuery = "";
  let indexRun = 0,
    learned = false;
  let group = "",
    groups = [],
    people = [],
    groupEnabled = false,
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
    contextRevision++;
    contextController.abort();
    contextController = new AbortController();
    contextReady = false;
    contextLoading = false;
    photoTotal = null;
    atlas = [];
    atlasKey = null;
    if (view === "search") {
      $("#context-choice").hidden = false;
      $("#include-context").disabled = false;
      $("#context-status").textContent =
        "Search photographs now. Include other categories and People when you need them.";
      $("#person").disabled = true;
      $("#load-people").hidden = false;
      $("#load-people").disabled = false;
      $("#mode option[value=semantic]").disabled = true;
      $("#build-index").hidden = true;
      root.querySelectorAll(".disc-manage").forEach((panel) => {
        panel.hidden = true;
      });
    }
    indexRun++;
    $("#index-progress").textContent = "";
    $("#index-recovery").hidden = true;
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
      "#memory-list",
      "#chat-list",
      "#place-list",
      "#people-list",
      "#search-loading",
    ])
      $(id).replaceChildren();
    $("#search-loading").hidden = true;
    $("#search-none").hidden = true;
    $("#search-recovery").hidden = true;
    $("#search-filters").hidden = true;
    $("#result-types").hidden = true;
    $("#result-total").textContent = "";
    $("#count").textContent = "";
    $("#processing-status").textContent = "";
    $("#more").hidden = true;
    people = [];
  }
  async function api(path, body, expectedContext) {
    const response = await fetch(
      path,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : expectedContext === undefined
          ? {}
          : { signal: contextController.signal },
    );
    const value = await response.json();
    if (expectedContext !== undefined && expectedContext !== contextRevision)
      throw Error("Context changed");
    if (!response.ok) {
      if (response.status === 403) {
        clearPrivate();
        $("#groups").replaceChildren();
        group = "";
        $("#private").hidden = true;
      }
      throw Object.assign(Error(value.error || "Request failed"), {
        status: response.status,
        code: value.code,
      });
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
  function showGroups() {
    const shown = (key, count) =>
      count > 0 && (resultType === "all" || resultType === key);
    $("#memory-results").hidden = !shown("memories", counts.memories);
    $("#chat-results").hidden = !shown("chats", counts.chats);
    $("#place-results").hidden = !shown("places", counts.places);
    $("#people-results").hidden = !shown("people", counts.people);
    $("#photo-results").hidden = !(
      resultType === "all" || resultType === "photos"
    );
    $("#ask-card").hidden = !counts.term || resultType !== "all";
    root
      .querySelectorAll("#result-types button")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.type === resultType),
        ),
      );
  }
  function renderTypes(photos) {
    if (view === "search" && !contextReady) {
      $("#result-total").textContent =
        `${photos} ${photos === 1 ? "photograph" : "photographs"}`;
      $("#result-types").hidden = true;
      $("#search-none").hidden = true;
      for (const id of [
        "#memory-results",
        "#chat-results",
        "#place-results",
        "#people-results",
        "#ask-card",
      ])
        $(id).hidden = true;
      $("#photo-results").hidden = false;
      $("#search-groups").hidden = false;
      return;
    }
    const total =
      counts.memories + counts.chats + counts.places + counts.people + photos;
    const types = [
      ["all", "All", total],
      ["memories", "Memories", counts.memories],
      ["photos", "Photographs", photos],
      ["places", "Places", counts.places],
      ["people", "People", counts.people],
      ["chats", "Chats", counts.chats],
    ];
    $("#result-types").replaceChildren(
      ...types.map(([type, label, count]) => {
        const button = node("button", `${label} `, { type: "button" });
        button.dataset.type = type;
        button.append(node("span", String(count), { class: "data" }));
        button.onclick = () => {
          resultType = type;
          showGroups();
        };
        return button;
      }),
    );
    $("#result-types").hidden = !counts.term;
    $("#result-total").textContent = counts.term
      ? `${total} ${total === 1 ? "result" : "results"}`
      : "";
    const none = Boolean(counts.term) && total === 0;
    $("#search-none").hidden = !none;
    $("#search-groups").hidden = none;
    if (none) {
      $("#none-title").textContent = `Nothing for “${completedQuery.trim()}”`;
      $("#none-try").replaceChildren(
        ...suggestions(atlas).map((word) => {
          const button = node("button", word, {
            type: "button",
            class: "br-chip",
          });
          button.onclick = () => {
            $("#query").value = word;
            $("#clear-query").hidden = false;
            run(() => search());
          };
          return button;
        }),
      );
    }
    $("#ask-quote").textContent = counts.term
      ? `“${completedQuery.trim()}”`
      : "";
    showGroups();
  }
  async function search(offset = 0) {
    const revision = ++generation;
    rememberSearch();
    photoTotal = null;
    $("#result-total").textContent = "";
    $("#result-types").hidden = true;
    const mode = $("#mode").value;
    $("#notice").textContent = "";
    $("#search-recovery").hidden = true;
    $("#results").replaceChildren();
    $("#more").hidden = true;
    $("#count").textContent = "Searching…";
    if (!offset) {
      $("#search-loading").replaceChildren(...skeletonRows());
      $("#search-loading").hidden = false;
      $("#search-groups").hidden = true;
      $("#search-none").hidden = true;
    }
    try {
      await searchPage(revision, offset);
      if (revision === generation && $("#search-none").hidden)
        $("#search-groups").hidden = false;
    } catch (error) {
      if (revision !== generation) return;
      next = null;
      $("#count").textContent = "Search unavailable.";
      $("#result-total").textContent = "";
      $("#result-types").hidden = true;
      $("#search-groups").hidden = true;
      $("#search-none").hidden = true;
      $("#search-recovery").hidden = !(
        error.status === 400 && error.code === "capacity_exceeded"
      );
      $("#search-recovery-message").textContent =
        mode === "semantic"
          ? "Related search supports up to 10,000 visible photographs within metadata and processing limits. Try Words & filters for this search."
          : "Complete results are unavailable because this search exceeded its metadata-work budget.";
      $("#use-keyword").hidden = mode !== "semantic";
      throw error;
    } finally {
      if (revision === generation) {
        $("#search-loading").hidden = true;
        $("#search-loading").replaceChildren();
      }
    }
  }
  async function searchPage(revision, offset) {
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
      source: filters.source,
      shared_by: filters.sharedBy,
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
    photoTotal = result.total;
    completedQuery = $("#query").value;
    renderFilters(root, result.facets, filters);
    counts = renderGroups(root, atlas, completedQuery, people, filters);
    renderTypes(result.total);
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
      const card = node("article", undefined, { class: "disc-photo" });
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
        node("p", sharedByLine(item), { class: "disc-shared" }),
        node("a", "Open original", {
          href: "/api/archive/" + encodeURIComponent(item.id) + "/original",
          target: "_blank",
          rel: "noopener",
          class: "disc-original",
        }),
      );
      for (const person of item.people) {
        const line = node("p", person.name, { class: "disc-person" });
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
      const label = node("label", "Confirm someone in this photo", {
        class: "disc-tag",
      });
      const select = node("select", undefined, {
        "aria-label": "Person to tag",
      });
      select.append(
        node("option", "Choose a person", { value: "" }),
        ...people.map((p) => node("option", p.name, { value: p.id })),
      );
      select.disabled = view === "search" && !contextReady;
      label.append(select);
      const confirmTag = action("Confirm tag", async () => {
        if (!select.value) throw Error("Choose a person first.");
        await mutate("tag", {
          person: select.value,
          asset: item.id,
          confirmed: true,
        });
      });
      confirmTag.className = "disc-tag-confirm";
      confirmTag.disabled = view === "search" && !contextReady;
      card.append(
        label,
        confirmTag,
        action("Hide from my discovery", () =>
          mutate("hide", { asset: item.id, enabled: true }),
        ),
      );
      if ($("#mode").value === "semantic" && groupEnabled)
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
  async function hydrateContext(revision, currentGroup) {
    const [state, map] = await Promise.all([
      api(
        "/api/discovery/state?group=" + encodeURIComponent(currentGroup),
        undefined,
        revision,
      ),
      api(
        "/api/atlas?group=" + encodeURIComponent(currentGroup),
        undefined,
        revision,
      ).catch((error) => {
        if (view === "discover") return { memories: [] };
        throw error;
      }),
    ]);
    if (revision !== contextRevision || currentGroup !== group) return;
    for (const id of [
      "#memories",
      "#hidden-memories",
      "#people",
      "#identities",
      "#hidden-items",
      "#suppressed",
    ])
      $(id).replaceChildren();
    atlas = map.memories;
    const key = currentGroup + atlas.map((memory) => memory.id).join();
    if (view === "discover" && key !== atlasKey) {
      atlasKey = key;
      renderPrompts(root, atlas, heroIndex);
    }
    $("#mode option[value=semantic]").textContent = state.settings.model_label;
    $("#model-help").textContent = state.settings.model_message;
    $("#build-index").hidden =
      !state.settings.learned ||
      !state.settings.model_ready ||
      !state.settings.group_enabled;
    learned = state.settings.learned;
    groupEnabled = state.settings.group_enabled;
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
        action(
          `Restore hidden photograph: ${item.title || "Untitled photograph"}`,
          () => mutate("hide", { asset: item.id, enabled: false }),
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
        "/api/members?group=" + encodeURIComponent(currentGroup),
        undefined,
        revision,
      );
      if (revision !== contextRevision || currentGroup !== group) return;
      options(
        "#identity-account",
        members.map((m) => ({ id: m.id, name: m.display_name || m.email })),
        "Choose a member",
      );
    }
    contextReady = true;
    $("#private").hidden = false;
    $("#person").disabled = false;
    $("#mode option[value=semantic]").disabled = false;
    $("#load-people").hidden = true;
    root.querySelectorAll(".disc-manage").forEach((panel) => {
      panel.hidden = false;
    });
    $("#admin-tools").hidden = !admin;
    for (const select of root.querySelectorAll(".disc-tag select")) {
      const selected = select.value;
      select.replaceChildren(
        node("option", "Choose a person", { value: "" }),
        ...people.map((person) =>
          node("option", person.name, { value: person.id }),
        ),
      );
      if (people.some((person) => person.id === selected))
        select.value = selected;
      select.disabled = false;
    }
    root.querySelectorAll(".disc-tag-confirm").forEach((button) => {
      button.disabled = false;
    });
    if (photoTotal !== null) {
      counts = renderGroups(root, atlas, completedQuery, people, filters);
      renderTypes(photoTotal);
    }
  }
  async function loadContext() {
    if (contextLoading || contextReady) return;
    contextWanted = true;
    contextLoading = true;
    const revision = contextRevision;
    const currentGroup = group;
    $("#include-context").disabled = true;
    $("#load-people").disabled = true;
    $("#context-status").textContent =
      "Loading memories, chats, places and people…";
    try {
      await hydrateContext(revision, currentGroup);
      if (revision !== contextRevision || currentGroup !== group) return;
      $("#context-choice").hidden = true;
    } catch (error) {
      if (revision !== contextRevision || currentGroup !== group) return;
      $("#context-status").textContent =
        "Other categories and People are unavailable. Your photograph search is still here. Try again.";
    } finally {
      if (revision === contextRevision) {
        contextLoading = false;
        $("#include-context").disabled = false;
        $("#load-people").disabled = false;
      }
    }
  }
  async function refresh() {
    const includeContext = contextWanted;
    clearPrivate();
    if (view === "search") {
      $("#private").hidden = false;
      if (includeContext) await loadContext();
      await search();
    } else {
      await hydrateContext(contextRevision, group);
      await search();
    }
  }
  $("#include-context").onclick = () => run(loadContext);
  $("#load-people").onclick = () => run(loadContext);
  $("#shuffle").onclick = () => {
    heroIndex++;
    renderPrompts(root, atlas, heroIndex);
  };
  $("#query").addEventListener("input", () => {
    $("#clear-query").hidden = !$("#query").value;
  });
  $("#clear-query").onclick = () => {
    $("#query").value = "";
    $("#clear-query").hidden = true;
    $("#query").focus();
    run(() => search());
  };
  $("#search-form").onsubmit = (event) => {
    event.preventDefault();
    run(() => search());
  };
  $("#use-keyword").onclick = () => {
    $("#mode").value = "keyword";
    similar = "";
    $("#clear-similar").hidden = true;
    $("#query").focus();
    run(() => search());
  };
  $("#source-filter").onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    filters.source = button.dataset.source;
    run(() => search());
  };
  $("#shared-by").onchange = () => {
    filters.sharedBy = $("#shared-by").value;
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
      group = lifecycle.selectGroup($("#groups"));
      contextWanted = false;
      $("#mode").value = "keyword";
      similar = "";
      filters.source = filters.sharedBy = "";
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
    run(async () => {
      if (!$("#group-processing").checked) similar = "";
      await mutate("processing", {
        group,
        enabled: $("#group-processing").checked,
        group_wide: true,
      });
    });
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
    group = lifecycle.selectGroup($("#groups"));
    $("#groups").closest("label").hidden = groups.length < 2;
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
      $("#notice").textContent = "";
      $("#index-recovery").hidden = true;
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
      } catch (error) {
        if (runId !== indexRun || group !== targetGroup) return;
        if (error.status === 400 && error.code === "capacity_exceeded") {
          $("#index-progress").textContent =
            "Indexing stopped at the local capacity limit.";
          $("#index-recovery").hidden = false;
        }
        throw error;
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
}
