"use client";

import { useEffect } from "react";

export type ToastType = "success" | "error";

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3200);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-4 z-[100] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all md:top-6 ${
        type === "success"
          ? "bg-emerald-600 text-white shadow-emerald-600/30"
          : "bg-red-500 text-white shadow-red-500/30"
      }`}
      role="status"
    >
      <span className="shrink-0 text-base">{type === "success" ? "✅" : "⚠️"}</span>
      <span className="truncate">{message}</span>
    </div>
  );
}
