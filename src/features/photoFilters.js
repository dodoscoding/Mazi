const choices = {
  people_present: [
    "İnsan varlığı",
    { yes: "İnsan var", no: "İnsan yok", unknown: "Bilinmiyor" },
  ],
  screenshot: [
    "Ekran görüntüsü",
    { yes: "Evet", no: "Hayır", unknown: "Bilinmiyor" },
  ],
  ai: [
    "AI kullanımı",
    {
      generated: "AI üretimi",
      edited: "AI ile düzenlendi",
      "none-declared": "AI kullanılmadığı beyanı",
      unknown: "Bilinmiyor",
    },
  ],
  person: ["Fotoğraftaki kişi", {}],
};
export function createPhotoFilters(host, search, changed) {
  const restored = new URLSearchParams(search);
  const state = Object.fromEntries(
    Object.keys(choices).map((key) => [
      key,
      new Set((restored.get(key) || "").split(",").filter(Boolean)),
    ]),
  );
  const panel = document.createElement("section");
  panel.className = "photo-filters";
  panel.setAttribute("aria-label", "Fotoğraf filtreleri");
  const chips = document.createElement("div"),
    denominator = document.createElement("p"),
    fields = document.createElement("div");
  panel.append(denominator, chips, fields);
  host.append(panel);
  let facets = {};
  function render() {
    const focused = document.activeElement?.dataset?.photoFilter;
    denominator.textContent =
      facets.denominator === undefined
        ? ""
        : `Sayaçların paydası: görünür ${facets.denominator} fotoğrafın tamamı. Filtrelenmiş toplam ayrıca gösterilir.`;
    chips.replaceChildren();
    fields.replaceChildren();
    for (const [key, [title, names]] of Object.entries(choices)) {
      const field = document.createElement("fieldset"),
        legend = document.createElement("legend");
      legend.textContent = title;
      field.append(legend);
      const options =
        key === "person"
          ? facets.person || []
          : Object.keys(names).map((value) => ({
              value,
              count:
                (facets[key] || []).find((item) => item.value === value)
                  ?.count || 0,
            }));
      for (const option of options) {
        const label = document.createElement("label"),
          input = document.createElement("input");
        input.type = "checkbox";
        input.value = option.value;
        input.dataset.photoFilter = key + ":" + option.value;
        input.checked = state[key].has(option.value);
        input.onchange = () => {
          input.checked
            ? state[key].add(option.value)
            : state[key].delete(option.value);
          render();
          changed();
        };
        label.append(
          input,
          ` ${option.name || names[option.value]} (${option.count})`,
        );
        field.append(label);
      }
      fields.append(field);
      for (const value of state[key]) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.textContent = `${title}: ${names[value] || options.find((item) => item.value === value)?.name || (key === "person" ? "Onaylı kişi" : "Geçersiz seçim")} ×`;
        chip.onclick = () => {
          state[key].delete(value);
          render();
          changed();
        };
        chips.append(chip);
      }
    }
    if (focused)
      [...panel.querySelectorAll("input")]
        .find((input) => input.dataset.photoFilter === focused)
        ?.focus();
  }
  render();
  return {
    apply(params) {
      for (const [key, values] of Object.entries(state))
        values.size
          ? params.set(key, [...values].sort().join(","))
          : params.delete(key);
      return params;
    },
    update(value) {
      facets = value || {};
      render();
    },
    active() {
      return Object.values(state).some((values) => values.size);
    },
    reset(notify = true) {
      Object.values(state).forEach((values) => values.clear());
      render();
      if (notify) changed();
    },
    set(key, values) {
      state[key] = new Set(values);
      render();
    },
  };
}
