import { useEffect, useState } from "react";
import type { LinkFor } from "./useRoute";

/** Old evidence URLs identify a photograph, never a guessed conversation record. */
export default function LegacyEvidence({
  group,
  search,
  navigate,
  link,
}: {
  group: string;
  search: string;
  navigate: (url: string, animate?: boolean, replace?: boolean) => void;
  link: LinkFor;
}) {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    setUnavailable(false);
    const params = new URLSearchParams(search);
    const asset = params.get("asset");
    if (
      !group ||
      params.get("group") !== group ||
      !asset ||
      asset.length > 200
    ) {
      setUnavailable(true);
      return;
    }
    const memory = `photo-${asset}`;
    void fetch("/api/atlas/memory?" + new URLSearchParams({ group, memory }), {
      signal: request.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const value = await response.json();
        if (request.signal.aborted) return;
        if (
          value.memory?.id !== memory ||
          value.memory.photos?.length !== 1 ||
          value.memory.photos[0].assetId !== asset
        )
          throw Error();
        navigate(`/memory/${encodeURIComponent(memory)}`, false, true);
      })
      .catch(() => {
        if (!request.signal.aborted) setUnavailable(true);
      });
    return () => request.abort();
  }, [group, search, navigate]);
  if (!unavailable)
    return <p role="status">Kaynak fotoğraf kontrol ediliyor…</p>;
  return (
    <section className="not-found">
      <h1>Eski kanıt bağlantısı kullanılamıyor</h1>
      <p>
        AI yanıtları kaldırıldı. Bu bağlantı mevcut grupta erişilebilir bir
        kaynak fotoğrafı güvenle belirlemiyor.
      </p>
      <a href="#/photos?search=1" onClick={link("/photos?search=1")}>
        Fotoğraf ve konuşmalarda ara
      </a>
    </section>
  );
}
