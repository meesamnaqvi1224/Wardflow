"use client";

import { useSession } from "@/lib/session";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { AuthUserMenu } from "@/components/AuthUserMenu";

/**
 * Top bar: mobile menu, search, data actions, and identity.
 * Auth mode shows the signed-in staff + sign out; seed mode keeps RoleSwitcher.
 */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { staff, resetDemo, reload, refreshing, dataSource, authMode } =
    useSession();

  const canReset = authMode === "seed" || staff.role === "admin";

  return (
    <header className="topbar">
      <button className="btn mobile-menu" onClick={onMenu} aria-label="Toggle navigation">
        Menu
      </button>
      <input
        className="search"
        type="search"
        placeholder="Search patients by name, room, or diagnosis..."
        aria-label="Search patients"
      />
      <div className="top-spacer" />
      {dataSource === "supabase" ? (
        <button
          type="button"
          className="btn"
          onClick={() => void reload()}
          disabled={refreshing}
          title="Reload from Supabase"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      ) : null}
      {canReset ? (
        <button
          type="button"
          className="btn"
          onClick={() => void resetDemo()}
          disabled={refreshing}
          title="Restore seed demo data"
        >
          Reset demo
        </button>
      ) : null}
      {authMode === "auth" ? <AuthUserMenu /> : <RoleSwitcher />}
      <div className="avatar" aria-hidden="true">
        {staff.initials}
      </div>
    </header>
  );
}
