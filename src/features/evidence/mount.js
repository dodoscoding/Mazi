export function mount(root, lifecycle) {
  const { fetch, setInterval, setTimeout, URL } = lifecycle;
  let revision = 0;
  const record = root.querySelector("#record"),
    notice = root.querySelector("#notice");
  function clear() {
    revision++;
    record.replaceChildren();
    notice.textContent = "";
  }
  async function load() {
    clear();
    const current = revision;
    try {
      const requestedGroup = new URLSearchParams(lifecycle.search).get("group");
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
      for (const text of [
        value.title,
        `Date: ${value.date || value.dates.join(", ") || "unknown"} (${value.date_basis})`,
        `Place: ${value.place || "unknown"}`,
        "This is recorded archive metadata, not independent verification of historical events.",
      ]) {
        const p = document.createElement("p");
        p.textContent = text;
        record.append(p);
      }
    } catch (error) {
      if (current === revision) notice.textContent = error.message;
    }
  }
  load();
}
