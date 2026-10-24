import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { About } from "./About";
import { Browse } from "./Browse";
import { Entry, Introduction } from "./Entry";
import { FeaturePage } from "./features";
import { createDiscordReturn } from "./features/discordReturn";
import { isFeaturePath } from "./featureRoutes";
import { ArchiveStatus, Home } from "./Home";
import { MemoryNotFound, MemoryView } from "./MemoryView";
import { Shell } from "./Shell";
import { SoundController } from "./sound/SoundController";
import { useArchive } from "./useArchive";
import { useEntry } from "./useEntry";
import { useReducedMotion, useRoute } from "./useRoute";
import { useWorkDrain } from "./useWorkDrain";

export default function App() {
  const discordReturn = useRef(createDiscordReturn(location.search));
  useEffect(() => {
    const clear = () => discordReturn.current.clear();
    window.addEventListener("mazi:access-lost", clear);
    return () => {
      window.removeEventListener("mazi:access-lost", clear);
    };
  }, []);
  const reduced = useReducedMotion();
  const { route, navigate } = useRoute(reduced);
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  const entry = useEntry();
  const profile =
    entry.state.status === "ready" ? entry.state.profile : undefined;
  useLayoutEffect(() => {
    if (profile) discordReturn.current.bind(profile.user_id);
    else if (entry.state.status === "signed-out") discordReturn.current.clear();
  }, [profile?.user_id, entry.state.status]);
  const archive = useArchive(route.path, demo && !!profile, profile?.group_id);
  useWorkDrain(!!profile);
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
  const navigateTo = (url: string, animate = false, replace = false) => {
    if (route.path === "/") homeScroll.current = window.scrollY;
    navigate(url, animate, replace);
  };
  function link(url: string, animate = false, replace = false) {
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
      navigateTo(url, animate, replace);
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
  if (route.path === "/introduction")
    content = <Introduction onContinue={() => navigate("/")} />;
  else if (route.path === "/about")
    content = (
      <About
        profileName={profile?.display_name || ""}
        circle={
          demo
            ? "Sample Atlas"
            : archive.groups.find((group) => group.id === archive.group)
                ?.name || "your circle"
        }
        link={link}
        heading={heading}
        onSignOut={() => {
          void entry.logout();
        }}
      />
    );
  else if (isFeaturePath(route.path, demo))
    content = (
      <FeaturePage
        key={route.path}
        path={route.path + route.search}
        discordReturn={discordReturn.current}
      />
    );
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
  let screen: ReactNode;
  if (entry.state.status === "onboarding")
    screen = (
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
  else if (entry.state.status === "loading")
    screen = (
      <main className="entry-page">
        <p role="status">Opening Mazi…</p>
      </main>
    );
  else if (entry.state.status !== "ready") screen = <Entry entry={entry} />;
  else
    screen = (
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
  return (
    <>
      <SoundController
        reduced={reduced}
        route={{
          // Entry and onboarding are not the Atlas, whatever the URL says.
          path: entry.state.status === "ready" ? route.path : "",
          portal: new URLSearchParams(route.search).get("view") === "portal",
          selected: selected?.id,
          year: selected?.year,
        }}
      />
      {screen}
    </>
  );
}
