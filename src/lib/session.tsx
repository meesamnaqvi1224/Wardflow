"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { StaffMember, Vitals, WardData } from "./types";
import { SEED, STAFF } from "./seed";
import { applyAlertStatus, applyRecordVitals, evaluateVitals } from "./domain";
import {
  getDataSource,
  loadWardBundle,
  persistAlertStatus,
  persistRecordVitals,
  resetWardToSeed,
} from "./supabase/ward";

/**
 * Session context: acting staff + ward data.
 *
 * When Supabase env is configured, loads and persists against the remote DB.
 * Falls back to local seed if env is missing or the first load fails.
 */

type LoadState = "loading" | "ready" | "error";

interface SessionValue {
  staff: StaffMember;
  setStaffId: (id: string) => void;
  allStaff: StaffMember[];
  data: WardData;
  toast: string | null;
  clearToast: () => void;
  loadState: LoadState;
  loadError: string | null;
  dataSource: "supabase" | "seed";
  refreshing: boolean;
  recordVitals: (
    patientId: string,
    vitals: Vitals,
    note?: string,
  ) => Promise<{ abnormalCount: number }>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  resetDemo: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const DEFAULT_STAFF_ID = "nurse-1";

function emptyWard(): WardData {
  return structuredClone(SEED);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [staffId, setStaffId] = useState<string>(DEFAULT_STAFF_ID);
  const [allStaff, setAllStaff] = useState<StaffMember[]>(STAFF);
  const [data, setData] = useState<WardData>(emptyWard);
  const [toast, setToast] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"supabase" | "seed">(getDataSource());
  const [refreshing, setRefreshing] = useState(false);
  const dataRef = useRef(data);
  const loadStateRef = useRef(loadState);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  const staff =
    allStaff.find((s) => s.id === staffId) ??
    allStaff.find((s) => s.id === DEFAULT_STAFF_ID) ??
    STAFF[0];

  const clearToast = useCallback(() => setToast(null), []);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const bundle = await loadWardBundle();
      setAllStaff(bundle.staff);
      setData(bundle.data);
      setDataSource(bundle.source);
      setLoadError(null);
      setLoadState("ready");
      if (!bundle.staff.some((s) => s.id === staffId)) {
        setStaffId(DEFAULT_STAFF_ID);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ward data";
      setLoadError(message);
      if (loadStateRef.current !== "ready") {
        setAllStaff(STAFF);
        setData(emptyWard());
        setDataSource("seed");
        setLoadState("ready");
        setToast(`Supabase load failed — using local demo data. ${message}`);
      } else {
        setToast(`Refresh failed: ${message}`);
      }
    } finally {
      setRefreshing(false);
    }
  }, [staffId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bundle = await loadWardBundle();
        if (cancelled) return;
        setAllStaff(bundle.staff);
        setData(bundle.data);
        setDataSource(bundle.source);
        setLoadState("ready");
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load ward data";
        setAllStaff(STAFF);
        setData(emptyWard());
        setDataSource("seed");
        setLoadState("ready");
        setLoadError(message);
        setToast(`Supabase load failed — using local demo data. ${message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordVitals = useCallback(
    async (patientId: string, vitals: Vitals, note?: string) => {
      const abnormalCount = evaluateVitals(vitals).length;
      const result = applyRecordVitals(dataRef.current, {
        patientId,
        vitals,
        staffName: staff.name,
        note,
      });
      if (!result) return { abnormalCount: 0 };

      dataRef.current = result.data;
      setData(result.data);

      try {
        await persistRecordVitals({
          patient: result.patient,
          vitals,
          note,
          staffId: staff.id,
          newAlert: result.newAlert,
          newTimeline: result.newTimeline,
        });
        setToast(
          abnormalCount > 0
            ? `Vitals saved${dataSource === "supabase" ? " to Supabase" : ""}. ${abnormalCount} abnormal reading${abnormalCount > 1 ? "s" : ""} detected.`
            : `Vitals saved successfully${dataSource === "supabase" ? " to Supabase" : ""}.`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Saved locally only — Supabase error: ${message}`);
        if (dataSource === "supabase") void reload();
      }

      return { abnormalCount };
    },
    [staff.id, staff.name, dataSource, reload],
  );

  const updateAlert = useCallback(
    async (alertId: string, status: "acknowledged" | "resolved") => {
      const result = applyAlertStatus(dataRef.current, alertId, status, staff.name);
      if (!result) return;

      dataRef.current = result.data;
      setData(result.data);
      const label = status === "acknowledged" ? "acknowledged" : "resolved";

      try {
        await persistAlertStatus({
          alert: result.alert,
          patientId: result.patientId,
          patientStatus: result.patientStatus,
          newTimeline: result.newTimeline,
          staffId: staff.id,
          staffName: staff.name,
        });
        setToast(`Alert ${label}${dataSource === "supabase" ? " (saved)" : ""}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Local only — Supabase error: ${message}`);
        if (dataSource === "supabase") void reload();
      }
    },
    [staff.id, staff.name, dataSource, reload],
  );

  const acknowledgeAlert = useCallback(
    (alertId: string) => updateAlert(alertId, "acknowledged"),
    [updateAlert],
  );

  const resolveAlert = useCallback(
    (alertId: string) => updateAlert(alertId, "resolved"),
    [updateAlert],
  );

  const resetDemo = useCallback(async () => {
    setRefreshing(true);
    try {
      const bundle = await resetWardToSeed();
      setAllStaff(bundle.staff);
      setData(bundle.data);
      setDataSource(bundle.source);
      setToast(
        bundle.source === "supabase"
          ? "Demo data reset in Supabase"
          : "Demo data reset",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reset failed";
      setToast(`Reset failed: ${message}`);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      staff,
      setStaffId,
      allStaff,
      data,
      toast,
      clearToast,
      loadState,
      loadError,
      dataSource,
      refreshing,
      recordVitals,
      acknowledgeAlert,
      resolveAlert,
      resetDemo,
      reload,
    }),
    [
      staff,
      allStaff,
      data,
      toast,
      clearToast,
      loadState,
      loadError,
      dataSource,
      refreshing,
      recordVitals,
      acknowledgeAlert,
      resolveAlert,
      resetDemo,
      reload,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
