import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useReducedMotion } from "../useRoute";
import { IntroGlobe } from "./IntroGlobe";
import {
  beats,
  ControlsPanel,
  MemoryPanel,
  SourcesPanel,
  type Beat,
} from "./beats";

const SWIPE = 48;

function Copy({
  beat,
  className,
  ...props
}: {
  beat: Beat;
  className: string;
  "aria-hidden"?: boolean;
  "data-dir"?: number;
}) {
  return (
    <div className={`intro-copy ${className}`} {...props}>
      <p className="intro-topic">{beat.topic}</p>
      <h1 tabIndex={-1}>{beat.title}</h1>
      <p className="intro-text">
        <span className="intro-long">{beat.copy}</span>
        <span className="intro-short">{beat.short}</span>
      </p>
      {beat.note && (
        <div role="note" className="intro-note">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="9" cy="9" r="3" />
            <circle cx="17" cy="10" r="2.2" />
            <path d="M3 19c1-3 3.3-4.5 6-4.5s5 1.5 6 4.5" />
          </svg>
          <span>{beat.note}</span>
        </div>
      )}
    </div>
  );
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function Introduction({
  onContinue,
  pending,
  error,
}: {
  onContinue: () => void;
  pending?: boolean;
  error?: string;
}) {
  const reduced = useReducedMotion();
  const [{ index, previous, dir }, setStep] = useState({
    index: 0,
    previous: -1,
    dir: 0,
  });
  const primary = useRef<HTMLButtonElement>(null);
  const section = useRef<HTMLElement>(null);
  const refocus = useRef(false);
  const touch = useRef<{ x: number; y: number; id: number } | null>(null);
  const last = index === beats.length - 1;
  const step = `Step ${index + 1} of ${beats.length}`;

  const go = (delta: number) => {
    refocus.current = !!section.current?.contains(document.activeElement);
    setStep((current) => {
      const next = current.index + delta;
      if (next < 0 || next >= beats.length) return current;
      return { index: next, previous: current.index, dir: delta };
    });
  };

  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body)
      section.current
        ?.querySelector<HTMLElement>(".intro-copy.is-current h1")
        ?.focus({ preventScroll: true });
  }, []);

  // A beat change can unmount the focused Back or skip button.
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (refocus.current && (!active || active === document.body))
      primary.current?.focus();
    refocus.current = false;
  }, [index]);

  useEffect(() => {
    if (previous < 0) return;
    const timer = setTimeout(
      () => setStep((current) => ({ ...current, previous: -1 })),
      reduced ? 200 : 480,
    );
    return () => clearTimeout(timer);
  }, [index, previous, reduced]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTyping(event.target)
      )
        return;
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else return;
      event.preventDefault();
    };
    addEventListener("keydown", keydown);
    return () => removeEventListener("keydown", keydown);
  }, []);

  const pointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    touch.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const pointerUp = (event: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5)
      go(dx < 0 ? 1 : -1);
  };

  return (
    <section
      ref={section}
      className="intro"
      data-beat={index + 1}
      aria-label="Introduction"
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerCancel={() => (touch.current = null)}
    >
      <IntroGlobe beat={index} reduced={reduced} />
      <div className="intro-fade" aria-hidden="true" />
      <div className="intro-header">
        <span className="intro-wordmark">Mazi</span>
        {!last && (
          <button
            type="button"
            className="intro-skip"
            disabled={pending}
            onClick={onContinue}
          >
            Open the Atlas
          </button>
        )}
      </div>
      <div className="intro-aside">
        <div className="intro-layer" data-for="2" inert={index !== 1}>
          <SourcesPanel />
        </div>
        <div className="intro-layer" data-for="3" inert={index !== 2}>
          <ControlsPanel />
        </div>
        <div className="intro-layer" data-for="4" inert={index !== 3}>
          <MemoryPanel />
        </div>
      </div>
      <div className="intro-stage" aria-live="polite">
        {previous >= 0 && (
          <Copy
            key={`leaving-${previous}`}
            beat={beats[previous]}
            className="is-leaving"
            data-dir={dir}
            aria-hidden
          />
        )}
        <div
          key={index}
          role="group"
          aria-roledescription="slide"
          aria-label={step}
          className="intro-slide"
        >
          <Copy beat={beats[index]} className="is-current" data-dir={dir} />
        </div>
      </div>
      <div className="intro-footer">
        <div className="intro-progress">
          <span className="intro-dots" aria-hidden="true">
            {beats.map((_, dot) => (
              <i
                key={dot}
                className={
                  dot === index ? "is-current" : dot < index ? "is-done" : ""
                }
              />
            ))}
          </span>
          <span className="intro-step">{step}</span>
        </div>
        {error && (
          <p role="alert" className="intro-error">
            {error}
          </p>
        )}
        <div className="intro-actions">
          {index > 0 && (
            <button
              type="button"
              className="button button--secondary intro-back"
              onClick={() => {
                if (index === 1) primary.current?.focus();
                go(-1);
              }}
            >
              Back
            </button>
          )}
          <button
            ref={primary}
            type="button"
            className="primary-action intro-next"
            disabled={last && pending}
            onClick={() => (last ? onContinue() : go(1))}
          >
            {last ? "Open the Atlas" : "Next"}
          </button>
        </div>
      </div>
    </section>
  );
}
