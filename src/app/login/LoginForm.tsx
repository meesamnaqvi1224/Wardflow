"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_DEMO_PASSWORD,
  DEMO_ACCOUNTS,
} from "@/lib/auth-accounts";
import { useSession } from "@/lib/session";

export function LoginForm() {
  const { signIn, authMode, authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS[1].email);
  const [password, setPassword] = useState<string>(DEFAULT_DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const offline = authMode === "seed";

  const subtitle = useMemo(() => {
    if (offline) {
      return "Supabase is not configured — open the app directly for local demo mode.";
    }
    return "Sign in with a demo care-team account to access the ward.";
  }, [offline]);

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

  function fillAccount(nextEmail: string) {
    setEmail(nextEmail);
    setPassword(DEFAULT_DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          Ward<span>Flow</span>
        </div>
        <p className="eyebrow">Hospital ward portal</p>
        <h1>Sign in</h1>
        <p className="muted login-sub">{subtitle}</p>

        {offline ? (
          <div className="clinical-callout" style={{ marginBottom: 18 }}>
            Missing <code>NEXT_PUBLIC_SUPABASE_*</code> env vars. Start the app at{" "}
            <a href="/" className="text-link" style={{ display: "inline" }}>
              the dashboard
            </a>{" "}
            to use local seed data and the role switcher.
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
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="login-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="login-input"
              type="password"
              autoComplete="current-password"
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
                Signed in, but this user is not linked to a staff row. Run{" "}
                <code>node scripts/setup-demo-auth.mjs</code>.
              </div>
            ) : null}

            <button
              type="submit"
              className="btn primary login-submit"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {!offline ? (
          <div className="login-demo">
            <div className="nav-label" style={{ margin: "0 0 10px", color: "var(--muted)" }}>
              Demo accounts
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Shared password: <code>{DEFAULT_DEMO_PASSWORD}</code>
            </p>
            <div className="login-demo-list">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  className="btn login-demo-btn"
                  onClick={() => fillAccount(a.email)}
                >
                  <strong>{a.label}</strong>
                  <span>{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="muted login-foot">
          Demonstration system · Fictional patient data only · Not for real PHI
        </p>
      </div>
    </div>
  );
}
