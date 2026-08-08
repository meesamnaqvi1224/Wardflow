"use client";

import { useEffect, useId, useState } from "react";
import type { Patient, Vitals } from "@/lib/types";

function parseBp(bp: string): { systolic: string; diastolic: string } {
  const [s, d] = bp.split("/");
  return { systolic: s ?? "", diastolic: d ?? "" };
}

/**
 * Side drawer form for recording vitals with validation and save locking.
 */
export function RecordVitalsDrawer({
  patient,
  onClose,
  onSubmit,
}: {
  patient: Patient;
  onClose: () => void;
  onSubmit: (vitals: Vitals, note: string) => void | Promise<void>;
}) {
  const titleId = useId();
  const { systolic: initSys, diastolic: initDia } = parseBp(patient.vitals.bp);

  const [oxygen, setOxygen] = useState(String(patient.vitals.oxygen));
  const [heartRate, setHeartRate] = useState(String(patient.vitals.heartRate));
  const [systolic, setSystolic] = useState(initSys);
  const [diastolic, setDiastolic] = useState(initDia);
  const [temperature, setTemperature] = useState(String(patient.vitals.temperature));
  const [respiratory, setRespiratory] = useState(String(patient.vitals.respiratory));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const vitals: Vitals = {
      oxygen: Number(oxygen),
      heartRate: Number(heartRate),
      bp: `${systolic}/${diastolic}`,
      temperature: Number(temperature),
      respiratory: Number(respiratory),
    };
    const sys = Number(systolic);
    const dia = Number(diastolic);
    if (
      !Number.isFinite(vitals.oxygen) ||
      !Number.isFinite(vitals.heartRate) ||
      !Number.isFinite(vitals.temperature) ||
      !Number.isFinite(vitals.respiratory) ||
      !Number.isFinite(sys) ||
      !Number.isFinite(dia)
    ) {
      setError("Enter valid numbers for all vital signs.");
      return;
    }
    if (vitals.oxygen < 50 || vitals.oxygen > 100) {
      setError("Oxygen saturation must be between 50 and 100%.");
      return;
    }
    if (vitals.heartRate < 20 || vitals.heartRate > 220) {
      setError("Heart rate must be between 20 and 220 bpm.");
      return;
    }
    if (vitals.temperature < 30 || vitals.temperature > 45) {
      setError("Temperature must be between 30 and 45 °C.");
      return;
    }
    if (vitals.respiratory < 4 || vitals.respiratory > 60) {
      setError("Respiratory rate must be between 4 and 60 /min.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(vitals, note.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" role="presentation" onClick={saving ? undefined : onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Clinical entry</p>
            <h2 id={titleId}>Record vitals · {patient.name}</h2>
            <p className="muted">Values are checked against demonstration thresholds.</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            disabled={saving}
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="oxygen">Oxygen saturation (%)</label>
              <input
                id="oxygen"
                name="oxygen"
                type="number"
                min={50}
                max={100}
                value={oxygen}
                onChange={(e) => setOxygen(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="field">
              <label htmlFor="heartRate">Heart rate (bpm)</label>
              <input
                id="heartRate"
                name="heartRate"
                type="number"
                min={20}
                max={220}
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="field">
              <label htmlFor="systolic">Systolic BP</label>
              <input
                id="systolic"
                name="systolic"
                type="number"
                min={50}
                max={250}
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="field">
              <label htmlFor="diastolic">Diastolic BP</label>
              <input
                id="diastolic"
                name="diastolic"
                type="number"
                min={20}
                max={150}
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="field">
              <label htmlFor="temperature">Temperature (°C)</label>
              <input
                id="temperature"
                name="temperature"
                type="number"
                step="0.1"
                min={30}
                max={45}
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="field">
              <label htmlFor="respiratory">Respiratory rate (/min)</label>
              <input
                id="respiratory"
                name="respiratory"
                type="number"
                min={4}
                max={60}
                value={respiratory}
                onChange={(e) => setRespiratory(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="field full">
              <label htmlFor="note">Optional observation</label>
              <textarea
                id="note"
                name="note"
                rows={3}
                placeholder="e.g. Short of breath on mild exertion"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
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
              {saving ? "Saving…" : "Record vitals"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
