import { confirmAction, el } from "../ui.js";

export function mount(root, lifecycle) {
  const $ = (id) => root.querySelector(`#${id}`);
  let group;
  let exporting;
  const notice = (message) => {
    $("settings-notice").textContent = message;
  };
  async function api(path, body) {
    const response = await lifecycle.fetch(
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
  async function run(work) {
    try {
      await work();
    } catch (error) {
      if (error.name !== "AbortError") notice(error.message);
    }
  }
  async function refresh() {
    $("settings-work").hidden = true;
    $("settings-retry").hidden = true;
    try {
      const groups = await api("/api/groups");
      group = groups.find((item) => item.id === lifecycle.groupId) || groups[0];
      if (!group) {
        notice("No circle is currently available.");
        return;
      }
      const items = await api(
        `/api/review/my-contributions?group=${encodeURIComponent(group.id)}`,
      );
      $("settings-mine").replaceChildren();
      if (!items.length)
        $("settings-mine").append(
          el(
            "p",
            "fx-small",
            "You have no active source records in this group.",
          ),
        );
      $("settings-work").hidden = false;
      notice("");
    } catch (error) {
      $("settings-retry").hidden = false;
      throw error;
    }
  }
  $("settings-retry").onclick = () => run(refresh);
  $("settings-export").onclick = () =>
    run(async () => {
      if (!group || exporting) return;
      exporting = new AbortController();
      $("settings-export").disabled = true;
      $("settings-cancel-export").hidden = false;
      notice("Preparing your archive…");
      try {
        const response = await lifecycle.fetch(
          `/api/review/export?group=${encodeURIComponent(group.id)}`,
          { signal: exporting.signal },
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Export failed. Please retry.");
        }
        const blob = await response.blob();
        const url = lifecycle.URL.createObjectURL(blob);
        const link = el("a");
        link.href = url;
        link.download = "mazi-archive.zip";
        link.click();
        lifecycle.setTimeout(() => lifecycle.URL.revokeObjectURL(url), 1000);
        notice("Archive download started.");
      } catch (error) {
        if (error.name === "AbortError")
          notice("Export cancelled. You can try again.");
        else throw error;
      } finally {
        exporting = null;
        $("settings-export").disabled = false;
        $("settings-cancel-export").hidden = true;
      }
    });
  $("settings-cancel-export").onclick = () => exporting?.abort();
  lifecycle.onDispose(() => exporting?.abort());
  run(refresh);
}
