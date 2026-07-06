import Link from "next/link";
import type { Alert, Patient, Task } from "@/lib/types";
import { activeAlerts, openTasks } from "@/lib/domain";
import { Badge } from "@/components/Badge";

/**
 * Tabular patient list used for assigned and ward-wide views. The patient name
 * is the interactive element (accessible link target) rather than the whole
 * row, so keyboard and screen-reader users get a clear affordance.
 */
export function PatientTable({
  patients,
  alerts,
  tasks,
}: {
  patients: Patient[];
  alerts: Alert[];
  tasks: Task[];
}) {
  if (patients.length === 0) {
    return <div className="panel empty">No patients to show.</div>;
  }

  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Patient</th>
            <th scope="col">Room</th>
            <th scope="col">Status</th>
            <th scope="col">Latest vitals</th>
            <th scope="col">Diagnosis</th>
            <th scope="col">Work</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/patients/${p.id}`} className="text-link row-title">
                  {p.name}
                </Link>
                <span className="muted">{p.age} years</span>
              </td>
              <td>{p.room}</td>
              <td>
                <Badge tone={p.status} />
              </td>
              <td>
                SpO₂ {p.vitals.oxygen}% · HR {p.vitals.heartRate}
              </td>
              <td>{p.diagnosis}</td>
              <td>
                {activeAlerts(alerts, p.id).length} alerts ·{" "}
                {openTasks(tasks, p.id).length} tasks
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
