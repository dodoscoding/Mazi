import { useEffect, useRef, useState } from "react";

type Snapshot = {
  snapshot: string;
  annotation: { capture_date: string | null; place: string };
  candidates?: string[];
};
export default function PhotoCorrection({
  group,
  asset,
  field,
  close,
}: {
  group: string;
  asset: string;
  field: "capture_date" | "place";
  close: () => void;
}) {
  const [current, setCurrent] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);
  const live = useRef(true);
  const endpoint = "/api/atlas/photo?" + new URLSearchParams({ group, asset });
  async function read(signal: AbortSignal, initialize = false, place?: string) {
    const response = await fetch(
      endpoint + (place ? "&place=" + encodeURIComponent(place) : ""),
      { signal },
    );
    if (signal.aborted || !live.current) return;
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new Event("mazi:access-lost"));
      return;
    }
    if (!response.ok)
      throw Error("Fotoğraf bilgisi yüklenemedi. Yeniden deneyin.");
    const value = (await response.json()) as Snapshot;
    if (signal.aborted || !live.current) return;
    if (place === undefined) setCurrent(value);
    if (initialize) setDraft(value.annotation[field] || "");
    if (value.candidates) setCandidates(value.candidates);
    return value;
  }
  useEffect(() => {
    live.current = true;
    const controller = new AbortController();
    request.current = controller;
    void read(controller.signal, true).catch((error: Error) => {
      if (!controller.signal.aborted) setMessage(error.message);
    });
    const clear = () => {
      live.current = false;
      request.current?.abort();
      setDraft("");
      close();
    };
    for (const event of ["mazi:group", "mazi:session", "mazi:access-lost"])
      window.addEventListener(event, clear);
    return () => {
      live.current = false;
      request.current?.abort();
      for (const event of ["mazi:group", "mazi:session", "mazi:access-lost"])
        window.removeEventListener(event, clear);
    };
  }, [group, asset, field]);
  async function save(value: string) {
    if (!current || busy) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/atlas/photo", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group,
          asset,
          expected_snapshot: current.snapshot,
          changes: {
            [field]: field === "capture_date" ? value || null : value,
          },
        }),
      });
      if (controller.signal.aborted || !live.current) return;
      if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new Event("mazi:access-lost"));
        return;
      }
      if (response.status === 409) {
        await read(controller.signal);
        setMessage(
          "Fotoğraf değişti. Taslağınız korundu; güncel bilgiyle yeniden kaydedin.",
        );
        return;
      }
      if (!response.ok)
        throw Error(
          response.status === 400
            ? "Tarih geçersiz veya yıl dönümü için gerekli. Arşiv incelemesinden yıl dönümünü düzenleyin."
            : "Kaydedilemedi. Taslağınız korundu; yeniden deneyin.",
        );
      window.dispatchEvent(new Event("mazi:archive-changed"));
      close();
    } catch (error) {
      if (!controller.signal.aborted && live.current)
        setMessage((error as Error).message);
    } finally {
      if (!controller.signal.aborted && live.current) setBusy(false);
    }
  }
  return (
    <form
      className="fact photo-correction"
      aria-label="Seçili fotoğrafı düzelt"
      onSubmit={(event) => {
        event.preventDefault();
        void save(draft);
      }}
    >
      <p>Yalnız seçili fotoğraf · 1 fotoğraf</p>
      <label>
        {field === "capture_date" ? "Çekim tarihi" : "Yer"}
        <input
          type={field === "capture_date" ? "date" : "text"}
          maxLength={200}
          value={draft}
          disabled={busy || !current}
          onChange={(event) => {
            setDraft(event.target.value);
            setCandidates([]);
          }}
        />
      </label>
      {field === "place" && (
        <>
          <p>
            Serbest metin saklanır; yalnız eşleşen şehir haritada işaretlenir.
          </p>
          <button
            className="button button--secondary"
            type="button"
            disabled={busy || !current}
            onClick={() => {
              request.current?.abort();
              const controller = new AbortController();
              request.current = controller;
              void read(controller.signal, false, draft).catch(
                (error: Error) => {
                  if (!controller.signal.aborted) setMessage(error.message);
                },
              );
            }}
          >
            Şehir seçenekleri
          </button>
          {candidates.map((candidate) => (
            <button
              className="button button--secondary"
              key={candidate}
              type="button"
              onClick={() => setDraft(candidate)}
            >
              {candidate}
            </button>
          ))}
        </>
      )}
      <button
        className="button button--secondary"
        type="submit"
        disabled={busy || !current}
      >
        Kaydet
      </button>
      <button
        className="button button--secondary"
        type="button"
        disabled={busy || !current}
        onClick={() => {
          setDraft("");
          void save("");
        }}
      >
        Temizle
      </button>
      <button
        className="button button--secondary"
        type="button"
        onClick={close}
      >
        Vazgeç
      </button>
      <p role="status">{message || (!current ? "Yükleniyor…" : "")}</p>
    </form>
  );
}
