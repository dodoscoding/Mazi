import { el, formatDay } from "../ui.js";

export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  let revision = 0;
  const record = root.querySelector("#record"),
    notice = root.querySelector("#notice");
  function clear() {
    revision++;
    record.replaceChildren();
    record.hidden = true;
    notice.textContent = "";
  }
  async function load() {
    clear();
    const current = revision;
    try {
      const requestedGroup = new URLSearchParams(lifecycle.search).get("group");
      const asset = new URLSearchParams(lifecycle.search).get("asset");
      const groupsResponse = await fetch("/api/groups");
      const groups = await groupsResponse.json();
      if (!groupsResponse.ok)
        throw Error(groups.error || "Evidence unavailable");
      const currentGroup = lifecycle.groupId || groups[0]?.id;
      if (!currentGroup || requestedGroup !== currentGroup) {
        notice.textContent =
          "This evidence belongs to another circle. Return to Ask your archive to find evidence in the current circle.";
        return;
      }
      const response = await fetch("/api/answers/evidence" + lifecycle.search);
      const value = await response.json();
      if (current !== revision) return;
      if (!response.ok) throw Error(value.error || "Evidence unavailable");
      const date = value.date || value.dates.join(", ") || "unknown";
      const figure = el("figure", "evidence-photo");
      const image = document.createElement("img");
      image.src = `/api/archive/${encodeURIComponent(asset || value.id)}/preview`;
      image.alt = value.title;
      figure.append(image);
      const body = el("div", "evidence-body");
      const facts = el("dl", "evidence-facts");
      for (const [term, detail] of [
        [
          "Date",
          `${value.date ? formatDay(value.date) : date} (${value.date_basis})`,
        ],
        ["Place", value.place || "unknown"],
      ])
        facts.append(el("dt", "fx-label", term), el("dd", "", detail));
      body.append(
        el(
          "p",
          "fx-label evidence-kind",
          `Photograph · ${value.date ? formatDay(value.date) : "Date unknown"}`,
        ),
        el("h2", "evidence-name", value.title),
        facts,
        el(
          "p",
          "fx-small",
          "This is recorded archive metadata, not independent verification of historical events.",
        ),
      );
      record.append(figure, body);
      record.hidden = false;
    } catch (error) {
      if (current === revision) notice.textContent = error.message;
    }
  }
  load();
}
