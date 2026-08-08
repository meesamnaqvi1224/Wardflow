"use client";

import { useEffect, useId, useState } from "react";
import type { Patient } from "@/lib/types";

export function OrderMedicationDrawer({
  patients,
  defaultPatientId,
  onClose,
  onSubmit,
}: {
  patients: Patient[];
  defaultPatientId?: string;
  onClose: () => void;
  onSubmit: (input: {
    patientId: string;
    name: string;
    dose: string;
    due: string;
  }) => Promise<{ error: string | null }>;
}) {
  const titleId = useId();
  const [patientId, setPatientId] = useState(
    defaultPatientId ?? patients[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [due, setDue] = useState("Next dose");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || !name.trim() || !dose.trim()) {
      setError("Patient, medication name, and dose are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit({
        patientId,
        name: name.trim(),
        dose: dose.trim(),
        due: due.trim() || "As scheduled",
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Pharmacy</p>
            <h2 id={titleId}>Order medication</h2>
            <p className="muted">Place a new medication order for a patient.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="med-patient">Patient</label>
              <select
                id="med-patient"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                disabled={Boolean(defaultPatientId)}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · Room {p.room}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="med-name">Medication</label>
              <input
                id="med-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Paracetamol"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="med-dose">Dose</label>
              <input
                id="med-dose"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="500 mg oral"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="med-due">Due</label>
              <input
                id="med-due"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                placeholder="12:00 PM"
              />
            </div>
          </div>

          {error ? (
            <div className="login-error" role="alert" style={{ marginTop: 14 }}>
              {error}
            </div>
          ) : null}

          <div className="drawer-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving…" : "Order medication"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
