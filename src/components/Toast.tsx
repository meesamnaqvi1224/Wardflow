"use client";

import { useEffect } from "react";

/** Transient bottom-right confirmation message. */
export function Toast({
  message,
  onDismiss,
  durationMs = 3200,
}: {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [message, onDismiss, durationMs]);

  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
