"use client";

import { useEffect, useId, useState } from "react";
import type { Patient, Role } from "@/lib/types";

const NOTE_TYPES_BY_ROLE: Record<Role, string[]> = {
  doctor: ["Doctor note", "Progress note", "Clinical note"],
  nurse: ["Nursing note", "Observation", "Clinical note"],
  admin: ["Clinical note", "Administrative note"],
};

export function AddNoteDrawer({
  patient,
  role,
  onClose,
  onSubmit,
}: {
  patient: Patient;
  role: Role;
  onClose: () => void;
  onSubmit: (input: {
    patientId: string;
    type: string;
    content: string;
  }) => Promise<{ error: string | null }>;
}) {
  const titleId = useId();
  const types = NOTE_TYPES_BY_ROLE[role] ?? ["Clinical note"];
  const [type, setType] = useState(types[0]);
  const [content, setContent] = useState("");
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
    if (!content.trim()) {
      setError("Note content is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit({
        patientId: patient.id,
        type,
        content: content.trim(),
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
            <p className="eyebrow">Clinical documentation</p>
            <h2 id={titleId}>Add note · {patient.name}</h2>
            <p className="muted">Notes are attributed to you and saved to the record.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="note-type">Note type</label>
              <select
                id="note-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="note-content">Content</label>
              <textarea
                id="note-content"
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter clinical note…"
                required
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
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
