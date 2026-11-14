import "./labels.css";
type Dimension = "people_present" | "screenshot" | "ai";
type Entry = {
  value: string;
  declared: string;
  revision: number;
  method: string | null;
  actor: { name: string } | null;
};
type Item = {
  assetId: string;
  people: { id: string; name: string }[];
  labels: Record<Dimension, Entry>;
};
let editorId = 0;
const dimensions: Record<Dimension, [string, [string, string][]]> = {
  people_present: [
    "İnsan varlığı",
    [
      ["yes", "İnsan var"],
      ["no", "İnsan yok"],
      ["unknown", "Bilinmiyor"],
    ],
  ],
  screenshot: [
    "Ekran görüntüsü",
    [
      ["yes", "Evet"],
      ["no", "Hayır"],
      ["unknown", "Bilinmiyor"],
    ],
  ],
  ai: [
    "AI kullanımı",
    [
      ["generated", "AI üretimi"],
      ["edited", "AI ile düzenlendi"],
      ["none-declared", "AI kullanılmadığı beyan edildi"],
      ["unknown", "Bilinmiyor"],
    ],
  ],
};
function option(text: string, value: string) {
  const node = document.createElement("option");
  node.textContent = text;
  node.value = value;
  return node;
}
const name = (dimension: Dimension, value: string) =>
  dimensions[dimension][1].find(([key]) => key === value)?.[1] || "Bilinmiyor";
export function mountLabelEditor(
  host: HTMLElement,
  options: {
    group: string;
    assets: string[];
    fetch?: typeof fetch;
    onSaved: () => void;
    onClose: () => void;
  },
) {
  if (
    !options.assets.length ||
    options.assets.length > 50 ||
    new Set(options.assets).size !== options.assets.length
  )
    throw Error("1–50 fotoğraf seçin.");
  const apiFetch = options.fetch || fetch;
  let active = true,
    busy = false,
    items: Item[] = [],
    pending: object | null = null;
  const controller = new AbortController();
  const changes: Partial<Record<Dimension, string>> = {};
  const form = document.createElement("form");
  form.className = "photo-label-editor";
  form.setAttribute("aria-label", "Fotoğraf etiketlerini düzenle");
  const title = document.createElement("h3");
  title.textContent = `${options.assets.length} fotoğrafın etiketleri`;
  const facts = document.createElement("div");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const controls: HTMLSelectElement[] = [];
  const id = ++editorId;
  form.append(title, facts);
  for (const dimension of Object.keys(dimensions) as Dimension[]) {
    const label = document.createElement("label");
    label.textContent = dimensions[dimension][0];
    const select = document.createElement("select");
    select.disabled = true;
    select.id = `photo-label-${id}-${dimension}`;
    label.htmlFor = select.id;
    select.append(
      option("Değiştirme", ""),
      ...dimensions[dimension][1].map(([key, text]) => option(text, key)),
    );
    select.onchange = () => {
      if (select.value) changes[dimension] = select.value;
      else delete changes[dimension];
      pending = null;
    };
    controls.push(select);
    form.append(label, select);
  }
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Etiketleri kaydet";
  save.disabled = true;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Vazgeç";
  close.onclick = options.onClose;
  form.append(save, close, status);
  host.replaceChildren(form);
  function enabled() {
    save.disabled = busy || !items.length;
    controls.forEach((control) => (control.disabled = busy || !items.length));
  }
  async function load() {
    const response = await apiFetch(
      "/api/social/labels?" +
        new URLSearchParams({
          group: options.group,
          assets: JSON.stringify(options.assets),
        }),
      { signal: controller.signal },
    );
    if (!active) return;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        dispose();
        options.onClose();
        window.dispatchEvent(new Event("mazi:access-lost"));
      }
      throw Error("Seçili fotoğraflar yüklenemedi; erişimi kontrol edin.");
    }
    const data = (await response.json()) as { items: Item[] };
    if (!active) return;
    items = data.items;
    facts.replaceChildren();
    items.forEach((item, index) => {
      const detail = document.createElement("details");
      detail.open = items.length === 1;
      const summary = document.createElement("summary");
      summary.textContent = `Fotoğraf ${index + 1} · Geçerli bilgi`;
      detail.append(summary);
      for (const dimension of Object.keys(dimensions) as Dimension[]) {
        const entry = item.labels[dimension];
        const line = document.createElement("p");
        line.textContent = `${dimensions[dimension][0]}: ${name(dimension, entry.value)} · Beyan: ${name(dimension, entry.declared)} · ${entry.method === "member" ? "Üye beyanı" : "Beyan yok"}${entry.actor ? " · " + entry.actor.name : ""}`;
        detail.append(line);
      }
      if (item.people.length) {
        const line = document.createElement("p");
        line.textContent = "İnsan varlığı onaylı kişi etiketlerinden gelir: ";
        for (const person of item.people) {
          const link = document.createElement("a");
          link.textContent = person.name;
          link.href = "#/photos?person=" + encodeURIComponent(person.id);
          line.append(link, " ");
        }
        detail.append(line);
      }
      facts.append(detail);
    });
    const manage = document.createElement("a");
    manage.href = "#/settings";
    manage.textContent = "Kişi ve kimlik ayarlarını aç";
    facts.append(manage);
    enabled();
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy || !items.length || !Object.keys(changes).length) {
      status.textContent = "Değiştirilecek alanı seçin.";
      return;
    }
    busy = true;
    enabled();
    status.textContent = "Kaydediliyor…";
    pending ||= {
      group: options.group,
      request_key: crypto.randomUUID(),
      items: items.map((item) => ({
        asset: item.assetId,
        changes: { ...changes },
        expected: Object.fromEntries(
          Object.keys(changes).map((dimension) => [
            dimension,
            item.labels[dimension as Dimension].revision,
          ]),
        ),
      })),
    };
    try {
      const response = await apiFetch("/api/social/labels/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
        signal: controller.signal,
      });
      if (!active) return;
      if (response.status === 409) {
        pending = null;
        await load();
        if (active)
          status.textContent =
            "Bilgi değişti veya onaylı kişi etiketiyle çelişiyor. Seçim yeniden okundu; taslağınız korundu.";
        return;
      }
      if (response.status === 401 || response.status === 403) {
        await load();
        return;
      }
      if (!response.ok)
        throw Error("Kaydedilemedi. Taslağınız korundu; yeniden deneyin.");
      if (active) {
        options.onSaved();
        options.onClose();
      }
    } catch (error) {
      if (active) status.textContent = (error as Error).message;
    } finally {
      busy = false;
      if (active) enabled();
    }
  };
  function clear() {
    dispose();
    options.onClose();
  }
  function dispose() {
    active = false;
    controller.abort();
    items = [];
    pending = null;
    host.replaceChildren();
    for (const event of ["mazi:group", "mazi:session", "mazi:access-lost"])
      window.removeEventListener(event, clear);
  }
  for (const event of ["mazi:group", "mazi:session", "mazi:access-lost"])
    window.addEventListener(event, clear);
  status.textContent = "Yükleniyor…";
  void load()
    .then(() => {
      if (active)
        status.textContent =
          "Yalnız seçtiğiniz alanlar değişir. Bilinmiyor seçimi beyanı temizler.";
    })
    .catch((error: Error) => {
      if (active) status.textContent = error.message;
    });
  return dispose;
}
