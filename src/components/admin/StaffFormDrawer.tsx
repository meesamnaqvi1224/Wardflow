"use client";

import { useEffect, useId, useState } from "react";
import type { Role, StaffMember } from "@/lib/types";

const ROLES: Role[] = ["doctor", "nurse", "admin"];

export function StaffFormDrawer({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: StaffMember | null;
  onClose: () => void;
  onSubmit: (input: {
    id?: string;
    name: string;
    role: Role;
    detail: string;
    initials: string;
  }) => Promise<{ error: string | null }>;
}) {
  const titleId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<Role>(initial?.role ?? "nurse");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [initials, setInitials] = useState(initial?.initials ?? "");
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
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit({
        id: initial?.id,
        name,
        role,
        detail,
        initials,
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
            <p className="eyebrow">Staff</p>
            <h2 id={titleId}>
              {mode === "create" ? "Add staff member" : `Edit · ${initial?.name}`}
            </h2>
            <p className="muted">
              Auth login is linked separately in Supabase (staff.auth_user_id).
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="staff-name">Display name</label>
              <input
                id="staff-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="staff-role">Role</label>
              <select
                id="staff-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="staff-initials">Initials</label>
              <input
                id="staff-initials"
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                maxLength={3}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="staff-detail">Title / detail</label>
              <input
                id="staff-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="e.g. Night shift"
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
              {saving ? "Saving…" : mode === "create" ? "Add staff" : "Save changes"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
