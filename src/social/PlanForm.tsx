import { useMemo } from "react";
import type { FormEvent } from "react";
import { wallTime } from "./time";
import type { Draft } from "./types";

export function PlanForm({
  draft,
  onChange,
  onSubmit,
  disabled,
  editing,
  onCancel,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSubmit: (event: FormEvent) => void;
  disabled: boolean;
  editing: boolean;
  onCancel: () => void;
}) {
  const start = useMemo(
    () => wallTime(draft.start_local, draft.timezone),
    [draft.start_local, draft.timezone],
  );
  const end = useMemo(
    () => wallTime(draft.end_local, draft.timezone),
    [draft.end_local, draft.timezone],
  );
  const update = (field: keyof Draft, value: string) =>
    onChange({
      ...draft,
      [field]: value,
      ...(["start_local", "end_local", "timezone"].includes(field)
        ? { start_offset: "", end_offset: "" }
        : {}),
    });
  const offset = (
    label: string,
    field: "start_offset" | "end_offset",
    result: ReturnType<typeof wallTime>,
  ) =>
    result.kind === "gap" ? (
      <p className="plan-error" role="alert">
        {label} saati bu saat diliminde bulunmuyor. Başka bir saat seç.
      </p>
    ) : result.kind === "invalid" ? (
      <p className="plan-error" role="alert">
        Geçerli bir tarih ve IANA saat dilimi seç.
      </p>
    ) : result.offsets.length > 1 ? (
      <label>
        {label} UTC farkı
        <select
          value={draft[field]}
          onChange={(event) => update(field, event.target.value)}
          required
        >
          <option value="">Bu saat iki kez yaşanıyor; birini seç</option>
          {result.offsets.map((value) => (
            <option key={value} value={value}>
              UTC{value}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  return (
    <form className="plan-form" onSubmit={onSubmit}>
      <fieldset disabled={disabled}>
        <legend className="visually-hidden">
          {editing ? "Buluşmayı düzenle" : "Buluşma planla"}
        </legend>
        <label>
          Başlık
          <input
            autoComplete="off"
            name="title"
            autoFocus
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            maxLength={200}
            required
          />
        </label>
        <label>
          Saat dilimi
          <input
            name="timezone"
            list="plan-zones"
            value={draft.timezone}
            onChange={(event) => update("timezone", event.target.value)}
            placeholder="Europe/Istanbul"
            maxLength={100}
            required
            aria-describedby="plan-zone-help"
          />
        </label>
        <datalist id="plan-zones">
          {[
            "Europe/Istanbul",
            "Europe/Copenhagen",
            "Europe/London",
            "America/New_York",
            "Asia/Tokyo",
            "UTC",
          ].map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <p id="plan-zone-help" className="plan-hint">
          Buluşmanın IANA saat dilimini seç. Tarih ve saat bu bölgeye göre
          kaydedilir.
        </p>
        <div className="plan-form-row">
          <label>
            Başlangıç
            <input
              type="datetime-local"
              step={1}
              name="start_local"
              value={draft.start_local}
              onChange={(event) => update("start_local", event.target.value)}
              required
            />
          </label>
          <label>
            Bitiş (isteğe bağlı)
            <input
              type="datetime-local"
              step={1}
              name="end_local"
              value={draft.end_local}
              onChange={(event) => update("end_local", event.target.value)}
            />
          </label>
        </div>
        {offset("Başlangıç", "start_offset", start)}
        {draft.end_local ? offset("Bitiş", "end_offset", end) : null}
        <label>
          Yer (isteğe bağlı)
          <input
            name="place"
            value={draft.place}
            onChange={(event) => update("place", event.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          Açıklama (isteğe bağlı)
          <textarea
            name="description"
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            maxLength={4000}
            rows={4}
          />
        </label>
        <label>
          Anı bağlantısı (isteğe bağlı)
          <input
            name="memory"
            value={draft.memory}
            onChange={(event) => update("memory", event.target.value)}
            maxLength={1000}
            aria-describedby="plan-memory-help"
          />
        </label>
        <p id="plan-memory-help" className="plan-hint">
          Görmeye yetkili olduğun onaylı bir anının bağlantısını veya kimliğini
          ekleyebilirsin. Fotoğraf eklemek zorunlu değil.
        </p>
        <div className="plan-actions">
          <button
            className="button button--primary"
            disabled={
              start.kind !== "valid" ||
              (!!draft.end_local && end.kind !== "valid")
            }
          >
            {editing ? "Değişiklikleri kaydet" : "Buluşmayı oluştur"}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
          >
            Vazgeç
          </button>
        </div>
      </fieldset>
    </form>
  );
}
