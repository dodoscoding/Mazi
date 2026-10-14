import { useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Browse } from "./Browse";
import { Entry, Introduction } from "./Entry";
import { FeaturePage } from "./features";
import { ArchiveStatus, Home } from "./Home";
import { MemoryNotFound, MemoryView } from "./MemoryView";
import { Shell } from "./Shell";
import { useArchive } from "./useArchive";
import { useEntry } from "./useEntry";
import { useReducedMotion, useRoute } from "./useRoute";

const featurePaths = [
  "/imports",
  "/circle",
  "/review",
  "/places",
  "/discover",
  "/ask",
  "/answer-evidence",
  "/memories",
];

export default function App() {
  const reduced = useReducedMotion();
  const { route, navigate } = useRoute(reduced);
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  const entry = useEntry();
  const profile =
    entry.state.status === "ready" ? entry.state.profile : undefined;
  const archive = useArchive(route.path, demo && !!profile, profile?.group_id);
  useLayoutEffect(() => {
    if (
      entry.state.status === "ready" &&
      ["/login", "/welcome"].includes(route.path)
    )
      navigate("/", false, true);
  }, [entry.state.status, route.path, navigate]);
  const memories = archive.memories;
  const memoryById = (id: string) => memories.find((item) => item.id === id);
  const memoryId = route.path.startsWith("/memory/") ? route.path.slice(8) : "";
  const memory = memoryById(memoryId);
  const selected = memoryById(route.selected) || memories[0];
  const [query, setQuery] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const openLink = useRef<HTMLAnchorElement>(null);
  const previousPath = useRef(route.path);
  const homeScroll = useRef(0);
  const navigateTo = (url: string, animate = false) => {
    if (route.path === "/") homeScroll.current = window.scrollY;
    navigate(url, animate);
  };
  function link(url: string, animate = false) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      navigateTo(url, animate);
    };
  }
  useLayoutEffect(() => {
    const oldPath = previousPath.current;
    previousPath.current = route.path;
    if (route.path === "/" && oldPath.startsWith("/memory/")) {
      window.scrollTo(0, homeScroll.current);
      openLink.current?.focus({ preventScroll: true });
    } else if (route.path !== "/") {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    }
  }, [route.path, memory?.id]);
  const chooseMemory = (id: string) =>
    navigate(`/?selected=${id}`, false, true);
  const backUrl = `/?selected=${memory?.id || selected?.id || ""}`;
  let content: ReactNode;
  if (route.path === "/about")
    content = <Introduction onContinue={() => navigate("/")} />;
  else if (
    featurePaths.includes(route.path) ||
    (route.path === "/search" && !demo)
  )
    content = <FeaturePage key={route.path} path={route.path + route.search} />;
  else if (archive.status !== "ready")
    content = <ArchiveStatus archive={archive} heading={heading} />;
  else if (route.path === "/")
    content = (
      <Home
        archive={archive}
        memories={memories}
        selected={selected}
        demo={demo}
        reduced={reduced}
        link={link}
        chooseMemory={chooseMemory}
        heading={heading}
        openLink={openLink}
      />
    );
  else if (memory)
    content = (
      <MemoryView
        memory={memory}
        memories={memories}
        photo={route.photo}
        demo={demo}
        backUrl={backUrl}
        link={link}
        navigate={navigate}
        heading={heading}
      />
    );
  else if (route.path === "/timeline" || route.path === "/search")
    content = (
      <Browse
        isSearch={route.path === "/search"}
        memories={memories}
        demo={demo}
        query={query}
        setQuery={setQuery}
        link={link}
        heading={heading}
      />
    );
  else content = <MemoryNotFound link={link} heading={heading} />;
  if (entry.state.status === "onboarding")
    return (
      <main className="entry-page">
        <Introduction
          pending={entry.state.pending}
          error={entry.state.error}
          onContinue={() => {
            void entry.complete().then((completed) => {
              if (completed) navigate("/");
            });
          }}
        />
      </main>
    );
  if (entry.state.status === "loading")
    return (
      <main className="entry-page">
        <p role="status">Opening Mazi…</p>
      </main>
    );
  if (entry.state.status !== "ready") return <Entry entry={entry} />;
  return (
    <Shell
      path={route.path}
      demo={demo}
      archive={archive}
      profileName={entry.state.profile.display_name}
      link={link}
      onSignOut={() => {
        void entry.logout();
      }}
    >
      {content}
    </Shell>
  );
}
