import { useEffect } from "react";
import type { RefObject } from "react";
import type { Memory } from "./memories";
import { displayDate, placeLine } from "./memory/facts";
import { sourceSharedLine } from "./memory/provenance";
import { Photo } from "./Photo";
import type { useArchive } from "./useArchive";
import type { LinkFor } from "./useRoute";
import { Icon } from "./ui/icons";
import "./styles/landing.css";

type Archive = ReturnType<typeof useArchive>;
export function Home({
  archive,
  memories,
  demo,
  link,
  heading,
  openLink,
  restore,
}: {
  restore?: { openerId: string; scroll: number };
  archive: Archive;
  memories: Memory[];
  demo: boolean;
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
  openLink: RefObject<HTMLAnchorElement | null>;
}) {
  const featured = memories[0];
  useEffect(() => {
    const opener = restore && document.getElementById(restore.openerId);
    window.scrollTo(0, opener ? restore.scroll : 0);
    (opener || heading.current)?.focus({ preventScroll: true });
  }, [featured?.id]);
  const circle = demo
    ? "Sample Atlas"
    : archive.groups.find((group) => group.id === archive.group)?.name;
  const metadata = (memory: Memory) =>
    [displayDate(memory), placeLine(memory)].filter(Boolean).join(" · ");
  return (
    <section className="home-landing">
      <header className="landing-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            Birlikte hatırlayalım
          </h1>
          <p>
            {circle
              ? `${circle} için ortak bir yer.`
              : "Anılarımız, fotoğraflarımız ve birbirimize bıraktığımız notlar."}
          </p>
        </div>
        <a
          className="landing-text-link"
          href="#/explore"
          onClick={link("/explore")}
        >
          Tümünü keşfet <Icon name="arrow" size={18} />
        </a>
      </header>
      {archive.status === "loading" ? (
        <p className="landing-status" role="status">
          Anılar yükleniyor…
        </p>
      ) : archive.status === "error" ? (
        <div className="landing-status" role="alert">
          <h2>Arşiv şu anda açılamadı</h2>
          <p>{archive.error}</p>
          <button className="button button--primary" onClick={archive.refresh}>
            Yeniden dene
          </button>
        </div>
      ) : featured ? (
        <article className="home-featured">
          <div className="home-featured-photo">
            <Photo
              photo={featured.photos[0]}
              continuity
              eager
              openMemory={{
                id: "home-featured-photo",
                href: `#/memory/${featured.id}`,
                label: `Anıyı aç: ${featured.title}`,
                onClick: link(`/memory/${featured.id}`, true),
              }}
            />
          </div>
          <div className="home-featured-body">
            <p className="memory-meta">{metadata(featured)}</p>
            <h2>
              <a
                id="home-featured-title"
                href={`#/memory/${featured.id}`}
                onClick={link(`/memory/${featured.id}`, true)}
              >
                {featured.title}
              </a>
            </h2>
            <p className="home-description">{featured.description}</p>
            {sourceSharedLine(featured) && (
              <p className="memory-meta">{sourceSharedLine(featured)}</p>
            )}
            <div className="landing-actions">
              <a
                ref={openLink}
                id="home-featured-open"
                className="button button--primary"
                href={`#/memory/${featured.id}`}
                onClick={link(`/memory/${featured.id}`, true)}
              >
                Anıyı aç <Icon name="arrow" size={18} />
              </a>
              {featured.kind === "memory" && !demo && (
                <a
                  id="home-featured-notes"
                  className="button button--secondary"
                  href={`#/memory/${featured.id}?notebook=1`}
                  onClick={link(`/memory/${featured.id}?notebook=1`)}
                >
                  Notları aç
                </a>
              )}
            </div>
          </div>
        </article>
      ) : (
        <div className="landing-status home-empty">
          <Icon name="people" size={36} />
          <h2>İlk anımızı ekleyelim</h2>
          <p>
            Fotoğraflar ve aktardığınız konuşmalar, hazır oldukça grubunuzla
            paylaşılır.
          </p>
          <a
            className="button button--primary"
            href="#/imports"
            onClick={link("/imports")}
          >
            {archive.group
              ? "Fotoğraf veya arşiv ekle"
              : "Grup oluştur veya katıl"}
          </a>
        </div>
      )}
    </section>
  );
}
