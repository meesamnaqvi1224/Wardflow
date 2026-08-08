import type { Medication, PatientStatus } from "@/lib/types";
import { Badge } from "@/components/Badge";

function statusTone(status: Medication["status"]): PatientStatus | "neutral" {
  if (status === "due") return "warning";
  if (status === "administered") return "stable";
  return "neutral";
}

export function MedicationRow({
  medication,
  onAdminister,
  busy = false,
}: {
  medication: Medication;
  onAdminister?: (id: string) => void;
  busy?: boolean;
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
          <button
            type="button"
            className="mini-btn"
            disabled={busy}
            onClick={() => onAdminister(medication.id)}
          >
            {busy ? "Saving…" : "Record administration"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
