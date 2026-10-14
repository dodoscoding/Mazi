import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Icon } from "./icons";

type Tone = "info" | "success" | "error" | "progress";
type ToastInput = {
  message: string;
  tone?: Tone;
  action?: { label: string; onAction: () => void };
};
type Toast = ToastInput & { id: number; leaving?: boolean };

const dwell = 5000;
const exit = 200;
const ToastContext = createContext<{
  show: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
}>({ show: () => -1, dismiss: () => {} });

export const useToast = () => useContext(ToastContext);

/**
 * Toasts rise from the bottom centre. Info and success leave after 5 s; errors
 * and progress stay until dismissed. Errors are announced as alerts.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => {
    setToasts((list) =>
      list.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
    );
    setTimeout(
      () => setToasts((list) => list.filter((item) => item.id !== id)),
      exit,
    );
  }, []);
  const show = useCallback(
    (toast: ToastInput) => {
      const id = ++next.current;
      setToasts((list) => [...list, { ...toast, id }]);
      if (toast.tone !== "error" && toast.tone !== "progress")
        setTimeout(() => dismiss(id), dwell);
      return id;
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="toast-region">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`toast toast--${toast.tone || "info"} ${toast.leaving ? "is-leaving" : ""}`}
          >
            {toast.tone === "error" && <Icon name="alert" />}
            {toast.tone === "success" && <Icon name="check" />}
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  toast.action!.onAction();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="icon-button toast-close"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
