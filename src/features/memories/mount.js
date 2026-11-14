import { createGallery } from "./gallery";
import "./memories.css";

export function mount(root, lifecycle) {
  const $ = (id) => root.querySelector(`#${id}`);
  let group = "";
  let generation = 0;
  async function api(path) {
    const response = await lifecycle.fetch(path);
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Request failed");
    return data;
  }
  const grid = createGallery(root, lifecycle, api);
  async function refresh() {
    const current = ++generation;
    $("recap").replaceChildren();
    $("notice").textContent = "";
    if (!group) return;
    try {
      const recap = await api(
        `/api/memories/recap?${new URLSearchParams({ group, year: $("year").value })}`,
      );
      if (current !== generation) return;
      const coverage = document.createElement("p");
      coverage.textContent = recap.coverage;
      $("recap").append(coverage);
      if (!recap.memories.length) {
        const empty = document.createElement("p");
        empty.textContent = "No eligible approved memories for this year.";
        $("recap").append(empty);
      }
      for (const memory of recap.memories) {
        const card = document.createElement("article"),
          heading = document.createElement("h3"),
          link = document.createElement("a");
        card.className = "panel";
        link.href = `#/memory/${encodeURIComponent(memory.id)}?notebook=1`;
        link.textContent = memory.title;
        heading.append(link);
        card.append(heading);
        $("recap").append(card);
      }
    } catch (error) {
      if (current === generation && error.name !== "AbortError")
        $("notice").textContent = error.message;
    }
  }
  $("year-form").onsubmit = (event) => {
    event.preventDefault();
    void refresh();
  };
  $("refresh").onclick = refresh;
  $("groups").onchange = () => {
    group = lifecycle.selectGroup($("groups"));
    grid.load(group);
    void refresh();
  };
  void (async () => {
    try {
      for (const item of await api("/api/groups")) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        $("groups").append(option);
      }
      group = lifecycle.selectGroup($("groups"));
      $("groups").closest("label").hidden = $("groups").options.length < 2;
      grid.load(group);
      if (
        new URLSearchParams(lifecycle.search).get("section") === "recap" &&
        lifecycle.mountKind !== "refresh"
      ) {
        $("recap-heading").focus({ preventScroll: true });
        $("recap-heading").scrollIntoView({ block: "start" });
      }
      await refresh();
    } catch (error) {
      if (error.name !== "AbortError") $("notice").textContent = error.message;
    }
  })();
}
