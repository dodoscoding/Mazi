const $ = (id) => document.getElementById(id);
let group = "",
  generation = 0;
function node(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
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
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Request failed");
  return data;
}
const mediaUrls = new Set();
function clear() {
  for (const url of mediaUrls) URL.revokeObjectURL(url);
  mediaUrls.clear();
  $("capsules").replaceChildren();
  $("notifications").textContent = "";
  generation++;
  $("recap").replaceChildren();
  $("stories").replaceChildren();
  $("notice").textContent = "";
}
async function mutate(path, body) {
  const selected = group;
  clear();
  const current = generation;
  try {
    await api(path, { group: selected, ...body });
    if (current === generation) await refresh();
  } catch (error) {
    if (current === generation) $("notice").textContent = error.message;
  }
}
function renderStory(story) {
  const panel = node("article", "");
  panel.className = "panel";
  panel.append(node("h3", story.event.title), node("p", story.notice));
  for (const entry of story.contributions)
    panel.append(
      node("p", (entry.editable ? "You: " : "Group member: ") + entry.text),
    );
  const form = node("form", ""),
    label = node("label", "Your recollection"),
    input = node("textarea", "");
  input.maxLength = 2000;
  input.value = story.contributions.find((entry) => entry.editable)?.text || "";
  label.append(input);
  form.append(label, node("button", "Save my recollection"));
  form.onsubmit = (event) => {
    event.preventDefault();
    mutate("/api/memories/write", {
      story: story.id,
      revision: story.revision,
      text: input.value,
    });
  };
  panel.append(form);
  const remove = node("button", "Remove my recollection");
  remove.type = "button";
  remove.onclick = () =>
    mutate("/api/memories/write", {
      story: story.id,
      revision: story.revision,
      text: "",
    });
  panel.append(remove);
  const download = node("button", "Export story JSON");
  download.type = "button";
  download.onclick = async () => {
    const current = generation;
    try {
      const result = await api(
        "/api/memories/export?" +
          new URLSearchParams({ group, story: story.id }),
      );
      if (current !== generation) return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        }),
      );
      const link = node("a", "");
      link.href = url;
      link.download = "mazi-story.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (current === generation) {
        clear();
        $("notice").textContent = error.message;
      }
    }
  };
  panel.append(download);
  if (story.can_delete) {
    const button = node("button", "Delete story");
    button.type = "button";
    button.onclick = () =>
      mutate("/api/memories/delete", {
        story: story.id,
        revision: story.revision,
      });
    panel.append(button);
  }
  advancedStory(panel, story);
  return panel;
}
async function refresh() {
  clear();
  const current = generation;
  if (!group) return;
  try {
    const query = new URLSearchParams({ group, year: $("year").value });
    const [recap, stories] = await Promise.all([
      api("/api/memories/recap?" + query),
      api("/api/memories/stories?" + query),
    ]);
    if (current !== generation) return;
    $("recap").append(
      node("h2", `${recap.year} · Annual recap`),
      node("p", recap.coverage),
    );
    if (!recap.memories.length)
      $("recap").append(
        node("p", "No eligible approved memories for this year."),
      );
    for (const memory of recap.memories) {
      const card = node("article", "");
      card.className = "panel";
      card.append(
        node("h3", memory.title),
        node("p", `${memory.start} — ${memory.end}`),
      );
      for (const asset of memory.assets)
        card.append(node("p", asset.title || "Untitled photograph"));
      const button = node("button", "Start a story");
      button.onclick = () =>
        mutate("/api/memories/create", { event: memory.id });
      card.append(button);
      $("recap").append(card);
    }
    if (!stories.length)
      $("stories").append(node("p", "No shared stories yet."));
    for (const story of stories) $("stories").append(renderStory(story));
    await renderCapsules(current);
  } catch (error) {
    if (current === generation) $("notice").textContent = error.message;
  }
}
$("year-form").onsubmit = (event) => {
  event.preventDefault();
  refresh();
};
$("refresh").onclick = refresh;
$("groups").onchange = () => {
  group = $("groups").value;
  refresh();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clear();
  else refresh();
});
window.addEventListener("pagehide", clear);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) refresh();
});
window.addEventListener("DOMContentLoaded", async () => {
  try {
    for (const g of await api("/api/groups")) {
      const option = node("option", g.name);
      option.value = g.id;
      $("groups").append(option);
    }
    group = $("groups").value;
    await refresh();
  } catch (error) {
    $("notice").textContent = error.message + ". Sign in from Imports.";
  }
});
