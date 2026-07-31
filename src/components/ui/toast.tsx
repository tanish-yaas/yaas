"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; message: string; tone: "ok" | "error" };

const ToastContext = createContext<{
  push: (message: string, tone?: "ok" | "error") => void;
}>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const push = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const stack = (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[#26262f] bg-[#16161d] px-4 py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
          >
            <span
              className={t.tone === "ok" ? "text-[#4ADE80]" : "text-[#FF4D6D]"}
            >
              {t.tone === "ok" ? <Check size={14} /> : <AlertTriangle size={14} />}
            </span>
            <span className="text-xs text-[#f2f2f7]">{t.message}</span>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              className="ml-1 text-[#8b8b9e] transition-colors hover:text-white"
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {mounted && createPortal(stack, document.body)}
    </ToastContext.Provider>
  );
}