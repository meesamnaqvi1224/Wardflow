"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "@/lib/session";

/**
 * Signed-in staff profile. Every role can edit their own display fields.
 * Role is read-only (admin-managed). Settings (password, etc.) come later.
 */
export default function ProfilePage() {
  const { staff, user, authMode, updateStaffProfile, dataSource } = useSession();
  const [name, setName] = useState(staff.name);
  const [detail, setDetail] = useState(staff.detail);
  const [initials, setInitials] = useState(staff.initials);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(staff.name);
    setDetail(staff.detail);
    setInitials(staff.initials);
    setError(null);
    setSaved(false);
  }, [staff.id, staff.name, staff.detail, staff.initials]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateStaffProfile({ name, detail, initials });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setName(staff.name);
    setDetail(staff.detail);
    setInitials(staff.initials);
    setError(null);
    setSaved(false);
  }

  const dirty =
    name.trim() !== staff.name ||
    detail.trim() !== staff.detail ||
    initials.trim().toUpperCase() !== staff.initials;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1>My profile</h1>
          <p className="muted">
            Update how you appear across the ward. Role is managed by an
            administrator.
          </p>
        </div>
      </div>

      <div className="two-col profile-layout">
        <div className="panel panel-pad profile-card">
          <div className="profile-avatar" aria-hidden="true">
            {staff.initials}
          </div>
          <h2 style={{ marginBottom: 4 }}>{staff.name}</h2>
          <p className="muted" style={{ marginBottom: 12, textTransform: "capitalize" }}>
            {staff.role}
            {staff.detail ? ` · ${staff.detail}` : null}
          </p>
          {authMode === "auth" && user?.email ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Signed in as <strong style={{ color: "var(--ink)" }}>{user.email}</strong>
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              Local demo session
              {dataSource === "seed" ? " · seed data" : null}
            </p>
          )}
        </div>

        <div className="panel panel-pad">
          <h2>Edit profile</h2>
          <form className="profile-form" onSubmit={(e) => void handleSubmit(e)}>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="profile-name">Display name</label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="field">
                <label htmlFor="profile-initials">Initials</label>
                <input
                  id="profile-initials"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  maxLength={3}
                  required
                  aria-describedby="initials-help"
                />
                <span id="initials-help" className="field-hint">
                  Up to 3 characters (avatar)
                </span>
              </div>
              <div className="field">
                <label htmlFor="profile-role">Role</label>
                <input
                  id="profile-role"
                  value={staff.role}
                  readOnly
                  disabled
                  className="input-readonly"
                />
              </div>
              <div className="field full">
                <label htmlFor="profile-detail">Title / shift detail</label>
                <input
                  id="profile-detail"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="e.g. Day shift, Attending physician"
                />
              </div>
            </div>

            {error ? (
              <div className="login-error" role="alert" style={{ marginTop: 14 }}>
                {error}
              </div>
            ) : null}
            {saved && !error ? (
              <div className="clinical-callout" style={{ marginTop: 14 }}>
                Profile saved successfully.
              </div>
            ) : null}

            <div className="drawer-actions" style={{ borderTop: "none", paddingTop: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={resetForm}
                disabled={saving || !dirty}
              >
                Reset
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={saving || !dirty}
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
