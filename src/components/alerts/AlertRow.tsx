import type { Alert } from "@/lib/types";
import { Badge } from "@/components/Badge";

/**
 * A single alert with severity and status. Acknowledge / resolve actions are
 * intentionally absent in Phase 2 (read-only) and wired to server actions in
 * Phase 5 via optional callbacks so this component doesn't need to change.
 */
export function AlertRow({
  alert,
  onAcknowledge,
  onResolve,
}: {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
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
            <button className="mini-btn" onClick={() => onAcknowledge(alert.id)}>
              Acknowledge
            </button>
          ) : null}
          {onResolve ? (
            <button className="mini-btn" onClick={() => onResolve(alert.id)}>
              Resolve
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
