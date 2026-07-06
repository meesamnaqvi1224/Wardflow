import Link from "next/link";
import type { Patient } from "@/lib/types";
import { Badge } from "@/components/Badge";

/**
 * Compact patient card for the dashboard "needs attention" grid. Urgent and
 * warning patients get a coloured top border so acuity reads at a glance.
 */
export function PatientCard({ patient }: { patient: Patient }) {
  return (
    <Link href={`/patients/${patient.id}`} className={`patient-card ${patient.status}`}>
      <div className="patient-card-top">
        <div>
          <h3>{patient.name}</h3>
          <span className="muted">
            Room {patient.room} · {patient.age} yrs
          </span>
        </div>
        <Badge tone={patient.status} />
      </div>
      <p>{patient.diagnosis}</p>
      <div className="patient-meta">
        <span>SpO₂ {patient.vitals.oxygen}%</span>
        <span>HR {patient.vitals.heartRate}</span>
        <span>{patient.vitals.temperature}°C</span>
      </div>
    </Link>
  );
}
