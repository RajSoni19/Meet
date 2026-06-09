"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

type ToastVariant = "default" | "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // Safe no-op fallback so calling outside a provider never crashes.
  return ctx ?? { toast: () => {} };
}

const icons: Record<ToastVariant, string> = {
  success: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  error:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2zm0-4h-2V7h2z",
  info: "M11 9h2V7h-2m1 13a8 8 0 1 1 0-16 8 8 0 0 1 0 16m-1-4h2v-6h-2z",
  default: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
};

const accent: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-brand-light",
  default: "text-gray-300",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="glass pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-3 rounded-xl border border-surface-border px-4 py-3 text-sm text-gray-100 shadow-soft"
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="currentColor"
              className={cn("shrink-0", accent[t.variant])}
            >
              <path d={icons[t.variant]} />
            </svg>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
