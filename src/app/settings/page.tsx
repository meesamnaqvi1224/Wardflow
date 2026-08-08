"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";

/**
 * Account settings for every signed-in role.
 * Password change uses Supabase Auth; profile fields live under My profile.
 */
export default function SettingsPage() {
  const { staff, user, authMode, changePassword } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const authReady = authMode === "auth" && Boolean(user?.email);

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOk(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
          <p className="muted">
            Manage sign-in security. Display name and role live under{" "}
            <Link href="/profile" className="text-link" style={{ display: "inline" }}>
              My profile
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="two-col profile-layout">
        <div className="panel panel-pad">
          <h2>Account</h2>
          <dl className="settings-dl">
            <div>
              <dt>Display name</dt>
              <dd>{staff.name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd style={{ textTransform: "capitalize" }}>{staff.role}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email ?? "— (local demo session)"}</dd>
            </div>
            <div>
              <dt>Staff ID</dt>
              <dd>
                <code>{staff.id}</code>
              </dd>
            </div>
          </dl>
          <Link href="/profile" className="btn" style={{ marginTop: 12, display: "inline-block" }}>
            Edit profile
          </Link>
        </div>

        <div className="panel panel-pad">
          <h2>Change password</h2>
          {!authReady ? (
            <p className="muted">
              Password changes require a Supabase Auth session. Sign in with email to
              manage your password.
            </p>
          ) : (
            <form className="profile-form" onSubmit={(e) => void handlePassword(e)}>
              <div className="form-grid">
                <div className="field full">
                  <label htmlFor="current-password">Current password</label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="field full">
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="field full">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>
              {error ? (
                <div className="login-error" role="alert" style={{ marginTop: 14 }}>
                  {error}
                </div>
              ) : null}
              {ok ? (
                <div className="clinical-callout" style={{ marginTop: 14 }}>
                  Password updated successfully.
                </div>
              ) : null}
              <div className="drawer-actions" style={{ borderTop: "none", paddingTop: 8 }}>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? "Updating…" : "Update password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
