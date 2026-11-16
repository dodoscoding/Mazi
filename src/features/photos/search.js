import { sourceContext } from "../sourceContext";

export function createConversationSearch(root, lifecycle, api) {
  const $ = (id) => root.querySelector(`#${id}`);
  let revision = 0,
    active = true,
    next = null,
    currentGroup = "",
    currentParams = new URLSearchParams();
  let contextRevision = 0,
    opener = null,
    scroll = 0;
  const close = (restore = true) => {
    contextRevision++;
    $("source-context").hidden = true;
    $("source-content").replaceChildren();
    if (restore) {
      window.scrollTo(0, scroll);
      opener?.focus({ preventScroll: true });
    }
  };
  $("source-close").onclick = () => close();
  const escape = (event) => {
    if (event.key === "Escape" && !$("source-context").hidden) {
      event.preventDefault();
      close();
    }
  };
  root.addEventListener("keydown", escape);
  lifecycle.onDispose(() => {
    active = false;
    revision++;
    contextRevision++;
    root.removeEventListener("keydown", escape);
  });
  const open = async (id, button) => {
    close(false);
    opener = button;
    scroll = window.scrollY;
    const expected = contextRevision;
    $("source-context").hidden = false;
    $("source-content").textContent = "Kaynak bağlamı yükleniyor…";
    $("source-context").focus({ preventScroll: true });
    $("source-context").scrollIntoView({ block: "start" });
    try {
      const value = await api(
        "/api/discovery/context?" +
          new URLSearchParams({ group: currentGroup, record: id }),
      );
      if (!active || expected !== contextRevision) return;
      $("source-content").replaceChildren(sourceContext(value));
    } catch {
      if (active && expected === contextRevision)
        $("source-content").textContent =
          "Bu kaynak bağlamı şu anda kullanılamıyor veya erişimin değişmiş olabilir. Kapatıp aramayı yeniden deneyin.";
    }
  };
  const load = async (append = false) => {
    const expected = ++revision;
    next = null;
    $("conversation-more").hidden = $("conversation-retry").hidden = true;
    if (!append) $("conversation-list").replaceChildren();
    $("conversation-status").textContent = "Konuşmalar aranıyor…";
    try {
      const value = await api("/api/discovery/conversations?" + currentParams);
      if (!active || expected !== revision) return;
      for (const item of value.items) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${item.sender} · ${item.sharedAt || "Paylaşım tarihi bilinmiyor"} · ${item.text}`;
        button.onclick = () => void open(item.id, button);
        $("conversation-list").append(button);
      }
      next = value.next_cursor;
      $("conversation-more").hidden = next === null;
      $("conversation-status").textContent = !value.complete
        ? "Diğer kaynak kayıtları henüz aranmadı. Aramayı sürdürmek için diğer sonuçları getirin."
        : $("conversation-list").childElementCount
          ? "Erişilebilir kaynak kayıtlarında arama tamamlandı."
          : "Eşleşen konuşma yok.";
    } catch {
      if (!active || expected !== revision) return;
      $("conversation-status").textContent =
        "Konuşmalar yüklenemedi. Fotoğraf aramanız korunur; yeniden deneyin.";
      $("conversation-retry").hidden = false;
    }
  };
  $("conversation-more").onclick = () => {
    if (next !== null) {
      currentParams.set("cursor", next);
      void load(true);
    }
  };
  $("conversation-retry").onclick = () => {
    currentParams.delete("cursor");
    void load();
  };
  const search = (params, group) => {
    revision++;
    close(false);
    $("conversation-list").replaceChildren();
    $("conversation-results").hidden = !params.get("query")?.trim();
    if ($("conversation-results").hidden) return;
    currentGroup = group;
    currentParams = new URLSearchParams({ group, query: params.get("query") });
    for (const key of ["source", "shared_by"])
      if (params.has(key)) currentParams.set(key, params.get(key));
    const photoOnly =
      [
        "years",
        "places",
        "place",
        "country",
        "object_query",
        "uncertain",
        "people_present",
        "screenshot",
        "ai",
        "person",
        "start",
        "end",
        "undated",
      ].some((key) => params.has(key)) || $("photos-year").value === "undated";
    $("conversation-scope").textContent = photoOnly
      ? "Konuşmalar sözcük, kaynak ve paylaşan filtreleriyle aranır. Yıl, çekim tarihi, yer ve fotoğraf etiketleri yalnız fotoğraflara uygulanır."
      : "Erişilebilir kaynak mesajları; sözcük, kaynak ve paylaşan filtreleri uygulanır.";
    void load();
  };
  const clear = () => {
    revision++;
    close(false);
    $("conversation-list").replaceChildren();
    $("conversation-status").textContent = "";
    $("conversation-results").hidden = true;
  };
  return { search, clear };
}
