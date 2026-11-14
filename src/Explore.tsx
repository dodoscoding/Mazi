import type { RefObject } from "react";
import { exploreDestinations, exploreGroups } from "./navigation";
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
      <nav aria-label="Keşfet araçları">
        {exploreGroups.map((group) => (
          <section
            className="destination-group"
            key={group.id}
            aria-labelledby={`explore-${group.id}`}
          >
            <header className="landing-section-heading">
              <div>
                <h2 id={`explore-${group.id}`}>{group.label}</h2>
                <p>{group.description}</p>
              </div>
            </header>
            <div className="destination-grid">
              {exploreDestinations
                .filter((entry) => entry.group === group.id)
                .map((entry, index) => (
                  <a
                    aria-label={entry.label}
                    aria-describedby={`destination-${group.id}-${index}`}
                    className="destination-link"
                    key={entry.path}
                    href={`#${entry.path}`}
                    onClick={link(entry.path)}
                  >
                    <span>
                      <strong>{entry.label}</strong>
                      <span id={`destination-${group.id}-${index}`}>
                        {entry.description}
                      </span>
                    </span>
                    <Icon name="arrow" size={20} />
                  </a>
                ))}
            </div>
          </section>
        ))}
      </nav>
    </section>
  );
}
