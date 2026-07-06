"use client";

import { useSession } from "@/lib/session";
import { RoleSwitcher } from "@/components/RoleSwitcher";

/**
 * Top bar: mobile menu toggle, ward search, demo role switcher, and the acting
 * user's avatar. Search is presentational in Phase 2 — it wires up to real
 * patient filtering when the module pages arrive.
 */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { staff } = useSession();

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
      <RoleSwitcher />
      <div className="avatar" aria-hidden="true">
        {staff.initials}
      </div>
    </header>
  );
}
