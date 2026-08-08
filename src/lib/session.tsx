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
import type { User } from "@supabase/supabase-js";
import type {
  AuditEvent,
  Patient,
  PatientStatus,
  Role,
  StaffMember,
  TaskPriority,
  Vitals,
  WardData,
} from "./types";
import { SEED, STAFF } from "./seed";
import {
  applyAddNote,
  applyAdministerMedication,
  applyAlertStatus,
  applyCompleteTask,
  applyCreateTask,
  applyOrderMedication,
  applyRecordVitals,
  evaluateVitals,
} from "./domain";
import {
  getDataSource,
  loadAuditEvents,
  loadWardBundle,
  persistAddNote,
  persistAdministerMedication,
  persistAlertStatus,
  persistCompleteTask,
  persistCreateStaff,
  persistCreateTask,
  persistOrderMedication,
  persistPatientProfile,
  persistRecordVitals,
  persistStaffProfile,
  persistUpdateStaff,
  resetWardToSeed,
} from "./supabase/ward";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "./supabase/client";

/**
 * Session context: acting staff + ward data + optional Supabase Auth.
 *
 * - Supabase configured: real login; staff resolved via staff.auth_user_id.
 * - Not configured: local seed + demo RoleSwitcher (Phase 2 offline mode).
 */

type LoadState = "loading" | "ready" | "error";
type AuthMode = "seed" | "auth";
type AuthStatus =
  | "loading"
  | "signed_out"
  | "signed_in"
  | "unlinked"
  | "seed";

interface SessionValue {
  /** Current acting staff (authenticated profile or demo selection). */
  staff: StaffMember;
  /** Demo-only: switch staff when auth is not configured. */
  setStaffId: (id: string) => void;
  allStaff: StaffMember[];
  data: WardData;
  toast: string | null;
  clearToast: () => void;
  loadState: LoadState;
  loadError: string | null;
  dataSource: "supabase" | "seed";
  refreshing: boolean;
  authMode: AuthMode;
  authStatus: AuthStatus;
  user: User | null;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  recordVitals: (
    patientId: string,
    vitals: Vitals,
    note?: string,
  ) => Promise<{ abnormalCount: number }>;
  updateStaffProfile: (input: {
    name: string;
    detail: string;
    initials: string;
  }) => Promise<{ error: string | null }>;
  updatePatientProfile: (
    patientId: string,
    input: {
      name: string;
      age: number;
      room: string;
      diagnosis: string;
      allergy: string;
      status: PatientStatus;
      doctorId: string;
      nurseId: string;
    },
  ) => Promise<{ error: string | null }>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  createTask: (input: {
    patientId: string;
    title: string;
    due: string;
    priority: TaskPriority;
  }) => Promise<{ error: string | null }>;
  administerMedication: (medicationId: string) => Promise<void>;
  orderMedication: (input: {
    patientId: string;
    name: string;
    dose: string;
    due: string;
  }) => Promise<{ error: string | null }>;
  addNote: (input: {
    patientId: string;
    type: string;
    content: string;
  }) => Promise<{ error: string | null }>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<{ error: string | null }>;
  createStaffMember: (input: {
    name: string;
    role: Role;
    detail: string;
    initials: string;
  }) => Promise<{ error: string | null }>;
  updateStaffMember: (input: {
    id: string;
    name: string;
    role: Role;
    detail: string;
    initials: string;
  }) => Promise<{ error: string | null }>;
  fetchAuditLog: (limit?: number) => Promise<{
    events: AuditEvent[];
    error: string | null;
  }>;
  resetDemo: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const DEFAULT_STAFF_ID = "nurse-1";

function emptyWard(): WardData {
  return structuredClone(SEED);
}

async function fetchStaffForUser(
  userId: string,
): Promise<StaffMember | null> {
  const sb = createSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("staff")
    .select("id,name,role,detail,initials,auth_user_id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    role: data.role,
    detail: data.detail ?? "",
    initials: data.initials,
    authUserId: data.auth_user_id ?? null,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const authMode: AuthMode = isSupabaseConfigured() ? "auth" : "seed";

  const [staffId, setStaffId] = useState<string>(DEFAULT_STAFF_ID);
  const [authStaff, setAuthStaff] = useState<StaffMember | null>(null);
  const [allStaff, setAllStaff] = useState<StaffMember[]>(STAFF);
  const [data, setData] = useState<WardData>(emptyWard);
  const [toast, setToast] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(
    authMode === "seed" ? "loading" : "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"supabase" | "seed">(getDataSource());
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    authMode === "seed" ? "seed" : "loading",
  );
  const [authError, setAuthError] = useState<string | null>(null);

  const dataRef = useRef(data);
  const loadStateRef = useRef(loadState);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  const staff: StaffMember =
    authMode === "auth"
      ? (authStaff ??
        allStaff.find((s) => s.id === DEFAULT_STAFF_ID) ??
        STAFF[0])
      : (allStaff.find((s) => s.id === staffId) ??
        allStaff.find((s) => s.id === DEFAULT_STAFF_ID) ??
        STAFF[0]);

  const clearToast = useCallback(() => setToast(null), []);

  const loadWard = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setRefreshing(true);
    try {
      const bundle = await loadWardBundle();
      setAllStaff(bundle.staff);
      setData(bundle.data);
      setDataSource(bundle.source);
      setLoadError(null);
      setLoadState("ready");
      return bundle;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ward data";
      setLoadError(message);
      if (loadStateRef.current !== "ready") {
        setAllStaff(STAFF);
        setData(emptyWard());
        setDataSource("seed");
        setLoadState("ready");
        if (authMode === "seed") {
          setToast(`Supabase load failed — using local demo data. ${message}`);
        }
      } else {
        setToast(`Refresh failed: ${message}`);
      }
      throw err;
    } finally {
      if (!opts?.soft) setRefreshing(false);
    }
  }, [authMode]);

