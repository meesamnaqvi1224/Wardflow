"use client";

import { useSession } from "@/lib/session";

/**
 * Demo role switcher. Stands in for real login until Phase 4 — selecting a
 * staff member changes the acting user, which drives assignment filtering and
 * (later) permissions. Replaced by authenticated accounts, not extended.
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
