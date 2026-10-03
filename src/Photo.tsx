import { useState } from "react";
import type { MouseEventHandler } from "react";
import type { Photo as PhotoData } from "./memories";
export function Photo({
  photo,
  continuity = false,
  eager = false,
  openMemory,
}: {
  photo: PhotoData;
  continuity?: boolean;
  eager?: boolean;
  openMemory?: {
    href: string;
    label: string;
    onClick: MouseEventHandler<HTMLAnchorElement>;
  };
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const photograph = (
    <img
      key={attempt}
      src={photo.src}
      alt={photo.alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      onLoad={() => setLoaded(true)}
      onError={() => {
        setFailed(true);
        setLoaded(false);
      }}
    />
  );
  return (
    <div
      className={`photo-frame ${loaded ? "is-loaded" : ""}`}
      style={continuity ? { viewTransitionName: "memory-photo" } : undefined}
      aria-busy={!loaded && !failed}
    >
      {failed ? (
        <div className="photo-error">
          <p>This photo could not load.</p>
          <button
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            Retry photo
          </button>
        </div>
      ) : (
        <>
          {!loaded && (
            <span className="photo-loading" role="status">
              Loading photograph…
            </span>
          )}
          {openMemory ? (
            <a
              className="feature-photo-link"
              href={openMemory.href}
              aria-label={openMemory.label}
              onClick={openMemory.onClick}
            >
              {photograph}
            </a>
          ) : (
            photograph
          )}
        </>
      )}
    </div>
  );
}
