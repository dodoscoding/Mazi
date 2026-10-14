import { unlock } from "./engine";
import { currentSound, setSound, useSound } from "./useSound";
import "./sound.css";

function SpeakerIcon({ on, size }: { on: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {on ? (
        <path d="M16.5 9a4.2 4.2 0 010 6M19 6.5a8 8 0 010 11" />
      ) : (
        <path d="M17 9l4 6M21 9l-4 6" />
      )}
    </svg>
  );
}

/**
 * The speaker toggle. Its name stays "Sound" and aria-pressed carries the
 * state; the visible text or tooltip reads "Sound off" or "Sound on".
 */
export function SoundToggle({
  variant = "icon",
  className = "",
}: {
  variant?: "icon" | "pill";
  className?: string;
}) {
  const { sound } = useSound();
  const on = sound === "on";
  const toggle = () => {
    const next = currentSound() === "on" ? "off" : "on";
    setSound(next);
    // The click is the gesture the browser needs before audio may start.
    if (next === "on") unlock();
  };
  const state = on ? "on" : "off";
  if (variant === "pill")
    return (
      <button
        type="button"
        className={`sound-toggle sound-toggle--pill ${className}`.trim()}
        aria-pressed={on}
        onClick={toggle}
      >
        <SpeakerIcon on={on} size={16} />
        <span className="sound-toggle-text">
          Sound<span aria-hidden="true"> {state}</span>
        </span>
      </button>
    );
  return (
    <button
      type="button"
      className={`icon-button sound-toggle ${className}`.trim()}
      aria-label="Sound"
      aria-pressed={on}
      onClick={toggle}
    >
      <SpeakerIcon on={on} size={16} />
      <span className="sound-tip" aria-hidden="true">
        Sound {state}
      </span>
    </button>
  );
}
