"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";

export function LoginForm() {
  const { signIn, authMode, authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const offline = authMode === "seed";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signError } = await signIn(email.trim(), password);
      if (signError) {
        setError(signError);
        return;
      }
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          Ward<span>Flow</span>
        </div>
        <p className="eyebrow">Care team access</p>
        <h1>Sign in</h1>
        <p className="muted login-sub">
          {offline
            ? "Authentication is not configured for this environment."
            : "Enter your credentials to access the ward portal."}
        </p>

        {offline ? (
          <div className="clinical-callout" style={{ marginBottom: 18 }}>
            This environment is running without Supabase. Contact your
            administrator or configure{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </div>
        ) : (
          <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
            <label className="login-label" htmlFor="email">
              Email
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
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error ? (
              <div className="login-error" role="alert">
                {error}
              </div>
            ) : null}

            {authStatus === "unlinked" ? (
              <div className="login-error" role="alert">
                Your account is signed in but is not linked to a care-team
                profile. Contact your ward administrator.
              </div>
            ) : null}

            <button
              type="submit"
              className="btn primary login-submit"
              disabled={submitting || !email.trim() || !password}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        <p className="muted login-foot">
          Authorized care-team use only · Do not enter real patient data in demo
          environments
        </p>
      </div>
    </div>
  );
}
