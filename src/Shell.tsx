import type { ReactNode } from "react";
import type { useArchive } from "./useArchive";
import type { LinkFor } from "./useRoute";
import "./styles/shell.css";

export function Shell({
  path,
  demo,
  archive,
  link,
  onSignOut,
  children,
}: {
  path: string;
  demo: boolean;
  archive: ReturnType<typeof useArchive>;
  link: LinkFor;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const navLink = (url: string, label: string) => (
    <a
      href={`#${url}`}
      onClick={link(url)}
      aria-current={path === url ? "page" : undefined}
    >
      {label}
    </a>
  );
  return (
    <>
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
        <a
          className="wordmark"
          href="#/"
          onClick={link("/")}
          aria-label="Mazi home"
        >
          mazi
        </a>
        <nav aria-label="Main navigation">
          {navLink("/", "Home")}
          {navLink("/timeline", "Timeline")}
          {navLink("/search", "Search")}
          <span className="imports-link">
            {navLink("/imports", "My Imports")}
          </span>
        </nav>
        <a className="circle-link" href="#/circle" onClick={link("/circle")}>
          <span className="circle-emblem" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Our circle{" "}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="m3 6 5 5 5-5" />
          </svg>
        </a>
      </header>
      <div
        className="archive-navigation"
        role="region"
        aria-label="Archive navigation"
      >
        <nav aria-label="Archive tools">
          {navLink("/memories", "Memories")}
          {navLink("/review", "Archive review")}
          {navLink("/places", "Places & sources")}
          {navLink("/ask", "Ask your archive")}
          {navLink("/about", "About")}
          <button onClick={onSignOut}>Sign out</button>
        </nav>
        {!demo && archive.groups.length > 0 && (
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
        )}
        {demo && <a href="/">Leave sample Atlas</a>}
      </div>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer>
        <span>
          Mazi <span className="footer-dot" /> The Atlas of Us
        </span>
        <span>
          {demo
            ? "Sample Atlas · Fictional memories & AI-generated photographs"
            : "Your shared archive · Private to your circle"}
        </span>
        <a
          className="mobile-imports"
          href="#/imports"
          onClick={link("/imports")}
        >
          My Imports
        </a>
      </footer>
    </>
  );
}
