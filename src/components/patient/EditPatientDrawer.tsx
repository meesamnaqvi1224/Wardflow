"use client";

import { useEffect, useId, useState } from "react";
import type { Patient, PatientStatus, StaffMember } from "@/lib/types";

const STATUSES: PatientStatus[] = ["urgent", "warning", "stable"];

/**
 * Side drawer to edit patient profile fields (demographics + care team).
 * Vitals stay on Record vitals — not edited here.
 */
export function EditPatientDrawer({
  patient,
  staffList,
  canEditAssignments,
  onClose,
  onSubmit,
}: {
  patient: Patient;
  staffList: StaffMember[];
  canEditAssignments: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    age: number;
    room: string;
    diagnosis: string;
    allergy: string;
    status: PatientStatus;
    doctorId: string;
    nurseId: string;
  }) => Promise<void> | void;
}) {
  const titleId = useId();
  const doctors = staffList.filter((s) => s.role === "doctor");
  const nurses = staffList.filter((s) => s.role === "nurse");

  const [name, setName] = useState(patient.name);
  const [age, setAge] = useState(String(patient.age));
  const [room, setRoom] = useState(patient.room);
  const [diagnosis, setDiagnosis] = useState(patient.diagnosis);
  const [allergy, setAllergy] = useState(patient.allergy);
  const [status, setStatus] = useState<PatientStatus>(patient.status);
  const [doctorId, setDoctorId] = useState(patient.doctorId);
  const [nurseId, setNurseId] = useState(patient.nurseId);
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
    setError(null);
    const ageNum = Number(age);
    if (!name.trim() || !room.trim() || !diagnosis.trim() || !Number.isFinite(ageNum)) {
      setError("Name, age, room, and diagnosis are required.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        age: ageNum,
        room: room.trim(),
        diagnosis: diagnosis.trim(),
        allergy: allergy.trim() || "None recorded",
        status,
        doctorId,
        nurseId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
            <p className="eyebrow">Patient profile</p>
            <h2 id={titleId}>Edit · {patient.name}</h2>
            <p className="muted">Update demographics and care-team assignment.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="edit-name">Full name</label>
              <input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit-age">Age</label>
              <input
                id="edit-age"
                type="number"
                min={1}
                max={149}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit-room">Room</label>
              <input
                id="edit-room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="edit-diagnosis">Primary diagnosis</label>
              <input
                id="edit-diagnosis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="edit-allergy">Allergy</label>
              <input
                id="edit-allergy"
                value={allergy}
                onChange={(e) => setAllergy(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="edit-status">Status</label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PatientStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="edit-admitted">Admitted</label>
              <input id="edit-admitted" value={patient.admitted} readOnly disabled />
            </div>
            <div className="field">
              <label htmlFor="edit-doctor">Primary doctor</label>
              <select
                id="edit-doctor"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                disabled={!canEditAssignments}
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="edit-nurse">Primary nurse</label>
              <select
                id="edit-nurse"
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
                disabled={!canEditAssignments}
              >
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
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
              {saving ? "Saving…" : "Save patient"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
