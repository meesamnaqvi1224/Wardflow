import type { Alert } from "@/lib/types";
import { Badge } from "@/components/Badge";

export function AlertRow({
  alert,
  onAcknowledge,
  onResolve,
  busy = false,
}: {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
  busy?: boolean;
}) {
  const showActions = Boolean(onAcknowledge || onResolve);
  return (
    <div className="alert-row">
      <div className="row-top">
        <div>
          <strong>{alert.message}</strong>
          <div className="muted">
            {alert.at} · {alert.status}
          </div>
        </div>
        <Badge tone={alert.severity} />
      </div>
      {showActions ? (
        <div className="row-actions">
          {alert.status === "active" && onAcknowledge ? (
            <button
              type="button"
              className="mini-btn"
              disabled={busy}
              onClick={() => onAcknowledge(alert.id)}
            >
              {busy ? "Saving…" : "Acknowledge"}
            </button>
          ) : null}
          {onResolve ? (
            <button
              type="button"
              className="mini-btn"
              disabled={busy}
              onClick={() => onResolve(alert.id)}
            >
              {busy ? "Saving…" : "Resolve"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
