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
}: {
  archive: Archive;
  memories: Memory[];
  demo: boolean;
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
  openLink: RefObject<HTMLAnchorElement | null>;
}) {
  const featured = memories[0];
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
        <>
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
                  href={`#/memory/${featured.id}${featured.kind === "memory" && !demo ? "?notebook=1" : ""}`}
                  onClick={link(
                    `/memory/${featured.id}${featured.kind === "memory" && !demo ? "?notebook=1" : ""}`,
                    true,
                  )}
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
          <section
            className="home-selection"
            aria-labelledby="archive-selection-heading"
          >
            <div className="landing-section-heading">
              <h2 id="archive-selection-heading">Arşivden anılar</h2>
              <a
                className="landing-text-link"
                href="#/timeline"
                onClick={link("/timeline")}
              >
                Zaman çizelgesi <Icon name="arrow" size={18} />
              </a>
            </div>
            <div className="home-memory-list">
              {memories.slice(1, 4).map((memory) => (
                <article className="home-memory" key={memory.id}>
                  <div className="home-memory-photo">
                    <Photo
                      photo={memory.photos[0]}
                      openMemory={{
                        id: `home-photo-${memory.id}`,
                        href: `#/memory/${memory.id}`,
                        label: `Anıyı aç: ${memory.title}`,
                        onClick: link(`/memory/${memory.id}`, true),
                      }}
                    />
                  </div>
                  <div>
                    <p className="memory-meta">{metadata(memory)}</p>
                    <h3>
                      <a
                        id={`home-title-${memory.id}`}
                        href={`#/memory/${memory.id}${memory.kind === "memory" && !demo ? "?notebook=1" : ""}`}
                        onClick={link(
                          `/memory/${memory.id}${memory.kind === "memory" && !demo ? "?notebook=1" : ""}`,
                          true,
                        )}
                      >
                        {memory.title}
                      </a>
                    </h3>
                    {memory.kind === "memory" && !demo && (
                      <a
                        id={`home-notes-${memory.id}`}
                        className="landing-text-link"
                        href={`#/memory/${memory.id}?notebook=1`}
                        onClick={link(`/memory/${memory.id}?notebook=1`)}
                      >
                        Notları aç
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {memories.length < 2 && (
              <p className="landing-hint">
                Yeni fotoğraflar ve notlarla bu arşivi birlikte büyütelim.
              </p>
            )}
          </section>
        </>
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
      <aside className="home-contribute">
        <div>
          <h2>Senin hatırladığın ne?</h2>
          <p>
            Bir fotoğraf ekle veya bir anının notlarına kendi hatırladığını
            bırak.
          </p>
        </div>
        <a
          className="button button--secondary"
          href="#/imports"
          onClick={link("/imports")}
        >
          <Icon name="plus" size={18} /> Fotoğraf ekle
        </a>
      </aside>
    </section>
  );
}
