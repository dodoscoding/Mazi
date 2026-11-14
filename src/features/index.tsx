import { useEffect, useRef } from "react";
import { createLifecycle } from "./lifecycle";
import { createDiscordReturn, type DiscordReturn } from "./discordReturn";
import importsTemplate from "./imports/template.html?raw";
import archiveTemplate from "./archive/template.html?raw";
import placesTemplate from "./places/template.html?raw";
import discoveryTemplate from "./discovery/template.html?raw";
import answersTemplate from "./answers/template.html?raw";
import evidenceTemplate from "./evidence/template.html?raw";
import memoriesTemplate from "./memories/template.html?raw";
import { mount as importsMount } from "./imports/mount";
import { mount as archiveMount } from "./archive/mount";
import { mount as placesMount } from "./places/mount";
import { mount as discoveryMount } from "./discovery/mount";
import { mount as answersMount } from "./answers/mount";
import { mount as evidenceMount } from "./evidence/mount";
import { mount as memoriesMount } from "./memories/mount";
import "./features.css";
import "./workspace.css";
import "./imports/imports.css";

export const featureRegistry = {
  "/add": { template: importsTemplate, mount: importsMount },
  "/imports": { template: importsTemplate, mount: importsMount },
  "/circle": { template: importsTemplate, mount: importsMount },
  "/settings": { template: importsTemplate, mount: importsMount },
  "/review": { template: archiveTemplate, mount: archiveMount },
  "/places": { template: placesTemplate, mount: placesMount },
  "/discover": { template: discoveryTemplate, mount: discoveryMount },
  "/search": { template: discoveryTemplate, mount: discoveryMount },
  "/ask": { template: answersTemplate, mount: answersMount },
  "/answer-evidence": { template: evidenceTemplate, mount: evidenceMount },
  "/memories": { template: memoriesTemplate, mount: memoriesMount },
};
export const featurePaths = Object.keys(featureRegistry);
export function FeaturePage({
  path,
  discordReturn,
}: {
  path: string;
  discordReturn?: DiscordReturn;
}) {
  const host = useRef<HTMLDivElement>(null);
  const localReturn = useRef(createDiscordReturn(location.search));
  const returned = discordReturn || localReturn.current;
  useEffect(() => {
    const container = host.current!;
    const [pathname, query] = path.split("?");
    const add = pathname === "/add";
    const sources =
      add && new URLSearchParams(query).get("section") === "sources";
    const feature = sources
      ? featureRegistry["/places"]
      : featureRegistry[pathname as keyof typeof featureRegistry];
    if (!feature) return;
    let disposed = false;
    let mounted = false;
    let lifecycle: ReturnType<typeof createLifecycle> | undefined;
    let observer: MutationObserver | undefined;
    const mount = () => {
      if (disposed) return;
      observer?.disconnect();
      lifecycle?.dispose();
      container.replaceChildren();
      const root = document.createElement("section");
      root.className = "feature-content";
      root.innerHTML = feature.template;
      if (add) {
        root.dataset.surface = "add";
        const navigation = document.createElement("nav");
        navigation.className = "add-sections";
        navigation.setAttribute("aria-label", "Add sections");
        for (const [label, href, current] of [
          ["Imports", "#/add", !sources],
          ["Source connections", "#/add?section=sources", sources],
        ] as const) {
          const link = document.createElement("a");
          link.textContent = label;
          link.href = href;
          if (current) link.setAttribute("aria-current", "page");
          navigation.append(link);
        }
        root.querySelector(".fx-head")?.after(navigation);
      }
      container.append(root);
      lifecycle = createLifecycle(
        root,
        query ? `?${query}` : "",
        mount,
        returned,
        mounted ? "refresh" : "entry",
      );
      mounted = true;
      const rewriteLinks = () =>
        root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
          const href = link.getAttribute("href")!;
          const target = href.split("?")[0];
          if (add && (target === "/imports" || target === "/")) {
            link.setAttribute("href", "#/add");
            if (sources) link.textContent = "Back to imports";
            return;
          }
          if (add && target === "/places") {
            link.setAttribute("href", "#/add?section=sources");
            link.textContent = "Connect in Add";
            return;
          }
          if (target === "/" || featurePaths.includes(target))
            link.setAttribute("href", `#${target === "/" ? "/imports" : href}`);
        });
      observer = new MutationObserver(rewriteLinks);
      observer.observe(root, { childList: true, subtree: true });
      rewriteLinks();
      root.addEventListener("change", (event) => {
        const target = event.target;
        if (target instanceof HTMLSelectElement && target.id === "groups") {
          sessionStorage.setItem("mazi.group", target.value);
          window.dispatchEvent(new Event("mazi:group"));
        }
      });
      root.addEventListener("click", (event) => {
        const button = (event.target as Element).closest("button");
        if (button?.id === "logout")
          window.dispatchEvent(new Event("mazi:session"));
      });
      feature.mount(root, lifecycle);
    };
    const clear = () => {
      observer?.disconnect();
      lifecycle?.dispose();
      container.replaceChildren();
    };
    const accessLost = () => {
      returned.clear();
      clear();
      const message = document.createElement("p");
      message.setAttribute("role", "status");
      message.textContent =
        "Your session or access changed. Sign in again to continue.";
      const link = document.createElement("a");
      link.href = "#/imports";
      link.textContent = "Sign in";
      link.addEventListener("click", () => {
        if (
          pathname === "/add" ||
          pathname === "/imports" ||
          pathname === "/circle"
        )
          mount();
      });
      container.append(message, link);
    };
    const groupChanged = () => queueMicrotask(mount);
    window.addEventListener("mazi:group", groupChanged);
    window.addEventListener("mazi:access-lost", accessLost);
    mount();
    return () => {
      disposed = true;
      clear();
      window.removeEventListener("mazi:group", groupChanged);
      window.removeEventListener("mazi:access-lost", accessLost);
    };
  }, [path, returned]);
  return <div ref={host} className="feature-page" />;
}
export default FeaturePage;
