import { useState } from "react";
import type { MouseEventHandler } from "react";
import type { Photo as PhotoData } from "./memories";
import { Glyph } from "./memory/glyphs";
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
      className={`photo-frame${loaded ? " is-loaded" : ""}${failed ? " is-failed" : ""}`}
      style={continuity ? { viewTransitionName: "memory-photo" } : undefined}
      aria-busy={!loaded && !failed}
    >
      {failed ? (
        <div className="photo-error" role="alert">
          <Glyph name="photo-failed" size={34} stroke={1.5} />
          <p className="photo-error-title">This photo could not load.</p>
          <p className="photo-error-hint">
            The connection may have dropped. Try again in a moment.
          </p>
          <button
            type="button"
            className="button button--primary"
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
              <span className="visually-hidden">Loading photograph…</span>
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
