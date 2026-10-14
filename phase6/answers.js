const $ = (id) => document.getElementById(id);
let group = "",
  revision = 0,
  groups = [];
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
function clear() {
  revision++;
  $("answer").replaceChildren();
  $("notice").textContent = "";
}
function usage(value) {
  $("usage").textContent =
    `${value.requests} / ${value.daily_limit} requests today (UTC). Provider cost: €0. Local infrastructure cost is not measured.`;
}
async function refresh() {
  clear();
  $("private").hidden = true;
  const current = revision;
  try {
    const state = await api(
      "/api/answers/state?group=" + encodeURIComponent(group),
    );
    if (current !== revision) return;
    $("personal").checked = state.contribution_enabled;
    $("group-enabled").checked = state.group_enabled;
    $("admin").hidden = groups.find((g) => g.id === group)?.role !== "admin";
    usage(state.usage);
    $("private").hidden = false;
  } catch (error) {
    if (current === revision) $("notice").textContent = error.message;
  }
}
$("groups").onchange = () => {
  group = $("groups").value;
  refresh();
};
for (const [id, groupWide] of [
  ["personal", false],
  ["group-enabled", true],
]) {
  $(id).onchange = async () => {
    clear();
    try {
      await api("/api/answers/processing", {
        group,
        enabled: $(id).checked,
        group_wide: groupWide,
      });
      await refresh();
    } catch (error) {
      $("notice").textContent = error.message;
    }
  };
}
$("ask-form").onsubmit = async (event) => {
  event.preventDefault();
  clear();
  const current = revision;
  $("ask").disabled = true;
  $("notice").textContent = "Checking archive evidence…";
  try {
    const result = await api("/api/answers/ask", {
      group,
      question: $("question").value,
    });
    if (current !== revision) return;
    $("notice").textContent =
      result.status === "supported"
        ? "Evidence found."
        : "Not enough evidence.";
    const panel = node("div", "");
    panel.className = "panel";
    panel.append(node("h2", result.message), node("p", result.coverage));
    for (const claim of result.claims) {
      const p = node("p", claim.text + " ");
      for (const id of claim.evidence_ids) {
        const evidence = result.evidence.find((item) => item.id === id);
        const link = node("a", "View supporting record");
        link.href =
          "/answer-evidence?" +
          new URL(evidence.url, location.origin).searchParams;
        p.append(link);
      }
      panel.append(p);
    }
    for (const message of result.uncertainty) panel.append(node("p", message));
    if (result.matching_records > result.shown)
      panel.append(
        node(
          "p",
          `Showing ${result.shown} of ${result.matching_records} matching records.`,
        ),
      );
    $("answer").append(panel);
    usage(result.usage);
  } catch (error) {
    if (current === revision) $("notice").textContent = error.message;
  } finally {
    $("ask").disabled = false;
  }
};
// Discard rendered answers on backgrounding; returning requires fresh authorization.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clear();
  else if (group) refresh();
});
window.addEventListener("pagehide", clear);
window.addEventListener("pageshow", (event) => {
  if (event.persisted && group) refresh();
});
(async () => {
  try {
    groups = await api("/api/groups");
    for (const g of groups) {
      const option = node("option", g.name);
      option.value = g.id;
      $("groups").append(option);
    }
    group = $("groups").value;
    if (group) await refresh();
  } catch (error) {
    $("notice").textContent = error.message + ". Sign in from Imports.";
  }
})();
