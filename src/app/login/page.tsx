import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-page">
          <div className="login-card">
            <div className="empty">Loading sign-in…</div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
