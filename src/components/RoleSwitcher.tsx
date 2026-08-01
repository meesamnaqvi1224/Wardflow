"use client";

import { useSession } from "@/lib/session";

/**
 * Offline demo role switcher — only used when Supabase is not configured.
 * Phase 4 replaces this with real Auth accounts in auth mode.
 */
export function RoleSwitcher() {
  const { staff, setStaffId, allStaff } = useSession();

  return (
    <select
      className="role-select"
      id="role-select"
      aria-label="Switch demo role"
      value={staff.id}
      onChange={(e) => setStaffId(e.target.value)}
    >
      {allStaff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} · {s.role}
        </option>
      ))}
    </select>
  );
}
