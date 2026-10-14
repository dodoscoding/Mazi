import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { EntrySky } from "./entry/EntrySky";
import { useTheme } from "./theme/useTheme";
import { IconButton } from "./ui/Button";
import { Icon } from "./ui/icons";
import type { useEntry } from "./useEntry";
import "./styles/entry.css";

export { Introduction } from "./entry/Introduction";

// Server messages from mazi/identity/core.py that the design gives its own copy.
const WRONG_CODE = "The shared code is incorrect";
const REMOVED = "Group access denied";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "night" ? "day" : "night";
  return (
    <IconButton
      icon={next === "day" ? "sun" : "moon"}
      label={`Switch to ${next}`}
      onClick={toggle}
    />
  );
}

function Removed({
  onRetry,
  action,
}: {
  onRetry: () => void;
  action: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div role="alert" className="entry-removed">
      <p className="entry-removed-label">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="5" y="11" width="14" height="9" rx="1.5" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
        Access removed
      </p>
      <h2>You’re no longer in this circle</h2>
      <p>
        This name is no longer a member, so the atlas is closed on this device.
        If this is a mistake, ask a member to add you again.
      </p>
      <button
        ref={action}
        type="button"
        className="button button--secondary"
        onClick={onRetry}
      >
        Enter a different code
      </button>
    </div>
  );
}

export function Entry({ entry }: { entry: ReturnType<typeof useEntry> }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const codeField = useRef<HTMLInputElement>(null);
  const retrying = useRef(false);
  const { state } = entry;
  const error =
    state.status === "signed-out" || state.status === "error"
      ? state.error
      : "";
  const removed = state.status === "signed-out" && error === REMOVED;
  const showRemoved = removed && !dismissed;
  const showAlert = !!error && !removed;
  const wrongCode = error === WRONG_CODE;
  const removedAction = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (showRemoved) removedAction.current?.focus();
  }, [showRemoved]);
  useEffect(() => {
    if (!showRemoved && retrying.current) {
      retrying.current = false;
      codeField.current?.focus();
    }
  }, [showRemoved]);

  return (
    <div className="entry">
      <EntrySky />
      <header className="entry-header">
        <p className="hud-label">
          <span className="entry-wide">A private atlas for one circle</span>
          <span className="entry-narrow">One circle · private</span>
        </p>
        <div className="entry-header-actions">
          <ThemeToggle />
        </div>
      </header>
      <main className="entry-main">
        <div className="entry-title">
          <h1 className="entry-wordmark">
            Mazi
            <span className="entry-light" aria-hidden="true" />
          </h1>
          <p className="entry-welcome">
            Welcome back to everywhere we have been.
          </p>
        </div>
        {showRemoved ? (
          <Removed
            action={removedAction}
            onRetry={() => {
              retrying.current = true;
              setCode("");
              setDismissed(true);
            }}
          />
        ) : (
          <form
            className="entry-form"
            onSubmit={(event) => {
              event.preventDefault();
              setCodeEdited(false);
              setDismissed(false);
              void entry.enter(name, code);
            }}
          >
            <div className="entry-field">
              <label htmlFor="entry-name">Your name in the circle</label>
              <input
                id="entry-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="nickname"
                placeholder="How the others know you"
                maxLength={80}
                required
              />
            </div>
            <div className="entry-field">
              <label htmlFor="entry-code">Shared code</label>
              <input
                id="entry-code"
                ref={codeField}
                className="entry-code"
                type="password"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setCodeEdited(true);
                }}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="The code someone shared with you"
                aria-invalid={wrongCode && !codeEdited}
                aria-describedby={showAlert ? "entry-message" : undefined}
                required
              />
            </div>
            {showAlert && (
              <div id="entry-message" role="alert" className="entry-alert">
                <Icon name="alert" size={18} />
                {wrongCode ? (
                  <span>
                    <b>That code doesn’t open a circle.</b>{" "}
                    <span>Check it with whoever invited you.</span>
                  </span>
                ) : (
                  <span>{error}</span>
                )}
              </div>
            )}
            <button
              className="primary-action entry-submit"
              disabled={state.pending}
            >
              {state.pending ? "Opening Mazi…" : "Enter Mazi"}
            </button>
            {state.status === "error" && (
              <button
                type="button"
                className="button button--secondary entry-retry"
                onClick={entry.refresh}
              >
                Retry connection
              </button>
            )}
          </form>
        )}
      </main>
      <footer className="entry-footer">
        <p className="hud-label">
          No email. No password. Nobody outside the circle.
        </p>
      </footer>
    </div>
  );
}
