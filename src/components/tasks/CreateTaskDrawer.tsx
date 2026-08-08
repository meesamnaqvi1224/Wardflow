"use client";

import { useEffect, useId, useState } from "react";
import type { Patient, TaskPriority } from "@/lib/types";

const PRIORITIES: TaskPriority[] = ["urgent", "important", "routine"];

export function CreateTaskDrawer({
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
    title: string;
    due: string;
    priority: TaskPriority;
  }) => Promise<{ error: string | null }>;
}) {
  const titleId = useId();
  const [patientId, setPatientId] = useState(
    defaultPatientId ?? patients[0]?.id ?? "",
  );
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("In 30 minutes");
  const [priority, setPriority] = useState<TaskPriority>("routine");
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
    if (!patientId || !title.trim()) {
      setError("Patient and title are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit({
        patientId,
        title: title.trim(),
        due: due.trim() || "Next shift",
        priority,
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
            <p className="eyebrow">Care task</p>
            <h2 id={titleId}>Create task</h2>
            <p className="muted">Add a ward work item for a patient.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="task-patient">Patient</label>
              <select
                id="task-patient"
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
              <label htmlFor="task-title">Title</label>
              <input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Recheck oxygen saturation"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="task-due">Due</label>
              <input
                id="task-due"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                placeholder="In 15 minutes"
              />
            </div>
            <div className="field">
              <label htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
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
              {saving ? "Saving…" : "Create task"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
