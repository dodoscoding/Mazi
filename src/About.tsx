import { initials } from "./ui/initials";
import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { Icon } from "./ui/icons";
import type { LinkFor } from "./useRoute";
import "./styles/about.css";

// Each promise restates PRODUCT.md, docs/PRIVACY.md or decision D17; none is new.
const promises: [string, string][] = [
  [
    "Only the circle can see it",
    "Every reader enters with the circle’s shared code and belongs to the circle. Nothing is published to the internet: no public links, profiles or feed.",
  ],
  [
    "What you add is shared at once",
    "Imports reach every member as each item is processed. There is no private stage and no publish step, so check an export before adding it.",
  ],
  [
    "No email, no password",
    "A visible name and the shared code open Mazi. A name is not proof of who is using it: anyone with the code can enter under any name.",
  ],
  [
    "You can take things back",
    "Withdraw a contribution and it stops being shared for everyone at once. Files someone already downloaded cannot be recalled.",
  ],
  [
    "Answers cite their sources",
    "Ask your archive answers only from recorded archive metadata and links each claim to the record it came from.",
  ],
  [
    "Optional AI stays off",
    "Face recognition and external AI providers are off. Memory answers run locally, and no question, photograph or message goes to a provider.",
  ],
];

function SignOutDialog({
  open,
  circle,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  circle: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  const id = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open) {
      setClosing(false);
      if (!node.open) node.showModal();
      stay.current?.focus();
    } else if (!open && node.open) {
      setClosing(true);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const timer = setTimeout(
        () => {
          node.close();
          setClosing(false);
        },
        reduced ? 120 : 240,
      );
      return () => clearTimeout(timer);
    }
  }, [open]);
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      className={`about-dialog ${closing ? "is-closing" : ""}`}
      // While it fades out after Stay or Escape, nothing inside can be pressed.
      inert={!open}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="about-dialog-panel">
        <h2 id={`${id}-title`}>Sign out of {circle}?</h2>
        <p id={`${id}-body`}>
          The atlas closes on this device. You’ll need the circle’s shared code
          and your name to come back. Nothing you added is removed.
        </p>
        <div className="about-dialog-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              if (open) onConfirm();
            }}
          >
            Sign out
          </button>
          <button
            ref={stay}
            type="button"
            className="button button--secondary"
            onClick={onCancel}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function About({
  profileName,
  circle,
  link,
  heading,
  onSignOut,
}: {
  profileName: string;
  circle: string;
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
  onSignOut: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="about-page">
      <article className="about-story">
        <h1 ref={heading} tabIndex={-1}>
          A private atlas for <em>one circle of friends</em>
        </h1>
        <p className="about-lede">
          Mazi means “together”. It gathers the photographs and conversations a
          circle already has, places each memory where and when it happened, and
          helps the circle find its way back through them. There is no feed, no
          public profile and nothing to like.
        </p>
        <h2>Our promises</h2>
        <ol className="about-promises">
          {promises.map(([title, body], index) => (
            <li key={title}>
              <span className="about-number" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <b>{title}</b>
                <span>{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </article>
      <aside className="about-aside">
        <a
          className="about-replay"
          href="#/introduction"
          onClick={link("/introduction")}
        >
          Replay introduction
          <Icon name="chevron-right" size={18} />
        </a>
        <section className="about-panel" aria-labelledby="about-account">
          <h2 id="about-account" className="about-panel-title">
            Account
          </h2>
          <div className="about-person">
            <span className="about-avatar" aria-hidden="true">
              {initials(profileName)}
            </span>
            <span>
              <b>
                {profileName} in {circle}
              </b>
              <span>Signed in on this device</span>
            </span>
          </div>
          <button
            type="button"
            className="button button--danger about-sign-out"
            onClick={() => setConfirming(true)}
          >
            Sign out
          </button>
          <p className="about-note">
            You’ll need the circle’s shared code to come back. Nothing you added
            is removed.
          </p>
        </section>
        <p className="about-note">
          Music: “Monkeys Spinning Monkeys” by Kevin MacLeod (incompetech.com),
          licensed under{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        </p>
      </aside>
      <SignOutDialog
        open={confirming}
        circle={circle}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onSignOut();
        }}
      />
    </div>
  );
}
