"use client";

import { useEffect, useId, useState } from "react";
import type { Patient, Vitals } from "@/lib/types";

function parseBp(bp: string): { systolic: string; diastolic: string } {
  const [s, d] = bp.split("/");
  return { systolic: s ?? "", diastolic: d ?? "" };
}

/**
 * Side drawer form for recording vitals. Mirrors the v1 prototype drawer so
 * the demo workflow feels familiar. Submit returns a fully typed Vitals object.
 */
export function RecordVitalsDrawer({
  patient,
  onClose,
  onSubmit,
}: {
  patient: Patient;
  onClose: () => void;
  onSubmit: (vitals: Vitals, note: string) => void;
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(
      {
        oxygen: Number(oxygen),
        heartRate: Number(heartRate),
        bp: `${systolic}/${diastolic}`,
        temperature: Number(temperature),
        respiratory: Number(respiratory),
      },
      note.trim(),
    );
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
            <p className="eyebrow">Clinical entry</p>
            <h2 id={titleId}>Record vitals · {patient.name}</h2>
            <p className="muted">Values are checked against demonstration thresholds.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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
              />
            </div>
          </div>
          <div className="drawer-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Record vitals
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
