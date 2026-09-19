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
    email?: string;
    name: string;
    role: Role;
    detail: string;
    initials: string;
  }) => Promise<{ error: string | null }>;
}) {
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<Role>(initial?.role ?? "nurse");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [initials, setInitials] = useState(initial?.initials ?? "");
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
        email: mode === "create" ? email : undefined,
        name,
        role,
        detail,
        initials,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (mode === "create") {
        // No email is sent automatically: tell the admin how the person joins.
        setInvitedEmail(email.trim().toLowerCase());
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
              {mode === "create" ? "Invite staff member" : `Edit · ${initial?.name}`}
            </h2>
            <p className="muted">
              {mode === "create"
                ? "They join your hospital when they sign up with this email and verify it."
                : "Changes apply immediately."}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {invitedEmail ? (
          <div>
            <div className="clinical-callout">
              <strong>Invitation created for {invitedEmail}.</strong>
              <p style={{ margin: "8px 0 0" }}>
                WardFlow does not send an email for this yet. Send them the link below.
                They must sign up with <strong>exactly this email</strong>, verify it, and
                they will join your hospital as a {role}.
              </p>
            </div>
            <div className="field full" style={{ marginTop: 14 }}>
              <label htmlFor="invite-link">Sign-up link</label>
              <input
                id="invite-link"
                readOnly
                value={`${typeof window === "undefined" ? "" : window.location.origin}/signup`}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <div className="drawer-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(`${window.location.origin}/signup`)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <button type="button" className="btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="form-grid">
            {mode === "create" ? (
              <div className="field full">
                <label htmlFor="staff-email">Email</label>
                <input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hospital.org"
                  required
                />
              </div>
            ) : null}
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
              {saving ? "Saving…" : mode === "create" ? "Send invitation" : "Save changes"}
            </button>
          </div>
        </form>
        )}
      </aside>
    </div>
  );
}
