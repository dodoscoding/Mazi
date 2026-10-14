let revision = 0;
const record = document.getElementById("record"),
  notice = document.getElementById("notice");
function clear() {
  revision++;
  record.replaceChildren();
  notice.textContent = "";
}
async function load() {
  clear();
  const current = revision;
  try {
    const response = await fetch("/api/answers/evidence" + location.search);
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
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clear();
  else load();
});
window.addEventListener("pagehide", clear);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) load();
});
load();
