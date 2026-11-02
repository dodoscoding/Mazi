import type { RefObject } from "react";
import { exploreDestinations } from "./navigation";
import type { LinkFor } from "./useRoute";
import { Icon } from "./ui/icons";
import "./styles/landing.css";

export function Explore({
  link,
  heading,
}: {
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className="explore-page">
      <header className="landing-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            Keşfet
          </h1>
          <p>Bir anıyı bul, bir yere dön veya birlikte bir hikâye yaz.</p>
        </div>
      </header>
      <nav className="destination-grid" aria-label="Keşfet araçları">
        {exploreDestinations.map((entry, index) => (
          <a
            aria-label={entry.label}
            aria-describedby={`destination-description-${index}`}
            className="destination-link"
            key={entry.path}
            href={`#${entry.path}`}
            onClick={link(entry.path)}
          >
            <span>
              <strong>{entry.label}</strong>
              <span id={`destination-description-${index}`}>
                {entry.description}
              </span>
            </span>
            <Icon name="arrow" size={20} />
          </a>
        ))}
      </nav>
    </section>
  );
}
