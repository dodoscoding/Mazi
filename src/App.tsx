import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent, ReactNode } from "react";
import { About } from "./About";
import { RouteBoundary } from "./RouteBoundary";
import { Entry, Introduction } from "./Entry";
import { createDiscordReturn } from "./features/discordReturn";
import { isFeaturePath } from "./featureRoutes";
import { ArchiveStatus, Atlas } from "./Atlas";
import { usePlacedMemories } from "./atlas/PlaceMemories";
import { Shell } from "./Shell";
import { SoundController } from "./sound/SoundController";
import { useArchive } from "./useArchive";
import { useEntry } from "./useEntry";
import { useReducedMotion, useRoute } from "./useRoute";
import { useWorkDrain } from "./useWorkDrain";

const FeaturePage = lazy(() =>
  import("./features").then(({ FeaturePage }) => ({ default: FeaturePage })),
);
const ParallelPage = lazy(() => import("./parallel/ParallelPage"));
const LegacyEvidence = lazy(() => import("./LegacyEvidence"));
const SelectedMemory = lazy(() => import("./memory/SelectedMemory"));
const PastCreations = lazy(() => import("./PastCreations"));

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
  const { memories, placed } = usePlacedMemories(
    archive.memories,
    archive.group,
  );
  const memoryById = (id: string) => memories.find((item) => item.id === id);
  const memoryId = route.path.startsWith("/memory/") ? route.path.slice(8) : "";
  const selected = new URLSearchParams(route.search).has("selected")
    ? memoryById(route.selected)
    : memories[0];
  const heading = useRef<HTMLHeadingElement>(null);
  const openLink = useRef<HTMLAnchorElement>(null);
  const previousPath = useRef(route.path);
  const browsingReturn = useRef<{
    path: string;
    url: string;
    scroll: number;
    openerId: string;
  } | null>(null);
  const retainedBrowse = useRef<ReactNode>(null);
  const [, invalidateBrowse] = useState(0);
  useEffect(() => {
    const clear = () => {
      retainedBrowse.current = null;
      browsingReturn.current = null;
      invalidateBrowse((value) => value + 1);
    };
    const events = [
      "mazi:access-lost",
      "mazi:session",
      "mazi:group",
      "mazi:archive-changed",
    ];
    events.forEach((event) => window.addEventListener(event, clear));
    return () =>
      events.forEach((event) => window.removeEventListener(event, clear));
  }, []);
  const navigateTo = (
    url: string,
    animate = false,
    replace = false,
    openerId = "",
  ) => {
    if (!route.path.startsWith("/memory/") && url.startsWith("/memory/")) {
      const active = document.activeElement;
      if (
        !openerId &&
        active instanceof HTMLElement &&
        active !== document.body
      ) {
        active.id ||= "globe-viewer-origin";
        openerId = active.id;
      }
      browsingReturn.current = {
        path: route.path,
        url: location.hash.slice(1) || route.path + route.search,
        scroll: window.scrollY,
        openerId: openerId || browsingReturn.current?.openerId || "",
      };
    } else if (
      !url.startsWith("/memory/") &&
      url !== browsingReturn.current?.url
    )
      browsingReturn.current = null;
    navigate(url, animate, replace);
  };
  // Feature galleries use ordinary hash links; capture their origin before routing.
  useEffect(() => {
    const remember = (event: globalThis.MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        route.path.startsWith("/memory/")
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href^="#/memory/"]')
          : null;
      if (!anchor) return;
      anchor.id ||= "viewer-origin";
      browsingReturn.current = {
        path: route.path,
        url: location.hash.slice(1) || route.path + route.search,
        scroll: window.scrollY,
        openerId: anchor.id,
      };
    };
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, [route.path, route.search]);
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
      navigateTo(url, animate, replace, event.currentTarget.id);
    };
  }
  useLayoutEffect(() => {
    const oldPath = previousPath.current;
    previousPath.current = route.path;
    const saved = browsingReturn.current;
    if (saved && saved.path === route.path && oldPath.startsWith("/memory/")) {
      window.scrollTo(0, saved.scroll);
      const opener =
        document.getElementById(saved.openerId) || openLink.current;
      opener?.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    }
  }, [route.path]);
  const chooseMemory = (id: string) =>
    navigate(`/?selected=${encodeURIComponent(id)}`, false, true);
  const backUrl = browsingReturn.current?.url || "/";
  let content: ReactNode;
  if (route.path === "/introduction")
    content = (
      <Introduction
        onContinue={() =>
          navigate(
            new URLSearchParams(route.search).get("return") === "settings"
              ? "/settings"
              : "/",
          )
        }
      />
    );
  else if (
    archive.status === "ready" &&
    route.path !== "/answer-evidence" &&
    new URLSearchParams(route.search).has("group") &&
    new URLSearchParams(route.search).get("group") !== archive.group
  )
    content = (
      <section className="not-found">
        <h1 ref={heading} tabIndex={-1}>
          Bu bağlantı artık kullanılamıyor
        </h1>
        <p>Bağlantı mevcut grubunuza ait değil. Başka bir kayıt açılmadı.</p>
        <a href="#/settings" onClick={link("/settings")}>
          Settings
        </a>
      </section>
    );
  else if (route.path === "/parallel" && profile)
    content = (
      <Suspense fallback={<p role="status">Opening Parallel You…</p>}>
        <ParallelPage
          key={profile.user_id}
          memberId={profile.user_id}
          demo={demo}
        />
      </Suspense>
    );
  else if (demo && !["/", "/photos"].includes(route.path) && !memoryId)
    content = (
      <section className="not-found">
        <h1 ref={heading} tabIndex={-1}>
          Sample Atlas
        </h1>
        <p>
          Örnek arşivde Globe, Photos ve fotoğraf görüntüleyici kullanılabilir.
          Canlı arşiv işlemleri örnek modunda açılmaz.
        </p>
        <a href="#/photos" onClick={link("/photos")}>
          Photos
        </a>
      </section>
    );
  else if (new URLSearchParams(route.search).has("unavailable"))
    content = (
      <section className="not-found">
        <h1 ref={heading} tabIndex={-1}>
          Bu bağlantı artık kullanılamıyor
        </h1>
        <p>
          Bu eski hedef kaldırıldı. Kayıt başka bir fotoğrafla eşleştirilmedi.
        </p>
        <a href="#/photos" onClick={link("/photos")}>
          Photos
        </a>
      </section>
    );
  else if (route.path === "/about" || route.path === "/settings")
    content = (
      <>
        {route.path === "/settings" && (
          <Suspense fallback={<p role="status">Settings açılıyor…</p>}>
            <FeaturePage
              key={`${profile?.user_id}:settings`}
              path="/settings"
            />
            <FeaturePage path="/settings" settingsControls />
            <PastCreations
              key={`${profile?.user_id}:${archive.group}:past-link`}
              group={archive.group}
              preview
            />
          </Suspense>
        )}
        <About
          settings={route.path === "/settings"}
          profileName={profile?.display_name || ""}
          circle={
            demo
              ? "Örnek Atlas"
              : archive.groups.find((group) => group.id === archive.group)
                  ?.name || "grubumuz"
          }
          link={link}
          heading={heading}
          onSignOut={() => {
            void entry.logout();
          }}
        />
      </>
    );
  else if (route.path === "/past-creations")
    content = (
      <Suspense fallback={<p role="status">Loading Past creations…</p>}>
        <PastCreations
          key={`${profile?.user_id}:${archive.group}:${route.search}`}
          group={archive.group}
          search={route.search}
        />
      </Suspense>
    );
  else if (route.path === "/answer-evidence")
    content =
      archive.status !== "ready" ? (
        <ArchiveStatus archive={archive} heading={heading} />
      ) : (
        <Suspense fallback={<p role="status">Kaynak kontrol ediliyor…</p>}>
          <LegacyEvidence
            group={archive.group}
            search={route.search}
            navigate={navigate}
            link={link}
          />
        </Suspense>
      );
  else if (isFeaturePath(route.path, demo))
    content = (
      <Suspense fallback={<p role="status">Sayfa açılıyor…</p>}>
        <FeaturePage
          key={route.path}
          path={route.path + route.search}
          discordReturn={discordReturn.current}
        />
      </Suspense>
    );
  else if (archive.status !== "ready")
    content = <ArchiveStatus archive={archive} heading={heading} />;
  else if (
    route.path === "/" &&
    (new URLSearchParams(route.search).has("selected") ||
      new URLSearchParams(route.search).has("photo")) &&
    (!selected ||
      (new URLSearchParams(route.search).has("photo") &&
        !new URLSearchParams(route.search).has("selected")) ||
      (new URLSearchParams(route.search).has("photo") &&
        (!Number.isInteger(route.photo) ||
          route.photo < 0 ||
          route.photo >= selected.photos.length)))
  )
    content = (
      <section className="not-found">
        <h1 ref={heading} tabIndex={-1}>
          Fotoğraf kullanılamıyor
        </h1>
        <p>Seçilen kayıt bulunamadı veya bu grupta erişilemiyor.</p>
        <a href="#/" onClick={link("/")}>
          Globe
        </a>
      </section>
    );
  else if (route.path === "/")
    content = (
      <Atlas
        archive={archive}
        memories={memories}
        selected={selected}
        demo={demo}
        reduced={reduced}
        link={link}
        chooseMemory={chooseMemory}
        openMemory={(id) => navigateTo(`/memory/${id}?photo=${route.photo}`)}
        onPlaced={placed}
        heading={heading}
        openLink={openLink}
      />
    );
  else if (memoryId)
    content = (
      <Suspense fallback={<p role="status">Anı açılıyor…</p>}>
        <SelectedMemory
          key={`${profile?.user_id}:${archive.group}:${memoryId}`}
          id={memoryId}
          memory={demo ? memoryById(memoryId) : undefined}
          group={archive.group}
          demo={demo}
          sessionKey={profile?.user_id}
          search={route.search}
          notebook={route.notebook}
          photo={route.photo}
          memories={memories}
          backUrl={backUrl}
          link={link}
          navigate={navigate}
          heading={heading}
        />
      </Suspense>
    );
  else
    content = (
      <section className="not-found">
        <h1 ref={heading} tabIndex={-1}>
          Sayfa bulunamadı
        </h1>
        <a href="#/" onClick={link("/")}>
          Ana sayfaya dön
        </a>
      </section>
    );
  if (
    !memoryId &&
    !(
      retainedBrowse.current &&
      browsingReturn.current?.url === route.path + route.search
    )
  )
    retainedBrowse.current = content;
  const viewerOpen = !!memoryId;
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
        <p role="status">Mazi açılıyor…</p>
      </main>
    );
  else if (entry.state.status !== "ready") screen = <Entry entry={entry} />;
  else
    screen = (
      <Shell
        path={route.path + route.search}
        demo={demo}
        archive={archive}
        profileName={entry.state.profile.display_name}
        link={link}
        onSignOut={() => {
          void entry.logout();
        }}
      >
        <div key={`${profile?.user_id}:${archive.group}`} hidden={viewerOpen}>
          <RouteBoundary
            key={viewerOpen ? browsingReturn.current?.path : route.path}
          >
            {retainedBrowse.current}
          </RouteBoundary>
        </div>
        {viewerOpen && (
          <RouteBoundary key={`${profile?.user_id}:${route.path}`}>
            {content}
          </RouteBoundary>
        )}
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
