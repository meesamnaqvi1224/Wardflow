"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { StaffMember, Vitals, WardData } from "./types";
import { SEED, STAFF } from "./seed";
import { applyAlertStatus, applyRecordVitals, evaluateVitals } from "./domain";

/**
 * Demo session context.
 *
 * Phase 2 had read-only seed data. This layer now owns mutable ward state so
 * the vitals → alert → acknowledge flow works before Supabase is connected.
 * Phase 3/5 swap `data` + actions for Supabase queries / server actions;
 * components keep using `useSession()` unchanged.
 */

interface SessionValue {
  staff: StaffMember;
  setStaffId: (id: string) => void;
  allStaff: StaffMember[];
  data: WardData;
  toast: string | null;
  clearToast: () => void;
  recordVitals: (
    patientId: string,
    vitals: Vitals,
    note?: string,
  ) => { abnormalCount: number };
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  resetDemo: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const DEFAULT_STAFF_ID = "nurse-1";

function cloneSeed(): WardData {
  return structuredClone(SEED);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [staffId, setStaffId] = useState<string>(DEFAULT_STAFF_ID);
  const [data, setData] = useState<WardData>(cloneSeed);
  const [toast, setToast] = useState<string | null>(null);

  const staff =
    STAFF.find((s) => s.id === staffId) ?? STAFF.find((s) => s.id === DEFAULT_STAFF_ID)!;

  const clearToast = useCallback(() => setToast(null), []);

  const recordVitals = useCallback(
    (patientId: string, vitals: Vitals, note?: string) => {
      const abnormalCount = evaluateVitals(vitals).length;
      setData((prev) =>
        applyRecordVitals(prev, {
          patientId,
          vitals,
          staffName: staff.name,
          note,
        }),
      );
      setToast(
        abnormalCount > 0
          ? `Vitals recorded. ${abnormalCount} abnormal reading${abnormalCount > 1 ? "s" : ""} detected.`
          : "Vitals recorded successfully.",
      );
      return { abnormalCount };
    },
    [staff.name],
  );

  const acknowledgeAlert = useCallback(
    (alertId: string) => {
      setData((prev) => applyAlertStatus(prev, alertId, "acknowledged", staff.name));
      setToast("Alert acknowledged");
    },
    [staff.name],
  );

  const resolveAlert = useCallback(
    (alertId: string) => {
      setData((prev) => applyAlertStatus(prev, alertId, "resolved", staff.name));
      setToast("Alert resolved");
    },
    [staff.name],
  );

  const resetDemo = useCallback(() => {
    setData(cloneSeed());
    setToast("Demo data reset");
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      staff,
      setStaffId,
      allStaff: STAFF,
      data,
      toast,
      clearToast,
      recordVitals,
      acknowledgeAlert,
      resolveAlert,
      resetDemo,
    }),
    [
      staff,
      data,
      toast,
      clearToast,
      recordVitals,
      acknowledgeAlert,
      resolveAlert,
      resetDemo,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
