"use client";

import { useEffect, useId, useState } from "react";
import type { StaffMember, Ward } from "@/lib/types";

/**
 * Side drawer to admit a new patient. Status starts stable and is derived from
 * alerts afterwards; vitals are recorded separately from the patient page.
 */
export function AdmitPatientDrawer({
  wards,
  staffList,
  defaultDoctorId,
  defaultNurseId,
  onClose,
  onSubmit,
}: {
  wards: Ward[];
  staffList: StaffMember[];
  defaultDoctorId?: string;
  defaultNurseId?: string;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    age: number;
    room: string;
    diagnosis: string;
    allergy: string;
    wardId: string | null;
    doctorId: string | null;
    nurseId: string | null;
  }) => Promise<{ error: string | null }>;
}) {
  const titleId = useId();
  const doctors = staffList.filter((s) => s.role === "doctor" && s.active);
  const nurses = staffList.filter((s) => s.role === "nurse" && s.active);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [room, setRoom] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [allergy, setAllergy] = useState("");
  const [wardId, setWardId] = useState(wards.length === 1 ? wards[0].id : "");
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? "");
  const [nurseId, setNurseId] = useState(defaultNurseId ?? "");
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
    if (!name.trim() || !room.trim() || !diagnosis.trim()) {
      setError("Name, room, and diagnosis are required.");
      return;
    }
    if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 149) {
      setError("Age must be a whole number from 1 to 149.");
      return;
    }
    setSaving(true);
    try {
      const result = await onSubmit({
        name: name.trim(),
        age: ageNum,
        room: room.trim(),
        diagnosis: diagnosis.trim(),
        allergy: allergy.trim() || "None recorded",
        wardId: wardId || null,
        doctorId: doctorId || null,
        nurseId: nurseId || null,
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
            <p className="eyebrow">New patient</p>
            <h2 id={titleId}>Admit patient</h2>
            <p className="muted">Record vitals from the patient page after admission.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="admit-name">Full name</label>
              <input
                id="admit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="admit-age">Age</label>
              <input
                id="admit-age"
                type="number"
                min={1}
                max={149}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="admit-room">Room</label>
              <input
                id="admit-room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="admit-diagnosis">Primary diagnosis</label>
              <input
                id="admit-diagnosis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="admit-allergy">Allergy</label>
              <input
                id="admit-allergy"
                value={allergy}
                onChange={(e) => setAllergy(e.target.value)}
                placeholder="None recorded"
              />
            </div>
            <div className="field full">
              <label htmlFor="admit-ward">Ward</label>
              <select id="admit-ward" value={wardId} onChange={(e) => setWardId(e.target.value)}>
                <option value="">No ward</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="admit-doctor">Primary doctor</label>
              <select
                id="admit-doctor"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="admit-nurse">Primary nurse</label>
              <select
                id="admit-nurse"
                value={nurseId}
                onChange={(e) => setNurseId(e.target.value)}
              >
                <option value="">Unassigned</option>
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
              {saving ? "Admitting…" : "Admit patient"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
