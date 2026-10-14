// Small DOM helpers shared by the vanilla feature pages: icons, dialogs, sheets,
// the notice toast and the Motion sheet's exit animation.

const paths = {
  photo: "M3 5h18v14H3zM21 16l-5-5-8 8",
  chat: "M4 20l1.5-4A8 8 0 1112 20a8 8 0 01-4-1z",
  discord: "M5 5h14v10H9l-4 4z",
  messenger:
    "M12 4c4.4 0 8 3 8 7s-3.6 7-8 7l-5 2 1-3.5C5.5 15 4 13 4 11c0-4 3.6-7 8-7z",
  zip: "M5 3h10l4 4v14H5zM15 3v4h4M10 7h2M10 10h2M10 13h2",
  people:
    "M9 12a3 3 0 100-6 3 3 0 000 6zM17 12.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM3 19c1-3 3.3-4.5 6-4.5s5 1.5 6 4.5M15 15.5c2.5-.5 4.5.8 5.5 3.5",
  alert: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v6M12 16.5v.5",
  check: "M5 12l5 5 9-10",
  pin: "M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12zM12 6.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  chevron: "M6 9l6 6 6-6",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
};

const svgNS = "http://www.w3.org/2000/svg";

export function icon(name, size = 20) {
  const svg = document.createElementNS(svgNS, "svg");
  for (const [key, value] of Object.entries({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  }))
    svg.setAttribute(key, String(value));
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", paths[name]);
  svg.append(path);
  return svg;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plays the Motion sheet's "Review: accept / merge" exit while work runs. */
export async function leaveWhile(node, offset, work) {
  const reduced = reducedMotion();
  const animation = node?.animate?.(
    reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: `translateX(${offset}px)` },
        ],
    {
      duration: reduced ? 160 : 280,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "forwards",
    },
  );
  try {
    return await work();
  } catch (error) {
    animation?.cancel();
    throw error;
  }
}

/**
 * Turns a page's status line into the Motion sheet's toast: it rises above the
 * phone tab bar, stays five seconds, then fades. The text stays in the live
 * region, and the toast never takes pointer input from the page beneath it.
 */
export function toastNotice(node, lifecycle) {
  node.classList.add("fx-toast", "is-hidden");
  let timer = 0;
  const show = () => {
    clearTimeout(timer);
    node.classList.remove("is-in", "is-hidden");
    if (!node.textContent.trim()) {
      node.classList.add("is-hidden");
      return;
    }
    void node.offsetWidth;
    node.classList.add("is-in");
    timer = window.setTimeout(
      () => node.classList.add("is-hidden"),
      node.dataset.tone === "error" ? 10000 : 5000,
    );
  };
  const observer = new MutationObserver(show);
  observer.observe(node, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  lifecycle.onDispose(() => {
    observer.disconnect();
    clearTimeout(timer);
  });
}

// Dialogs live inside the page wrapper so its styles apply and disposal removes them.
const host = (root) => root.querySelector(".fx") || root;

function closable(dialog, onClosed) {
  let closing = false;
  let opener = null;
  const close = (result) => {
    if (closing || !dialog.open) return;
    closing = true;
    dialog.classList.add("is-closing");
    window.setTimeout(
      () => {
        dialog.classList.remove("is-closing");
        dialog.close();
        closing = false;
        onClosed?.(result);
        if (opener instanceof HTMLElement && opener.isConnected)
          opener.focus({ preventScroll: true });
      },
      reducedMotion() ? 120 : 240,
    );
  };
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  // A click on the dialog box itself, outside its inner panel, lands on the backdrop.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  return {
    close,
    show() {
      opener = document.activeElement;
      dialog.showModal();
    },
  };
}

/**
 * A native modal dialog drawn as the Components sheet: a bottom sheet with a
 * drag handle on phones, a centred panel on wider screens. Focus is trapped
 * by the browser, Escape and the scrim close it, and focus returns to the opener.
 */
export function sheet(root, { label, className = "" }) {
  const dialog = el("dialog", `fx-dialog fx-sheet ${className}`.trim());
  dialog.setAttribute("aria-label", label);
  const panel = el("div", "fx-dialog-panel");
  const handle = el("button", "fx-sheet-handle");
  handle.type = "button";
  handle.setAttribute("aria-label", `Close ${label}`);
  const body = el("div", "fx-sheet-body");
  panel.append(handle, body);
  dialog.append(panel);
  host(root).append(dialog);
  const { close, show } = closable(dialog);
  let drag = null;
  handle.addEventListener("click", () => close());
  handle.addEventListener("pointerdown", (event) => {
    handle.setPointerCapture(event.pointerId);
    drag = { start: event.clientY, offset: 0 };
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag) return;
    drag.offset = Math.max(0, event.clientY - drag.start);
    panel.style.transform = drag.offset ? `translateY(${drag.offset}px)` : "";
  });
  const release = () => {
    const offset = drag?.offset || 0;
    drag = null;
    panel.style.transform = "";
    if (offset > 80) close();
  };
  handle.addEventListener("pointerup", release);
  handle.addEventListener("pointercancel", () => {
    drag = null;
    panel.style.transform = "";
  });
  return {
    dialog,
    body,
    open() {
      if (dialog.open) return;
      show();
      body.querySelector("button, a[href], input, select")?.focus();
    },
    close: () => close(),
  };
}

/**
 * The Components sheet's confirmation dialog. Resolves true only when the
 * member chooses the confirming action; Escape, the scrim and Cancel resolve false.
 */
export function confirmAction(
  root,
  { title, body, confirm, cancel = "Cancel", danger = false },
) {
  return new Promise((resolve) => {
    const dialog = el("dialog", "fx-dialog fx-alert");
    dialog.setAttribute("role", "alertdialog");
    const id = `fx-alert-${Math.random().toString(36).slice(2)}`;
    dialog.setAttribute("aria-labelledby", `${id}-title`);
    dialog.setAttribute("aria-describedby", `${id}-body`);
    const panel = el("div", "fx-dialog-panel");
    const heading = el("h2", "fx-alert-title", title);
    heading.id = `${id}-title`;
    const text = el("p", "fx-alert-body", body);
    text.id = `${id}-body`;
    const actions = el("div", "fx-alert-actions");
    const no = el("button", "fx-button fx-button--quiet", cancel);
    no.type = "button";
    const yes = el(
      "button",
      `fx-button ${danger ? "fx-button--danger" : "fx-button--primary"}`,
      confirm,
    );
    yes.type = "button";
    actions.append(no, yes);
    panel.append(heading, text, actions);
    dialog.append(panel);
    host(root).append(dialog);
    const { close, show } = closable(dialog, (result) => {
      dialog.remove();
      resolve(result === true);
    });
    no.addEventListener("click", () => close(false));
    yes.addEventListener("click", () => close(true));
    show();
    no.focus();
  });
}

export const sourceNames = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  discord: "Discord",
  manual: "Photos in a ZIP",
  apple: "Apple Photos",
};
export const sourceIcons = {
  whatsapp: "chat",
  messenger: "messenger",
  discord: "discord",
  manual: "zip",
  apple: "photo",
};
export function initials(name) {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/);
  return (
    parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
  ).toUpperCase();
}
export function formatDay(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
