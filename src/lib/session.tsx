"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { StaffMember, WardData } from "./types";
import { SEED, STAFF } from "./seed";

/**
 * Demo session context.
 *
 * Phase 2 has no auth and no database, so "who am I" is a client-side role
 * switch and the ward data is the in-memory seed. This provider is the single
 * seam we replace in later phases: Phase 4 swaps `staff` for the authenticated
 * user, and Phase 3/5 swap `data` for Supabase queries. Components consume the
 * hook and don't care which era they're in.
 */

interface SessionValue {
  staff: StaffMember;
  setStaffId: (id: string) => void;
  allStaff: StaffMember[];
  data: WardData;
}

const SessionContext = createContext<SessionValue | null>(null);

const DEFAULT_STAFF_ID = "nurse-1";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [staffId, setStaffId] = useState<string>(DEFAULT_STAFF_ID);

  const value = useMemo<SessionValue>(() => {
    const staff =
      STAFF.find((s) => s.id === staffId) ?? STAFF.find((s) => s.id === DEFAULT_STAFF_ID)!;
    return { staff, setStaffId, allStaff: STAFF, data: SEED };
  }, [staffId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
