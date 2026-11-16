import { useEffect, useRef, useState } from "react";

type Contribution = { id: string; filename: string };
export default function PhotoContributions({
  group,
  asset,
  close,
}: {
  group: string;
  asset: string;
  close: () => void;
}) {
  const [items, setItems] = useState<Contribution[] | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const live = useRef(false);
  async function load(signal: AbortSignal) {
    const response = await fetch(
      "/api/review/my-contributions?" + new URLSearchParams({ group, asset }),
      { signal, cache: "no-store" },
    );
    if (!live.current || signal.aborted) return;
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new Event("mazi:access-lost"));
      return;
    }
    if (!response.ok) throw Error("Katkılarınız yüklenemedi. Yeniden deneyin.");
    const value = (await response.json()) as Contribution[];
    if (live.current && !signal.aborted) setItems(value);
  }
  function retry() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setMessage("");
    void load(controller.signal).catch((error: Error) => {
      if (live.current && !controller.signal.aborted) setMessage(error.message);
    });
  }
  useEffect(() => {
    live.current = true;
    retry();
    const clear = () => {
      live.current = false;
      request.current?.abort();
      setItems(null);
      setPending(null);
      close();
    };
    const events = ["mazi:access-lost", "mazi:session", "mazi:group"];
    events.forEach((event) => window.addEventListener(event, clear));
    return () => {
      live.current = false;
      request.current?.abort();
      events.forEach((event) => window.removeEventListener(event, clear));
    };
  }, [group, asset]);
  async function remove(id: string) {
    if (busy) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/review/delete-contribution", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: id }),
      });
      if (!live.current || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new Event("mazi:access-lost"));
        return;
      }
      if (!response.ok)
        throw Error(
          "Katkı kaldırılamadı. Paylaşımınızı kontrol edip yeniden deneyin.",
        );
      setItems((current) => current?.filter((item) => item.id !== id) || []);
      setPending(null);
      window.dispatchEvent(new Event("mazi:archive-changed"));
    } catch (error) {
      if (live.current && !controller.signal.aborted)
        setMessage((error as Error).message);
    } finally {
      if (live.current && !controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="fact photo-correction photo-contributions"
      aria-label="Seçili fotoğrafa katkılarım"
    >
      <p>
        Yalnız kendi kaynak kaydınızı kaldırırsınız. Başkasının bağımsız katkısı
        paylaşılmaya devam eder.
      </p>
      {items?.map((item) => (
        <div key={item.id}>
          <p>{item.filename}</p>
          {pending === item.id ? (
            <>
              <p>
                Bu kaynak kaydı ve ona ait konuşma bağlamı gruptan kaldırılacak.
              </p>
              <button
                type="button"
                className="button button--secondary"
                disabled={busy}
                onClick={() => void remove(item.id)}
              >
                Paylaşımı kaldır
              </button>
              <button
                type="button"
                className="button button--secondary"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                Vazgeç
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={() => setPending(item.id)}
            >
              Katkıyı kaldır
            </button>
          )}
        </div>
      ))}
      {items?.length === 0 && (
        <p>
          Bu fotoğrafta etkin katkınız yok. Bağımsız katkılar paylaşılmaya devam
          eder.
        </p>
      )}
      <p role="status">{message || (items === null ? "Yükleniyor…" : "")}</p>
      {message && (
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={retry}
        >
          Yeniden dene
        </button>
      )}
      <button
        type="button"
        className="button button--secondary"
        onClick={close}
      >
        Kapat
      </button>
    </section>
  );
}
