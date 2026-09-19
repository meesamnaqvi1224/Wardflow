import { Suspense } from "react";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="login-page">
          <div className="login-card">
            <div className="empty">Loading…</div>
          </div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
