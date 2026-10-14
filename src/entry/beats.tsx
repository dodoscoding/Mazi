import type { ReactNode } from "react";

export type Beat = {
  topic: string;
  title: string;
  /** Desktop copy; phones read the shorter line from the M2-02 phone artboard. */
  copy: string;
  short: string;
  note?: ReactNode;
};

export const beats: Beat[] = [
  {
    topic: "One circle, one atlas",
    title: "Everywhere we went, kept where it happened",
    copy: "Mazi gathers the circle’s photos, videos and chats and pins each memory to the place and time it happened. Nobody outside the circle can see it.",
    short:
      "Our photos, videos and chats, pinned to the places and years they happened. Only the circle can see it.",
  },
  {
    topic: "Adding memories",
    title: "What you add is shared straight away",
    copy: "When you import from Apple Photos, WhatsApp, Discord or Messenger, every item goes to the whole circle the moment it lands. That is the point: one shared archive, not a private one each.",
    short:
      "Imports from Apple Photos, WhatsApp, Discord or Messenger reach the whole circle the moment they land.",
    note: "There is no private draft. Check an export before you add it; you can withdraw a contribution afterwards from My Imports.",
  },
  {
    topic: "Exploring",
    title: "Turn the globe, travel the years",
    copy: "Drag the globe or walk the list of places. The scrubber replays the years: each year’s places light up and the rest dim. Everything the globe does, the list and keyboard can do too.",
    short:
      "Drag the globe or use the list below it. The year scrubber lights up each year’s places in turn.",
  },
  {
    topic: "Landing",
    title: "Open a place to step into the memory",
    copy: "Each memory holds the photos, the story, who shared what, and exactly which app or export every item came from. You can reopen this introduction any time from About.",
    short:
      "Photos, the story, who shared them, and where every item came from. Replay this any time from About.",
  },
];

const sourceGlyphs: [string, ReactNode][] = [
  [
    "Apple Photos",
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-8 8" />
    </>,
  ],
  ["WhatsApp", <path d="M4 20l1.5-4A8 8 0 1112 20a8 8 0 01-4-1z" />],
  ["Discord", <path d="M5 5h14v10H9l-4 4z" />],
  [
    "Messenger",
    <path d="M12 4c4.4 0 8 3 8 7s-3.6 7-8 7l-5 2 1-3.5C5.5 15 4 13 4 11c0-4 3.6-7 8-7z" />,
  ],
];

const glyph = (children: ReactNode, size = 18) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

/** Beat 2: the four sources flow into one circle. */
export function SourcesPanel() {
  return (
    <div className="intro-panel intro-sources">
      <ul className="intro-source-grid">
        {sourceGlyphs.map(([name, path]) => (
          <li key={name}>
            {glyph(path)}
            {name}
          </li>
        ))}
      </ul>
      <svg
        className="intro-flow"
        viewBox="0 0 560 70"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M140 0C140 40 280 30 280 70M420 0C420 40 280 30 280 70" />
      </svg>
      <div className="intro-circle">
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="22" cy="22" r="17" />
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            return (
              <circle
                key={index}
                cx={22 + 17 * Math.cos(angle)}
                cy={22 + 17 * Math.sin(angle)}
                r="3"
              />
            );
          })}
        </svg>
        <span>Everyone in the circle sees it as soon as it’s added</span>
      </div>
    </div>
  );
}

const controls: [string, string][] = [
  ["drag", "turn the globe"],
  ["↑ ↓", "walk the places"],
  ["← →", "change the year"],
  ["Enter", "land on it"],
];

/** Beat 3: the year scrubber and the controls the Atlas answers to. */
export function ControlsPanel() {
  return (
    <div className="intro-panel intro-controls">
      <div className="intro-scrubber" aria-hidden="true">
        <span />
      </div>
      <dl>
        {controls.map(([key, action]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Beat 4: what a memory holds. */
export function MemoryPanel() {
  return (
    <ul className="intro-chips">
      <li>The story</li>
      <li>Who shared it</li>
      <li>Photos and videos</li>
      <li>Where each one came from</li>
    </ul>
  );
}
