"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

/**
 * Shown to a signed-in user who does not belong to a hospital yet. They either
 * create one (and become its first admin) or wait for an invitation, which is
 * claimed automatically once their email is verified.
 */
export function OnboardingScreen() {
  const { user, authError, createHospital, refreshAccount, signOut, resendConfirmation } =
    useSession();
  const router = useRouter();

  const [hospitalName, setHospitalName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [wardName, setWardName] = useState("Main Ward");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

  // The server refuses hospital creation and invite claims until the email is verified.
  const needsVerification = (authError ?? "").toLowerCase().includes("verify your email");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const result = await createHospital({
        hospitalName: hospitalName.trim(),
        adminName: adminName.trim(),
        wardName: wardName.trim() || undefined,
      });
      if (result.error) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckAgain() {
    setError(null);
    setNotice(null);
    setChecking(true);
    try {
      await refreshAccount();
      setNotice("Checked again. If nothing changed, no invitation is waiting for this email yet.");
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    const result = await resendConfirmation();
    if (result.error) setError(result.error);
    else setNotice("Confirmation email sent. Check your inbox and spam folder.");
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          Ward<span>Flow</span>
        </div>
        <p className="eyebrow">Set up your hospital</p>
        <h1>Welcome{user?.email ? `, ${user.email}` : ""}</h1>

        {needsVerification ? (
          <>
            <p className="muted login-sub">
              Verify your email address first. We sent a confirmation link when
              you signed up. After you open it, come back and check again.
            </p>
            <div className="drawer-actions" style={{ borderTop: "none", paddingTop: 0 }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => void handleCheckAgain()}
                disabled={checking}
              >
                {checking ? "Checking…" : "I verified, check again"}
              </button>
              <button type="button" className="btn" onClick={() => void handleResend()}>
                Resend email
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted login-sub">
              Create a hospital and you become its administrator. Were you
              invited instead? Ask your admin to invite this exact email, then
              check again.
            </p>

            <form className="login-form" onSubmit={(e) => void handleCreate(e)}>
              <label className="login-label" htmlFor="hospital-name">
                Hospital name
              </label>
              <input
                id="hospital-name"
                className="login-input"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="e.g. Riverside General Hospital"
                maxLength={120}
                required
                autoFocus
              />

              <label className="login-label" htmlFor="admin-name">
                Your name
              </label>
              <input
                id="admin-name"
                className="login-input"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Jordan Lee"
                autoComplete="name"
                required
              />

              <label className="login-label" htmlFor="ward-name">
                First ward
              </label>
              <input
                id="ward-name"
                className="login-input"
                value={wardName}
                onChange={(e) => setWardName(e.target.value)}
                maxLength={80}
              />

              {error ? (
                <div className="login-error" role="alert">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="btn primary login-submit"
                disabled={submitting || !hospitalName.trim() || !adminName.trim()}
              >
                {submitting ? "Creating…" : "Create hospital"}
              </button>
            </form>

            <div className="drawer-actions" style={{ borderTop: "none", paddingTop: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => void handleCheckAgain()}
                disabled={checking}
              >
                {checking ? "Checking…" : "Check for an invitation"}
              </button>
            </div>
          </>
        )}

        {error && needsVerification ? (
          <div className="login-error" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="clinical-callout" style={{ marginTop: 14 }}>
            {notice}
          </div>
        ) : null}
        {authError && !needsVerification ? (
          <div className="login-error" role="alert" style={{ marginTop: 14 }}>
            {authError}
          </div>
        ) : null}

        <p className="muted login-foot">
          <button
            type="button"
            className="mini-btn"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
