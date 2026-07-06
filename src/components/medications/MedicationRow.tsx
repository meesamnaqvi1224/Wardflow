import type { Medication, PatientStatus } from "@/lib/types";
import { Badge } from "@/components/Badge";

function statusTone(status: Medication["status"]): PatientStatus | "neutral" {
  if (status === "due") return "warning";
  if (status === "administered") return "stable";
  return "neutral";
}

/**
 * A single medication order. "Record administration" is wired via the optional
 * callback in Phase 5 (nurse-only); omitted for the read-only Phase 2 view.
 */
export function MedicationRow({
  medication,
  onAdminister,
}: {
  medication: Medication;
  onAdminister?: (id: string) => void;
}) {
  return (
    <div className="med-row">
      <div className="row-top">
        <div>
          <strong>{medication.name}</strong>
          <div className="muted">
            {medication.dose} · Due {medication.due}
          </div>
        </div>
        <Badge tone={statusTone(medication.status)} label={medication.status} />
      </div>
      {onAdminister && medication.status !== "administered" ? (
        <div className="row-actions">
          <button className="mini-btn" onClick={() => onAdminister(medication.id)}>
            Record administration
          </button>
        </div>
      ) : null}
    </div>
  );
}
