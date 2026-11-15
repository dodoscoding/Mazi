import { useEffect, useRef } from "react";
import { createLifecycle } from "./lifecycle";
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
  "/imports": { template: importsTemplate, mount: importsMount },
  "/circle": { template: importsTemplate, mount: importsMount },
  "/review": { template: archiveTemplate, mount: archiveMount },
  "/places": { template: placesTemplate, mount: placesMount },
  "/discover": { template: discoveryTemplate, mount: discoveryMount },
  "/search": { template: discoveryTemplate, mount: discoveryMount },
  "/ask": { template: answersTemplate, mount: answersMount },
  "/answer-evidence": { template: evidenceTemplate, mount: evidenceMount },
  "/memories": { template: memoriesTemplate, mount: memoriesMount },
};
export const featurePaths = Object.keys(featureRegistry);
export function FeaturePage({ path }: { path: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current!;
    const [pathname, query] = path.split("?");
    const feature = featureRegistry[pathname as keyof typeof featureRegistry];
    if (!feature) return;
    const discardWhenHidden =
      pathname === "/ask" || pathname === "/answer-evidence";
    let disposed = false;
    let accessDenied = false;
    let lifecycle: ReturnType<typeof createLifecycle> | undefined;
    let observer: MutationObserver | undefined;
    const mount = () => {
      if (disposed) return;
      accessDenied = false;
      observer?.disconnect();
      lifecycle?.dispose();
      container.replaceChildren();
      if (document.hidden && discardWhenHidden) return;
      const root = document.createElement("section");
      root.className = "feature-content";
      root.innerHTML = feature.template;
      container.append(root);
      lifecycle = createLifecycle(root, query ? `?${query}` : "", mount);
      const rewriteLinks = () =>
        root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
          const href = link.getAttribute("href")!;
          const target = href.split("?")[0];
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
      accessDenied = true;
      clear();
      const message = document.createElement("p");
      message.setAttribute("role", "status");
      message.textContent =
        "Your session or access changed. Sign in again to continue.";
      const link = document.createElement("a");
      link.href = "#/imports";
      link.textContent = "Sign in";
      link.addEventListener("click", () => {
        if (pathname === "/imports" || pathname === "/circle") mount();
      });
      container.append(message, link);
    };
    const groupChanged = () =>
      queueMicrotask(() => {
        if (!accessDenied) mount();
      });
    const visibility = () => {
      if (accessDenied || !discardWhenHidden) return;
      if (document.hidden) clear();
      else mount();
    };
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !accessDenied) mount();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("mazi:group", groupChanged);
    window.addEventListener("mazi:access-lost", accessLost);
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", pageShow);
    mount();
    return () => {
      disposed = true;
      clear();
      window.removeEventListener("mazi:group", groupChanged);
      window.removeEventListener("mazi:access-lost", accessLost);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", pageShow);
    };
  }, [path]);
  return <div ref={host} className="feature-page" />;
}
export default FeaturePage;
