"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

/**
 * Signed-in identity chip: role label + sign out.
 * Replaces the demo RoleSwitcher when Supabase Auth is active.
 */
export function AuthUserMenu() {
  const { staff, signOut, refreshing } = useSession();
  const router = useRouter();

  return (
    <div className="auth-user-menu">
      <div className="auth-user-meta">
        <span className="auth-user-name">{staff.name}</span>
        <span className="auth-user-role">{staff.role}</span>
      </div>
      <button
        type="button"
        className="btn"
        disabled={refreshing}
        onClick={() => {
          void (async () => {
            await signOut();
            router.replace("/login");
            router.refresh();
          })();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
