import { useState } from "react";
import type { useEntry } from "./useEntry";
import "./styles/entry.css";
export function Entry({ entry }: { entry: ReturnType<typeof useEntry> }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const { state } = entry;
  return (
    <main className="entry-page">
      <div className="entry-form">
        <span className="wordmark">mazi</span>
        <h1>A place for our circle.</h1>
        <p>Enter your name and the shared code to open Mazi.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void entry.enter(name, code);
          }}
        >
          <label>
            Your name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="nickname"
              maxLength={80}
              required
            />
          </label>
          <label>
            Shared code
            <input
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          {(state.status === "signed-out" || state.status === "error") &&
            state.error && <p role="alert">{state.error}</p>}
          <button className="primary-action" disabled={state.pending}>
            {state.pending ? "Opening Mazi…" : "Enter Mazi"}
          </button>
        </form>
        {state.status === "error" && (
          <button onClick={entry.refresh}>Retry connection</button>
        )}
      </div>
    </main>
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
  return (
    <section className="archive-welcome introduction">
      <div className="welcome-globe" aria-hidden="true" />
      <h1>The Atlas of Us</h1>
      <p>
        Mazi gathers our photographs, shared stories and the places that bring
        us back.
      </p>
      <p>
        Explore the Atlas through time and place. Add photographs from My
        Imports, then gather them into memories with your circle.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="primary-action"
        disabled={pending}
        onClick={onContinue}
      >
        Open the Atlas
      </button>
    </section>
  );
}
