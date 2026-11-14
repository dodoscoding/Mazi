import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { SoundToggle } from "./sound/SoundToggle";
import { primaryDestinations, sectionFor } from "./navigation";
import { Icon } from "./ui/icons";
import { Menu } from "./ui/Menu";
import { ToastProvider } from "./ui/Toast";
import type { useArchive } from "./useArchive";
import type { LinkFor } from "./useRoute";
import "./styles/shell.css";

type Archive = ReturnType<typeof useArchive>;
export function Shell({
  path,
  demo,
  archive,
  profileName,
  link,
  onSignOut,
  children,
}: {
  path: string;
  demo: boolean;
  archive: Archive;
  profileName: string;
  link: LinkFor;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const main = useRef<HTMLElement>(null);
  const routePath = path.split("?")[0];
  const lastPath = useRef(routePath);
  useLayoutEffect(() => {
    const previous = lastPath.current;
    lastPath.current = routePath;
    if (
      previous === routePath ||
      previous.startsWith("/memory/") ||
      routePath.startsWith("/memory/") ||
      typeof main.current?.animate !== "function"
    )
      return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    main.current.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "none" },
          ],
      {
        duration: reduced ? 160 : 320,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
  }, [routePath]);
  const section = sectionFor(path);
  const circle = demo
    ? "Sample Atlas"
    : archive.groups.find((group) => group.id === archive.group)?.name;
  const primaryLinks = primaryDestinations.map((entry) => (
    <a
      key={entry.path}
      href={`#${entry.path}`}
      onClick={link(entry.path)}
      aria-current={section === entry.section ? "page" : undefined}
    >
      <Icon name={entry.icon} size={22} />
      <span>{entry.label}</span>
    </a>
  ));
  return (
    <ToastProvider>
      <div
        className="shell"
        data-section={routePath === "/" ? "home" : routePath.split("/")[1]}
      >
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          İçeriğe geç
        </a>
        <header className="site-header">
          <div className="header-start">
            <a
              className="wordmark"
              href="#/"
              onClick={link("/")}
              aria-label="Mazi ana sayfa"
            >
              Mazi
            </a>
            <nav aria-label="Main navigation" className="primary-nav">
              {primaryLinks}
            </nav>
          </div>
          <div className="header-end">
            {circle && <span className="hud-label circle-name">{circle}</span>}
            <a
              className="shell-search"
              href="#/search"
              onClick={link("/search")}
              aria-label="Anı ara"
            >
              <Icon name="search" size={20} />
              <span>Anı ara</span>
            </a>
            <Menu label="Ekle" className="add-menu">
              {(close) => (
                <nav aria-label="Ekle seçenekleri" className="menu-list">
                  <a
                    className="menu-item"
                    href="#/add"
                    onClick={(event) => {
                      link("/add")(event);
                      close();
                    }}
                  >
                    Add
                  </a>
                  <a
                    className="menu-item"
                    href="#/imports"
                    onClick={(event) => {
                      link("/imports")(event);
                      close();
                    }}
                  >
                    Fotoğraf veya arşiv
                  </a>
                  <a
                    className="menu-item"
                    href="#/circle?section=plans&new=1"
                    onClick={(event) => {
                      link("/circle?section=plans&new=1")(event);
                      close();
                    }}
                  >
                    Buluşma planla
                  </a>
                </nav>
              )}
            </Menu>
            <Menu label="Hesap" className="account-menu">
              {(close) => (
                <nav aria-label="Hesap araçları" className="menu-list">
                  <p className="account-name">{profileName}</p>
                  <a
                    className="menu-item"
                    href="#/settings"
                    onClick={(event) => {
                      link("/settings")(event);
                      close();
                    }}
                  >
                    Settings
                  </a>
                  <a
                    className="menu-item"
                    href="#/about"
                    onClick={(event) => {
                      link("/about")(event);
                      close();
                    }}
                  >
                    Yardım ve gizlilik
                  </a>
                  <a
                    className="menu-item"
                    href="#/introduction"
                    onClick={(event) => {
                      link("/introduction")(event);
                      close();
                    }}
                  >
                    Tanıtımı izle
                  </a>
                  <SoundToggle
                    variant="pill"
                    className="button button--secondary account-sound"
                  />
                  {!demo &&
                    !path.startsWith("/settings") &&
                    archive.groups.length > 0 && (
                      <label className="circle-picker">
                        Grubumuz
                        <select
                          aria-label="Grup değiştir"
                          value={archive.group}
                          onChange={(event) =>
                            archive.chooseGroup(event.target.value)
                          }
                        >
                          {archive.groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  {demo && (
                    <a className="menu-item" href="/">
                      Örnek arşivden çık
                    </a>
                  )}
                  <button
                    type="button"
                    className="menu-item menu-sign-out"
                    onClick={onSignOut}
                  >
                    Çıkış yap
                  </button>
                </nav>
              )}
            </Menu>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} ref={main}>
          {children}
        </main>
        <footer className="site-footer">
          <span>
            Mazi <span className="footer-dot" /> The Atlas of Us
          </span>
          <span>
            {demo
              ? "Sample Atlas · Fictional memories & AI-generated photographs"
              : "Your shared archive · Private to your circle"}
          </span>
        </footer>
        <nav aria-label="Main navigation" className="tab-bar">
          {primaryLinks}
        </nav>
      </div>
    </ToastProvider>
  );
}
