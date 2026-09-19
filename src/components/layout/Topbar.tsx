"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { AuthUserMenu } from "@/components/AuthUserMenu";
import { PatientSearch } from "@/components/layout/PatientSearch";

/**
 * Top bar: mobile menu, live patient search, refresh, and identity.
 */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { staff, reload, refreshing } = useSession();

  return (
    <header className="topbar">
      <button className="btn mobile-menu" onClick={onMenu} aria-label="Toggle navigation">
        Menu
      </button>
      <PatientSearch />
      <div className="top-spacer" />
      <button
        type="button"
        className="btn"
        onClick={() => void reload()}
        disabled={refreshing}
        title="Reload from the server"
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
      <AuthUserMenu />
      <Link
        href="/profile"
        className="avatar avatar-link"
        title="My profile"
        aria-label="Open my profile"
      >
        {staff.initials}
      </Link>
    </header>
  );
}
