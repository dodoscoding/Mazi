import { initials } from "./ui/initials";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SoundToggle } from "./sound/SoundToggle";
import { useTheme } from "./theme/useTheme";
import { IconButton } from "./ui/Button";
import { Icon } from "./ui/icons";
import type { IconName } from "./ui/icons";
import { Menu } from "./ui/Menu";
import { Sheet } from "./ui/Sheet";
import { ToastProvider } from "./ui/Toast";
import type { useArchive } from "./useArchive";
import type { LinkFor } from "./useRoute";
import "./styles/shell.css";

type Archive = ReturnType<typeof useArchive>;
const tools: [string, string][] = [
  ["/memories", "Memories"],
  ["/discover", "Discover"],
  ["/ask", "Ask your archive"],
  ["/review", "Archive review"],
  ["/places", "Places & sources"],
];
const tabs: [string, string, IconName][] = [
  ["/", "Home", "home"],
  ["/timeline", "Timeline", "timeline"],
  ["/search", "Search", "search"],
  ["/imports", "Imports", "imports"],
];

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const next = theme === "night" ? "day" : "night";
  const label = `Switch to ${next}`;
  const icon = next === "day" ? "sun" : "moon";
  if (!compact)
    return (
      <IconButton
        icon={icon}
        label={label}
        className="hud-button"
        onClick={toggle}
      />
    );
  return (
    <button
      type="button"
      className="button button--secondary theme-pill"
      aria-label={label}
      onClick={toggle}
    >
      <Icon name={icon} size={14} />
      {next === "day" ? "Day" : "Night"}
    </button>
  );
}

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
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = () => setMoreOpen(false);
  useEffect(() => {
    const phone = matchMedia("(max-width: 600px)");
    const close = () => {
      if (!phone.matches) setMoreOpen(false);
    };
    phone.addEventListener("change", close);
    return () => phone.removeEventListener("change", close);
  }, []);
  const main = useRef<HTMLElement>(null);
  const lastPath = useRef(path);
  useLayoutEffect(() => {
    const previous = lastPath.current;
    lastPath.current = path;
    setMoreOpen(false);
    // Memory routes have their own photo morph; other screen changes rise 8px and fade in.
    if (
      previous === path ||
      previous.startsWith("/memory/") ||
      path.startsWith("/memory/") ||
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
  }, [path]);
  const section = path === "/" ? "home" : path.split("/")[1];
  const circle = demo
    ? "Sample Atlas"
    : archive.groups.find((group) => group.id === archive.group)?.name;
  const navLink = (
    url: string,
    label: string,
    className = "",
    after?: () => void,
  ) => (
    <a
      key={url + label}
      className={className || undefined}
      href={`#${url}`}
      onClick={(event) => {
        link(url)(event);
        after?.();
      }}
      aria-current={path === url ? "page" : undefined}
    >
      {label}
    </a>
  );
  const circlePicker = !demo && archive.groups.length > 0 && (
    <label className="circle-picker">
      Current circle
      <select
        aria-label="Current circle"
        value={archive.group}
        onChange={(event) => archive.chooseGroup(event.target.value)}
      >
        {archive.groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </label>
  );
  const moreActive =
    moreOpen ||
    [
      "/circle",
      "/about",
      "/introduction",
      "/answer-evidence",
      ...tools.map(([url]) => url),
    ].includes(path);
  const activeTab = (url: string) =>
    !moreOpen &&
    (url === "/" ? path === "/" || path.startsWith("/memory/") : path === url);
  return (
    <ToastProvider>
      <div className="shell" data-section={section}>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          Skip to content
        </a>
        <header className="site-header">
          <div className="header-start">
            <a
              className="wordmark"
              href="#/"
              onClick={link("/")}
              aria-label="Mazi home"
            >
              Mazi
            </a>
            <nav aria-label="Main navigation" className="primary-nav">
              {navLink("/", "Home")}
              {navLink("/timeline", "Timeline")}
              {navLink("/search", "Search")}
              {navLink("/imports", "My Imports", "nav-wide")}
              {navLink("/circle", "Our circle", "nav-wide")}
            </nav>
            <Menu label="Archive tools" className="tools-menu">
              {(close) => (
                <nav aria-label="Archive tools" className="menu-list">
                  <div className="menu-narrow">
                    {navLink("/imports", "My Imports", "menu-item", close)}
                    {navLink("/circle", "Our circle", "menu-item", close)}
                    <div className="menu-separator" />
                  </div>
                  {tools.map(([url, label]) =>
                    navLink(url, label, "menu-item", close),
                  )}
                  <div className="menu-separator" />
                  {navLink("/about", "About", "menu-item menu-quiet", close)}
                  <div className="menu-separator" />
                  {circlePicker}
                  <button
                    type="button"
                    className="menu-item menu-sign-out"
                    onClick={onSignOut}
                  >
                    Sign out
                  </button>
                </nav>
              )}
            </Menu>
          </div>
          <div className="header-end">
            {circle && <span className="hud-label circle-name">{circle}</span>}
            {demo && (
              <a className="leave-demo" href="/">
                Leave sample Atlas
              </a>
            )}
            <ThemeToggle />
            <SoundToggle className="hud-button" />
            <span
              className="avatar"
              role="img"
              aria-label={`Signed in as ${profileName}`}
            >
              {initials(profileName)}
            </span>
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
          {tabs.map(([url, label, icon]) => (
            <a
              key={url}
              href={`#${url}`}
              onClick={link(url)}
              aria-current={activeTab(url) ? "page" : undefined}
              aria-label={url === "/imports" ? "My Imports" : undefined}
            >
              <Icon name={icon} size={22} />
              {label}
            </a>
          ))}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={moreActive ? "is-active" : undefined}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <Icon name="more" size={22} />
            More
          </button>
        </nav>
        <Sheet
          open={moreOpen}
          onClose={closeMore}
          label="More"
          className="more-sheet"
        >
          <div className="sheet-header">
            <h2 className="sheet-title">More</h2>
            <div className="sheet-controls">
              <ThemeToggle compact />
              <SoundToggle
                variant="pill"
                className="button button--secondary theme-pill"
              />
            </div>
          </div>
          <nav aria-label="Archive tools" className="more-list">
            {tools.map(([url, label]) => navLink(url, label, "", closeMore))}
            {navLink("/circle", "Our circle", "", closeMore)}
            {navLink("/about", "About", "more-quiet", closeMore)}
          </nav>
          {circlePicker}
          <div className="more-footer">
            {navLink(
              "/introduction",
              "Replay introduction",
              "replay-link",
              closeMore,
            )}
            {demo && <a href="/">Leave sample Atlas</a>}
            <button
              type="button"
              className="button button--danger"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        </Sheet>
      </div>
    </ToastProvider>
  );
}
