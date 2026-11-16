import { createConversationSearch } from "./search";
import { createGallery } from "../memories/gallery";
import "../memories/memories.css";
import "./photos.css";

export function mount(root, lifecycle) {
  root.querySelector("#retired-answers").hidden =
    new URLSearchParams(lifecycle.search).get("retired") !== "answers";
  root.querySelector("#photos-search").hidden = new URLSearchParams(
    lifecycle.search,
  ).has("recap");
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  if (demo) {
    const note = document.createElement("p");
    note.setAttribute("role", "status");
    note.textContent =
      "Sample Atlas · Fictional photographs only. Capture dates are unknown; live archive and source operations are unavailable.";
    root.prepend(note);
    root.querySelector("#filters-open").hidden = true;
  }
  const api = async (path) => {
    if (demo) return (await import("./sample")).sampleRead(path);
    const response = await lifecycle.fetch(path);
    const value = await response.json();
    if (!response.ok) {
      const error = Error(value.error || "Fotoğraflar yüklenemedi");
      error.code = value.code;
      throw error;
    }
    return value;
  };
  const conversations = createConversationSearch(root, lifecycle, api);
  const gallery = createGallery(root, lifecycle, api, {
    readOnly: demo,
    onSearch: conversations.search,
    onReset: conversations.clear,
  });
  let group = demo ? "sample" : lifecycle.groupId;
  let active = true;
  const load = async () => {
    if (!group) group = (await api("/api/session")).group_id;
    if (active) await gallery.load(group);
  };
  const refresh = () => void load().catch(() => {});
  const visible = () => {
    if (!document.hidden) refresh();
  };
  for (const event of ["mazi:archive-changed", "pageshow"])
    window.addEventListener(event, refresh);
  document.addEventListener("visibilitychange", visible);
  lifecycle.onDispose(() => {
    active = false;
    for (const event of ["mazi:archive-changed", "pageshow"])
      window.removeEventListener(event, refresh);
    document.removeEventListener("visibilitychange", visible);
  });
  refresh();
}
