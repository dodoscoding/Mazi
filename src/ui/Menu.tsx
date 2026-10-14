import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Icon } from "./icons";

const focusable = "a[href], button:not(:disabled), select:not(:disabled)";

/**
 * Disclosure menu for site navigation: a button that shows a panel of links
 * and controls. Arrow keys move between items, Escape closes and returns focus.
 */
export function Menu({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const items = () =>
    Array.from(
      panel.current?.querySelectorAll<HTMLElement>(focusable) || [],
    ).filter((item) => item.getClientRects().length > 0);
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (event.target instanceof HTMLSelectElement) return;
    if (!open) {
      if (event.target === button.current && event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? list.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + list.length) %
            list.length;
    event.preventDefault();
    list[next]?.focus();
  };
  return (
    <div
      ref={root}
      className={`menu ${className}`.trim()}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (open && !root.current?.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className="button button--secondary menu-button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <Icon name="chevron-down" size={12} />
      </button>
      <div ref={panel} id={id} className="menu-popover" hidden={!open}>
        {open && children(() => setOpen(false))}
      </div>
    </div>
  );
}