  const reload = useCallback(async () => {
    try {
      await loadWard();
    } catch {
      /* toast already set */
    }
  }, [loadWard]);

  const resolveAuthUser = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    setAuthError(null);

    if (!nextUser) {
      setAuthStaff(null);
      setAuthStatus("signed_out");
      setData(emptyWard());
      setLoadState("ready");
      return;
    }

    try {
      const profile = await fetchStaffForUser(nextUser.id);
      if (!profile) {
        setAuthStaff(null);
        setAuthStatus("unlinked");
        setAuthError(
          "This account is signed in but not linked to a staff profile. Run scripts/setup-demo-auth.mjs or set staff.auth_user_id in Supabase.",
        );
        setLoadState("ready");
        return;
      }
      setAuthStaff(profile);
      setAuthStatus("signed_in");
      setLoadState("loading");
      try {
        await loadWard({ soft: true });
      } catch {
        /* loadWard sets error state */
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load staff profile";
      setAuthStaff(null);
      setAuthStatus("unlinked");
      setAuthError(message);
      setLoadState("ready");
    }
  }, [loadWard]);

  // Seed mode: load ward once, no auth.
  useEffect(() => {
    if (authMode !== "seed") return;
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
  }, [authMode]);

  // Auth mode: subscribe to session.
  useEffect(() => {
    if (authMode !== "auth") return;
    const sb = createSupabaseBrowserClient();
    if (!sb) {
      setAuthStatus("signed_out");
      setLoadState("ready");
      return;
    }

    let cancelled = false;

    sb.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      void resolveAuthUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      void resolveAuthUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [authMode, resolveAuthUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const sb = createSupabaseBrowserClient();
      if (!sb) return { error: "Supabase is not configured" };
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      // onAuthStateChange will resolve staff + ward data
      return { error: null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const sb = createSupabaseBrowserClient();
    if (sb) await sb.auth.signOut();
    setAuthStaff(null);
    setUser(null);
    setAuthStatus("signed_out");
    setData(emptyWard());
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

  const completeTask = useCallback(
    async (taskId: string) => {
      const result = applyCompleteTask(dataRef.current, taskId, staff.name);
      if (!result) return;
      dataRef.current = result.data;
      setData(result.data);
      try {
        await persistCompleteTask({
          task: result.task,
          newTimeline: result.newTimeline,
          staffId: staff.id,
          staffName: staff.name,
        });
        setToast(`Task completed${dataSource === "supabase" ? " (saved)" : ""}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Local only — Supabase error: ${message}`);
        if (dataSource === "supabase") void reload();
      }
    },
    [staff.id, staff.name, dataSource, reload],
  );

  const createTask = useCallback(
    async (input: {
      patientId: string;
      title: string;
      due: string;
      priority: TaskPriority;
    }) => {
      const result = applyCreateTask(dataRef.current, {
        ...input,
        staffName: staff.name,
      });
      if (!result) return { error: "Could not create task." };
      dataRef.current = result.data;
      setData(result.data);
      try {
        await persistCreateTask({
          task: result.task,
          newTimeline: result.newTimeline,
          staffId: staff.id,
          staffName: staff.name,
        });
        setToast(`Task created${dataSource === "supabase" ? " (saved)" : ""}`);
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Local only — Supabase error: ${message}`);
        if (dataSource === "supabase") void reload();
        return { error: message };
      }
    },
    [staff.id, staff.name, dataSource, reload],
  );

  const administerMedication = useCallback(
    async (medicationId: string) => {
      const result = applyAdministerMedication(
        dataRef.current,
        medicationId,
        staff.name,
      );
      if (!result) return;
      dataRef.current = result.data;
      setData(result.data);
      try {
        await persistAdministerMedication({
          medication: result.medication,
          newTimeline: result.newTimeline,
          staffId: staff.id,
          staffName: staff.name,
        });
        setToast(
          `Medication recorded${dataSource === "supabase" ? " (saved)" : ""}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Local only — Supabase error: ${message}`);
        if (dataSource === "supabase") void reload();
      }
    },
    [staff.id, staff.name, dataSource, reload],
  );

  const orderMedication = useCallback(
    async (input: {
      patientId: string;
      name: string;
      dose: string;
      due: string;
    }) => {
      const result = applyOrderMedication(dataRef.current, {
        ...input,
        staffName: staff.name,
      });
      if (!result) return { error: "Could not order medication." };
      dataRef.current = result.data;
      setData(result.data);
      try {
        await persistOrderMedication({
          medication: result.medication,
          newTimeline: result.newTimeline,
          staffId: staff.id,
          staffName: staff.name,
        });
        setToast(
          `Medication ordered${dataSource === "supabase" ? " (saved)" : ""}`,
        );
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Local only — Supabase error: ${message}`);
        if (dataSource === "supabase") void reload();
        return { error: message };
      }
    },
    [staff.id, staff.name, dataSource, reload],
  );

  const addNote = useCallback(
    async (input: { patientId: string; type: string; content: string }) => {
      const result = applyAddNote(dataRef.current, {
        ...input,
        staffName: staff.name,
      });
      if (!result) return { error: "Could not add note." };
      dataRef.current = result.data;
      setData(result.data);
      try {
        await persistAddNote({
          note: result.note,
          newTimeline: result.newTimeline,
          staffId: staff.id,
          staffName: staff.name,
        });
        setToast(`Note saved${dataSource === "supabase" ? " to Supabase" : ""}`);
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Local only — Supabase error: ${message}`);
        if (dataSource === "supabase") void reload();
        return { error: message };
      }
    },
    [staff.id, staff.name, dataSource, reload],
  );

  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string }) => {
      if (authMode !== "auth") {
        return { error: "Password change requires Supabase Auth." };
      }
      const sb = createSupabaseBrowserClient();
      if (!sb || !user?.email) {
        return { error: "Not signed in." };
      }
      const newPassword = input.newPassword;
      if (newPassword.length < 8) {
        return { error: "New password must be at least 8 characters." };
      }
      const { error: reauthError } = await sb.auth.signInWithPassword({
        email: user.email,
        password: input.currentPassword,
      });
      if (reauthError) {
        return { error: "Current password is incorrect." };
      }
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) return { error: error.message };
      setToast("Password updated");
      return { error: null };
    },
    [authMode, user],
  );

  const createStaffMember = useCallback(
    async (input: {
      name: string;
      role: Role;
      detail: string;
      initials: string;
    }) => {
      if (staff.role !== "admin") {
        return { error: "Only admins can add staff." };
      }
      const name = input.name.trim();
      const initials = input.initials.trim().toUpperCase().slice(0, 3);
      if (!name || !initials) {
        return { error: "Name and initials are required." };
      }
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `${input.role}_${crypto.randomUUID().slice(0, 8)}`
          : `${input.role}_${Date.now()}`;
      const member: StaffMember = {
        id,
        name,
        role: input.role,
        detail: input.detail.trim(),
        initials,
        authUserId: null,
      };
      const previous = allStaff;
      setAllStaff((list) =>
        [...list, member].sort((a, b) => a.name.localeCompare(b.name)),
      );
      try {
        await persistCreateStaff(member);
        setToast("Staff member added");
        return { error: null };
      } catch (err) {
        setAllStaff(previous);
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Could not add staff: ${message}`);
        return { error: message };
      }
    },
    [staff.role, allStaff],
  );

  const updateStaffMember = useCallback(
    async (input: {
      id: string;
      name: string;
      role: Role;
      detail: string;
      initials: string;
    }) => {
      if (staff.role !== "admin") {
        return { error: "Only admins can edit staff." };
      }
      const existing = allStaff.find((s) => s.id === input.id);
      if (!existing) return { error: "Staff not found." };
      const name = input.name.trim();
      const initials = input.initials.trim().toUpperCase().slice(0, 3);
      if (!name || !initials) {
        return { error: "Name and initials are required." };
      }
      const next: StaffMember = {
        ...existing,
        name,
        role: input.role,
        detail: input.detail.trim(),
        initials,
      };
      const previous = allStaff;
      const previousAuth = authStaff;
      setAllStaff((list) => list.map((s) => (s.id === next.id ? next : s)));
      if (authStaff?.id === next.id) setAuthStaff(next);
      try {
        await persistUpdateStaff(next);
        setToast("Staff updated");
        return { error: null };
      } catch (err) {
        setAllStaff(previous);
        if (previousAuth) setAuthStaff(previousAuth);
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Could not update staff: ${message}`);
        return { error: message };
      }
    },
    [staff.role, allStaff, authStaff],
  );

  const fetchAuditLog = useCallback(async (limit = 50) => {
    try {
      const events = await loadAuditEvents(limit);
      return { events, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load audit log";
      return { events: [] as AuditEvent[], error: message };
    }
  }, []);

  const updateStaffProfile = useCallback(
    async (input: { name: string; detail: string; initials: string }) => {
      const name = input.name.trim();
      const detail = input.detail.trim();
      const initials = input.initials.trim().toUpperCase().slice(0, 3);
      if (!name || !initials) {
        return { error: "Name and initials are required." };
      }

      const next: StaffMember = {
        ...staff,
        name,
        detail,
        initials,
      };

      const previousAuth = authStaff;
      const previousAll = allStaff;

      if (authMode === "auth") setAuthStaff(next);
      setAllStaff((list) => list.map((s) => (s.id === staff.id ? next : s)));

      try {
        await persistStaffProfile({
          staffId: staff.id,
          name: next.name,
          detail: next.detail,
          initials: next.initials,
        });
        setToast(
          dataSource === "supabase"
            ? "Profile saved"
            : "Profile updated (local demo)",
        );
        return { error: null };
      } catch (err) {
        if (authMode === "auth") setAuthStaff(previousAuth);
        setAllStaff(previousAll);
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Could not save profile: ${message}`);
        return { error: message };
      }
    },
    [staff, authStaff, allStaff, authMode, dataSource],
  );

  const updatePatientProfile = useCallback(
    async (
      patientId: string,
      input: {
        name: string;
        age: number;
        room: string;
        diagnosis: string;
        allergy: string;
        status: PatientStatus;
        doctorId: string;
        nurseId: string;
      },
    ) => {
      const existing = dataRef.current.patients.find((p) => p.id === patientId);
      if (!existing) return { error: "Patient not found." };

      const name = input.name.trim();
      const room = input.room.trim();
      const diagnosis = input.diagnosis.trim();
      const allergy = input.allergy.trim() || "None recorded";
      if (!name || !room || !diagnosis || !Number.isFinite(input.age) || input.age <= 0) {
        return { error: "Name, age, room, and diagnosis are required." };
      }

      const nextPatient: Patient = {
        ...existing,
        name,
        age: Math.round(input.age),
        room,
        diagnosis,
        allergy,
        status: input.status,
        doctorId: input.doctorId,
        nurseId: input.nurseId,
        updated: "Just now",
      };

      const previous = dataRef.current;
      const nextData: WardData = {
        ...previous,
        patients: previous.patients.map((p) =>
          p.id === patientId ? nextPatient : p,
        ),
      };
      dataRef.current = nextData;
      setData(nextData);

      try {
        await persistPatientProfile({ patient: nextPatient });
        setToast(
          dataSource === "supabase"
            ? "Patient profile saved"
            : "Patient profile updated (local demo)",
        );
        return { error: null };
      } catch (err) {
        dataRef.current = previous;
        setData(previous);
        const message = err instanceof Error ? err.message : "Save failed";
        setToast(`Could not save patient: ${message}`);
        return { error: message };
      }
    },
    [dataSource],
  );

  const resetDemo = useCallback(async () => {
    if (authMode === "auth" && staff.role !== "admin") {
      setToast("Only admins can reset demo data.");
      return;
    }
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
  }, [authMode, staff.role]);

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
      authMode,
      authStatus,
      user,
      authError,
      signIn,
      signOut,
      recordVitals,
      updateStaffProfile,
      updatePatientProfile,
      acknowledgeAlert,
      resolveAlert,
      completeTask,
      createTask,
      administerMedication,
      orderMedication,
      addNote,
      changePassword,
      createStaffMember,
      updateStaffMember,
      fetchAuditLog,
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
      authMode,
      authStatus,
      user,
      authError,
      signIn,
      signOut,
      recordVitals,
      updateStaffProfile,
      updatePatientProfile,
      acknowledgeAlert,
      resolveAlert,
      completeTask,
      createTask,
      administerMedication,
      orderMedication,
      addNote,
      changePassword,
      createStaffMember,
      updateStaffMember,
      fetchAuditLog,
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
