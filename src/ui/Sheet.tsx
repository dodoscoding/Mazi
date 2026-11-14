import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

const focusable =
  'a[href], button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const closeDuration = 240;

/**
 * Bottom sheet with a scrim. Traps focus while open, closes on Escape, a scrim
 * tap or a downward drag of the handle, and returns focus to the opener.
 */
export function Sheet({
  open,
  onClose,
  label,
  closeLabel,
  className = "",
  style,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const drag = useRef<{ start: number; offset: number } | null>(null);
  useLayoutEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        // Navigation from inside the sheet moves focus to the new page; keep it there.
        const active = document.activeElement;
        const returnFocus =
          !active ||
          active === document.body ||
          sheet.current?.contains(active);
        setMounted(false);
        setClosing(false);
        if (
          returnFocus &&
          opener.current instanceof HTMLElement &&
          opener.current.isConnected
        )
          opener.current.focus({ preventScroll: true });
      }, closeDuration);
      return () => clearTimeout(timer);
    }
  }, [open]);
  useEffect(() => {
    if (open && mounted)
      sheet.current
        ?.querySelector(".sheet-body")
        ?.querySelector<HTMLElement>(focusable)
        ?.focus({ preventScroll: true });
  }, [open, mounted]);
  if (!mounted) return null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = Array.from(
      sheet.current?.querySelectorAll<HTMLElement>(focusable) || [],
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const moveTo = (offset: number) => {
    if (sheet.current)
      sheet.current.style.transform = offset ? `translateY(${offset}px)` : "";
  };
  return createPortal(
    <div
      className={`sheet-root ${closing ? "is-closing" : ""} ${className}`.trim()}
      style={style}
      aria-hidden={closing || undefined}
      inert={closing}
    >
      <div className="sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={sheet}
        className="sheet"
        role="dialog"
        aria-modal={!closing}
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          className="sheet-handle"
          aria-label={closeLabel || `Close ${label}`}
          onClick={onClose}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { start: event.clientY, offset: 0 };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            drag.current.offset = Math.max(
              0,
              event.clientY - drag.current.start,
            );
            moveTo(drag.current.offset);
          }}
          onPointerUp={(event) => {
            const offset = drag.current?.offset || 0;
            drag.current = null;
            if (offset > 80) {
              event.preventDefault();
              onClose();
            } else moveTo(0);
          }}
          onPointerCancel={() => {
            drag.current = null;
            moveTo(0);
          }}
        />
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
