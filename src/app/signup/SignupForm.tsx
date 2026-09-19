"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

/**
 * Create an account. This only creates the login; the user then either creates
 * a hospital or, if a hospital admin already invited this email, joins it
 * automatically once the email is verified.
 */
export function SignupForm() {
  const { signUp, authStatus } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Signed in already (or the account was created without email confirmation).
  useEffect(() => {
    if (authStatus === "signed_in" || authStatus === "no_hospital") {
      router.replace("/");
    }
  }, [authStatus, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUp(email.trim(), password);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.needsConfirmation) {
        setSentTo(email.trim());
      }
      // Otherwise a session exists and the effect above redirects.
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            Ward<span>Flow</span>
          </div>
          <p className="eyebrow">Almost there</p>
          <h1>Check your email</h1>
          <p className="muted login-sub">
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it to
            verify your address, then sign in. If you were invited to a
            hospital, you will join it automatically.
          </p>
          <Link href="/login" className="btn primary login-submit">
            Go to sign in
          </Link>
          <p className="muted login-foot">
            Nothing arrived? Check spam, or try signing up again in a few minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          Ward<span>Flow</span>
        </div>
        <p className="eyebrow">Get started</p>
        <h1>Create your account</h1>
        <p className="muted login-sub">
          Use your work email. Invited by a colleague? Use the email they
          invited.
        </p>

        <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="login-label" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            className="login-input"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="you@hospital.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <label className="login-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="login-input"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label className="login-label" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            className="login-input"
            type="password"
            name="confirm"
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          {error ? (
            <div className="login-error" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn primary login-submit"
            disabled={submitting || !email.trim() || !password || !confirm}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="muted login-foot">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
