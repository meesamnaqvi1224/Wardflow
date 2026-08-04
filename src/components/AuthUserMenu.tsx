"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

/**
 * Signed-in identity: profile link + sign out.
 */
export function AuthUserMenu() {
  const { staff, signOut, refreshing } = useSession();
  const router = useRouter();

  return (
    <div className="auth-user-menu">
      <div className="auth-user-meta">
        <Link href="/profile" className="auth-user-name auth-user-link">
          {staff.name}
        </Link>
        <span className="auth-user-role">{staff.role}</span>
      </div>
      <Link href="/profile" className="btn">
        Profile
      </Link>
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
