import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useToast } from "../ui/Toast";
import { FlatMap } from "./FlatMap";
import type { GlobeProps, Layout } from "./Globe";
import { loadLand } from "./land";
import type { Land } from "./land";
import type { AtlasModel } from "./model";

const createGlobe = () => lazy(() => import("./Globe"));

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type StageView = "globe" | "flat";

/**
 * The globe, or the flat map when 3D is unavailable or chosen. Owns WebGL failure,
 * context loss and retry, and pauses drawing while off-screen or hidden.
 */
export function AtlasStage({
  atlas,
  selectedPlace,
  focusPlace,
  year,
  day,
  reduced,
  layout,
  portal,
  introStart,
  born,
  thumbnails,
  view,
  onView,
  onPick,
  onFailedChange,
  retryKey,
  compact = false,
}: Omit<
  GlobeProps,
  "land" | "active" | "onReady" | "onLost" | "framing" | "interactive"
> & {
  view: StageView;
  onView: (view: StageView) => void;
  onFailedChange: (failed: boolean) => void;
  /** Bumped by the Globe button to retry 3D after a failure. */
  retryKey: number;
  /** A display-only globe framed for a panel, with a one-line flat-view note. */
  compact?: boolean;
}) {
  const toast = useToast();
  const [Globe, setGlobe] = useState(createGlobe);
  const [land, setLand] = useState<Land | null>(null);
  const [failed, setFailed] = useState(
    () => new URLSearchParams(location.search).get("scene") === "off",
  );
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(!document.hidden);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    // The land outline is the heaviest request; let the page's own assets land first.
    const start = () =>
      void loadLand(controller.signal).then((value) => {
        if (alive) setLand(value);
      });
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });
    return () => {
      alive = false;
      controller.abort();
      removeEventListener("load", start);
    };
  }, [attempt]);
  useEffect(() => onFailedChange(failed), [failed, onFailedChange]);
  useEffect(() => {
    let intersecting = true;
    const update = () => setActive(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    if (region.current) observer.observe(region.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const lost = useCallback(() => {
    setFailed(true);
    setReady(false);
    toast.show({
      message: "The globe stopped drawing, so the atlas is laid flat.",
    });
  }, [toast]);
  const markReady = useCallback(() => setReady(true), []);
  const retry = useCallback(() => {
    // React.lazy retains rejection, so an explicit retry needs a fresh identity.
    setGlobe(createGlobe);
    setFailed(false);
    setReady(false);
    setAttempt((value) => value + 1);
    onView("globe");
  }, [onView]);
  const lastRetry = useRef(retryKey);
  useEffect(() => {
    if (retryKey === lastRetry.current) return;
    lastRetry.current = retryKey;
    retry();
  }, [retryKey, retry]);
  const flat = failed || view === "flat";
  return (
    <div
      className="atlas-stage"
      ref={region}
      data-flat={flat || undefined}
      data-ready={ready || flat || undefined}
    >
      <div className="stage-halo" aria-hidden="true" />
      {flat ? (
        <FlatMap
          atlas={atlas}
          land={land}
          selectedPlace={selectedPlace}
          focusPlace={focusPlace}
          year={year}
          onPick={onPick}
        />
      ) : (
        <SceneBoundary key={attempt} onError={lost}>
          <Suspense fallback={null}>
            <Globe
              atlas={atlas}
              land={land}
              selectedPlace={selectedPlace}
              focusPlace={focusPlace}
              year={year}
              day={day}
              reduced={reduced}
              layout={layout as Layout}
              portal={portal}
              introStart={introStart}
              active={active}
              born={born}
              thumbnails={thumbnails}
              onPick={onPick}
              onReady={markReady}
              onLost={lost}
              framing={compact ? "panel" : "atlas"}
              interactive={!compact}
            />
          </Suspense>
        </SceneBoundary>
      )}
      {!flat && !ready && (
        <p className="scene-loading" role="status">
          Drawing your atlas…
        </p>
      )}
      {failed && compact && (
        <p className="flat-note is-compact" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l9 16H3z" />
            <path d="M12 10v4M12 17v.5" />
          </svg>
          3D isn't available here; same timeline, flat map.
        </p>
      )}
      {failed && !compact && (
        <div className="flat-note" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l9 16H3z" />
            <path d="M12 10v4M12 17v.5" />
          </svg>
          <p>
            <b>The atlas is in flat view.</b> This browser couldn't load or draw
            the globe, so you're seeing the same atlas laid flat. The list,
            years, search and memories all work. If retrying doesn't help,
            reload the page to get the latest globe files.
          </p>
          <button
            type="button"
            className="button button--secondary"
            onClick={retry}
          >
            Retry 3D view
          </button>
        </div>
      )}
    </div>
  );
}
