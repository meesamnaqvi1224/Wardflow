"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { AlertRow } from "@/components/alerts/AlertRow";
import { Badge } from "@/components/Badge";

export default function AlertsPage() {
  const { data, staff, acknowledgeAlert, resolveAlert, actionBusy } = useSession();
  const canManage = staff.role === "doctor" || staff.role === "nurse";

  const alerts = [...data.alerts].sort((a, b) => {
    const rank = { active: 0, acknowledged: 1, resolved: 2 };
    return rank[a.status] - rank[b.status];
  });

  const patientName = (id: string) => data.patients.find((p) => p.id === id)?.name ?? id;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Ward monitoring</p>
          <h1>Alerts</h1>
          <p className="muted">
            Clinical alerts raised from abnormal vitals. Doctors and nurses can acknowledge
            or resolve.
          </p>
        </div>
      </div>

      <div className="panel panel-pad">
        {alerts.length === 0 ? (
          <div className="empty">No alerts on the ward right now.</div>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="alert-list-item">
              <div className="row-top" style={{ marginBottom: 6 }}>
                <Link href={`/patients/${a.patientId}`} className="alert-patient-link">
                  <strong>{patientName(a.patientId)}</strong>
                </Link>
                <Badge
                  tone={
                    a.status === "active"
                      ? a.severity
                      : a.status === "acknowledged"
                        ? "warning"
                        : "neutral"
                  }
                  label={a.status}
                />
              </div>
              <AlertRow
                alert={a}
                busy={actionBusy}
                onAcknowledge={canManage && a.status === "active" ? acknowledgeAlert : undefined}
                onResolve={canManage && a.status !== "resolved" ? resolveAlert : undefined}
              />
            </div>
          ))
        )}
      </div>
    </>
  );
}
