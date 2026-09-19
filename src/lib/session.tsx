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
  Hospital,
  HospitalInvite,
  HospitalSettings,
  StaffMember,
  TaskPriority,
  Vitals,
  Ward,
  WardData,
  Role,
} from "./types";
import * as api from "./supabase/ward";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "./supabase/client";

/**
 * Session context: the signed-in staff member, their hospital and its ward data.
 *
 * Every user belongs to exactly one hospital. After Supabase Auth signs them in
 * we resolve their staff row; if they have none we try to claim a pending
 * invitation for their verified email. If that finds nothing they land in the
 * "no_hospital" state and can create a hospital.
 *
 * Business logic lives in the database (supabase/v2/03_workflows.sql). Each
 * action here calls one database function, then reloads the ward data so the UI
 * always shows what the server actually saved.
 */

type LoadState = "loading" | "ready" | "error";
type AuthStatus =
  | "loading"
  | "unconfigured"
  | "signed_out"
  | "signed_in"
  | "no_hospital";

type Result = { error: string | null };

interface SessionValue {
  /** Signed-in staff member. Only meaningful when authStatus is "signed_in". */
  staff: StaffMember;
  hospital: Hospital | null;
  wards: Ward[];
  allStaff: StaffMember[];
  data: WardData;
  toast: string | null;
  clearToast: () => void;
  loadState: LoadState;
  loadError: string | null;
  refreshing: boolean;
  /** True while a save is in flight (blocks double-submit). */
  actionBusy: boolean;
  authStatus: AuthStatus;
  user: User | null;
  authError: string | null;

  signIn: (email: string, password: string) => Promise<Result>;
  /** needsConfirmation is true when Supabase requires the user to verify their email. */
  signUp: (
    email: string,
    password: string,
  ) => Promise<Result & { needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<Result>;
  /** Re-check the account, e.g. after verifying email or accepting an invite. */
  refreshAccount: () => Promise<void>;
  createHospital: (input: {
    hospitalName: string;
    adminName: string;
    wardName?: string;
  }) => Promise<Result>;

  recordVitals: (
    patientId: string,
    vitals: Vitals,
    note?: string,
  ) => Promise<{ abnormalCount: number; error: string | null }>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  createTask: (input: {
    patientId: string;
    title: string;
    due: string;
    priority: TaskPriority;
  }) => Promise<Result>;
  administerMedication: (medicationId: string) => Promise<void>;
  orderMedication: (input: {
    patientId: string;
    name: string;
    dose: string;
    due: string;
  }) => Promise<Result>;
  addNote: (input: {
    patientId: string;
    type: string;
    content: string;
  }) => Promise<Result>;
  admitPatient: (input: {
    name: string;
    age: number;
    room: string;
    diagnosis: string;
    allergy?: string;
    wardId?: string | null;
    doctorId?: string | null;
    nurseId?: string | null;
  }) => Promise<Result & { id: string | null }>;
  updatePatientProfile: (
    patientId: string,
    input: {
      name: string;
      age: number;
      room: string;
      diagnosis: string;
      allergy: string;
      doctorId: string;
      nurseId: string;
    },
  ) => Promise<Result>;

  updateStaffProfile: (input: {
    name: string;
    detail: string;
    initials: string;
  }) => Promise<Result>;
  inviteStaff: (input: {
    email: string;
    name: string;
    role: Role;
    detail: string;
    initials: string;
  }) => Promise<Result>;
  revokeInvite: (inviteId: string) => Promise<Result>;
  updateStaffMember: (input: {
    id: string;
    name: string;
    role: Role;
    detail: string;
    initials: string;
  }) => Promise<Result>;
  setStaffActive: (staffId: string, active: boolean) => Promise<Result>;
  updateHospital: (input: {
    name?: string;
    settings?: HospitalSettings;
  }) => Promise<Result>;
  createWard: (name: string) => Promise<Result>;
  renameWard: (wardId: string, name: string) => Promise<Result>;
  fetchInvites: () => Promise<{ invites: HospitalInvite[]; error: string | null }>;
  fetchAuditLog: (limit?: number) => Promise<{
    events: AuditEvent[];
    error: string | null;
  }>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const EMPTY_WARD: WardData = {
  patients: [],
  alerts: [],
  tasks: [],
  medications: [],
  notes: [],
  timeline: [],
};

/** Stand-in used only while nobody is signed in; AppShell never renders pages then. */
const NO_STAFF: StaffMember = {
  id: "",
  name: "",
  role: "nurse",
  detail: "",
  initials: "",
  authUserId: null,
  active: false,
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();

  const [authStaff, setAuthStaff] = useState<StaffMember | null>(null);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [data, setData] = useState<WardData>(EMPTY_WARD);
  const [toast, setToast] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    configured ? "loading" : "unconfigured",
  );
  const [authError, setAuthError] = useState<string | null>(null);

  const loadStateRef = useRef(loadState);
  const userIdRef = useRef<string | null>(null);
  const resolveSeq = useRef(0);

  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  const clearToast = useCallback(() => setToast(null), []);

  const clearWard = useCallback(() => {
    setHospital(null);
    setWards([]);
    setAllStaff([]);
    setData(EMPTY_WARD);
  }, []);

  const loadWard = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setRefreshing(true);
    try {
      const bundle = await api.loadWardBundle();
      setHospital(bundle.hospital);
      setWards(bundle.wards);
      setAllStaff(bundle.staff);
      setData(bundle.data);
      setLoadError(null);
      setLoadState("ready");
      // Keep the signed-in profile (name/role edits) in step with the server.
      setAuthStaff((current) =>
        current
          ? (bundle.staff.find((s) => s.id === current.id) ?? current)
          : current,
      );
    } catch (err) {
      const message = errorMessage(err, "Failed to load ward data");
      setLoadError(message);
      if (loadStateRef.current === "ready") {
        setToast(`Refresh failed: ${message}`);
      } else {
        setLoadState("error");
      }
      throw err;
    } finally {
      if (!opts?.soft) setRefreshing(false);
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      await loadWard();
    } catch {
      /* state already updated by loadWard */
    }
  }, [loadWard]);

  const resolveAuthUser = useCallback(
    async (nextUser: User | null, force = false) => {
      const nextId = nextUser?.id ?? null;
      // Supabase re-emits auth events (token refresh, tab focus); ignore repeats.
      if (!force && nextId === userIdRef.current) return;
      userIdRef.current = nextId;
      const seq = ++resolveSeq.current;
      const stale = () => seq !== resolveSeq.current;

      setUser(nextUser);
      setAuthError(null);

      if (!nextUser) {
        setAuthStaff(null);
        clearWard();
        setAuthStatus("signed_out");
        setLoadState("ready");
        return;
      }

      try {
        let profile = await api.fetchStaffForUser(nextUser.id);
        if (stale()) return;

        if (!profile) {
          // Not linked to a hospital yet: accept a pending invitation if any.
          try {
            const claimed = await api.claimInvite();
            if (stale()) return;
            if (claimed) profile = await api.fetchStaffForUser(nextUser.id);
          } catch (err) {
            if (stale()) return;
            // e.g. "Verify your email address first."
            setAuthError(errorMessage(err, "Could not check invitations."));
          }
        }
        if (stale()) return;

        if (!profile || !profile.active) {
          setAuthStaff(null);
          clearWard();
          setAuthStatus("no_hospital");
          setLoadState("ready");
          return;
        }

        setAuthStaff(profile);
        setAuthStatus("signed_in");
        setLoadState("loading");
        try {
          await loadWard({ soft: true });
        } catch {
          /* loadWard recorded the error; AppShell shows a retry */
        }
      } catch (err) {
        if (stale()) return;
        setAuthStaff(null);
        clearWard();
        setAuthError(errorMessage(err, "Failed to load your account"));
        setAuthStatus("no_hospital");
        setLoadState("ready");
      }
    },
    [clearWard, loadWard],
  );

  useEffect(() => {
    if (!configured) {
      setLoadState("ready");
      return;
    }
    const sb = createSupabaseBrowserClient();
    if (!sb) return;

    let cancelled = false;
    sb.auth.getUser().then(({ data: result }) => {
      if (!cancelled) void resolveAuthUser(result.user ?? null);
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
  }, [configured, resolveAuthUser]);

  const refreshAccount = useCallback(async () => {
    const sb = createSupabaseBrowserClient();
    if (!sb) return;
    const { data: result } = await sb.auth.getUser();
    await resolveAuthUser(result.user ?? null, true);
  }, [resolveAuthUser]);

  // ---- Auth -----------------------------------------------------------------

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    const sb = createSupabaseBrowserClient();
    if (!sb) return { error: "Supabase is not configured" };
    const trimmed = email.trim();
    if (!trimmed || !password) return { error: "Email and password are required." };
    const { error } = await sb.auth.signInWithPassword({ email: trimmed, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
        return { error: "Invalid email or password. Check your credentials and try again." };
      }
      if (msg.includes("email not confirmed")) {
        return { error: "Email not confirmed. Check your inbox for the confirmation link." };
      }
      if (msg.includes("network") || msg.includes("fetch")) {
        return { error: "Network error reaching Supabase. Check your connection and try again." };
      }
      return { error: error.message };
    }
    // onAuthStateChange resolves the staff profile and ward data.
    return { error: null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string) => {
      const sb = createSupabaseBrowserClient();
      if (!sb) return { error: "Supabase is not configured", needsConfirmation: false };
      const trimmed = email.trim();
      if (!trimmed || password.length < 8) {
        return {
          error: "Enter your email and a password of at least 8 characters.",
          needsConfirmation: false,
        };
      }
      const { data: result, error } = await sb.auth.signUp({
        email: trimmed,
        password,
      });
      if (error) return { error: error.message, needsConfirmation: false };
      // No session means Supabase is waiting for the email to be verified.
      return { error: null, needsConfirmation: !result.session };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const sb = createSupabaseBrowserClient();
    if (sb) await sb.auth.signOut();
    userIdRef.current = null;
    resolveSeq.current++;
    setAuthStaff(null);
    setUser(null);
    clearWard();
    setAuthStatus("signed_out");
  }, [clearWard]);

  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string }): Promise<Result> => {
      const sb = createSupabaseBrowserClient();
      if (!sb || !user?.email) return { error: "Not signed in." };
      if (input.newPassword.length < 8) {
        return { error: "New password must be at least 8 characters." };
      }
      const { error: reauthError } = await sb.auth.signInWithPassword({
        email: user.email,
        password: input.currentPassword,
      });
      if (reauthError) return { error: "Current password is incorrect." };
      const { error } = await sb.auth.updateUser({ password: input.newPassword });
      if (error) return { error: error.message };
      setToast("Password updated");
      return { error: null };
    },
    [user],
  );

  const createHospital = useCallback(
    async (input: {
      hospitalName: string;
      adminName: string;
      wardName?: string;
    }): Promise<Result> => {
      try {
        await api.createHospital(input);
      } catch (err) {
        return { error: errorMessage(err, "Could not create the hospital") };
      }
      await refreshAccount();
      return { error: null };
    },
    [refreshAccount],
  );

  // ---- Actions --------------------------------------------------------------

  /**
   * Run one server action, then reload so the UI reflects what was saved.
   * Never throws; failures come back as `error` (and callers toast them).
   */
  const act = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<{ value: T | null; error: string | null }> => {
      setActionBusy(true);
      try {
        const value = await fn();
        await loadWard({ soft: true }).catch(() => undefined);
        return { value, error: null };
      } catch (err) {
        return { value: null, error: errorMessage(err, "Save failed") };
      } finally {
        setActionBusy(false);
      }
    },
    [loadWard],
  );

  /** Run an action and toast success or failure; for void handlers. */
  const actToast = useCallback(
    async (fn: () => Promise<unknown>, success: string) => {
      const { error } = await act(fn);
      setToast(error ? `Could not save: ${error}` : success);
    },
    [act],
  );

  /** Run an action and return {error}, toasting on either outcome. */
  const actResult = useCallback(
    async (fn: () => Promise<unknown>, success: string): Promise<Result> => {
      const { error } = await act(fn);
      setToast(error ? `Could not save: ${error}` : success);
      return { error };
    },
    [act],
  );

  const recordVitals = useCallback(
    async (patientId: string, vitals: Vitals, note?: string) => {
      const values = [vitals.oxygen, vitals.heartRate, vitals.temperature, vitals.respiratory];
      if (!values.every((v) => Number.isFinite(v))) {
        setToast("Vitals must be valid numbers.");
        return { abnormalCount: 0, error: "Vitals must be valid numbers." };
      }
      const { value, error } = await act(() =>
        api.recordVitals({ patientId, vitals, note }),
      );
      if (error || !value) {
        setToast(`Could not save vitals: ${error}`);
        return { abnormalCount: 0, error: error ?? "Save failed" };
      }
      setToast(
        value.abnormalCount > 0
          ? `Vitals saved. ${value.abnormalCount} abnormal reading${value.abnormalCount > 1 ? "s" : ""} detected.`
          : "Vitals saved successfully.",
      );
      return { abnormalCount: value.abnormalCount, error: null };
    },
    [act],
  );

  const acknowledgeAlert = useCallback(
    (alertId: string) =>
      actToast(() => api.setAlertStatus(alertId, "acknowledged"), "Alert acknowledged"),
    [actToast],
  );

  const resolveAlert = useCallback(
    (alertId: string) =>
      actToast(() => api.setAlertStatus(alertId, "resolved"), "Alert resolved"),
    [actToast],
  );

  const completeTask = useCallback(
    (taskId: string) => actToast(() => api.completeTask(taskId), "Task completed"),
    [actToast],
  );

  const createTask = useCallback(
    (input: { patientId: string; title: string; due: string; priority: TaskPriority }) =>
      actResult(() => api.createTask(input), "Task created"),
    [actResult],
  );

  const administerMedication = useCallback(
    (medicationId: string) =>
      actToast(() => api.administerMedication(medicationId), "Medication recorded"),
    [actToast],
  );

  const orderMedication = useCallback(
    (input: { patientId: string; name: string; dose: string; due: string }) =>
      actResult(() => api.orderMedication(input), "Medication ordered"),
    [actResult],
  );

  const addNote = useCallback(
    (input: { patientId: string; type: string; content: string }) =>
      actResult(() => api.addNote(input), "Note saved"),
    [actResult],
  );

  const admitPatient = useCallback(
    async (input: {
      name: string;
      age: number;
      room: string;
      diagnosis: string;
      allergy?: string;
      wardId?: string | null;
      doctorId?: string | null;
      nurseId?: string | null;
    }) => {
      const { value, error } = await act(() => api.admitPatient(input));
      setToast(error ? `Could not admit patient: ${error}` : "Patient admitted");
      return { error, id: value };
    },
    [act],
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
        doctorId: string;
        nurseId: string;
      },
    ): Promise<Result> => {
      const existing = data.patients.find((p) => p.id === patientId);
      if (!existing) return { error: "Patient not found." };
      if (
        !input.name.trim() ||
        !input.room.trim() ||
        !input.diagnosis.trim() ||
        !Number.isFinite(input.age) ||
        input.age <= 0
      ) {
        return { error: "Name, age, room, and diagnosis are required." };
      }
      return actResult(
        () =>
          api.updatePatient({
            patientId,
            ...input,
            age: Math.round(input.age),
            allergy: input.allergy.trim() || "None recorded",
            wardId: existing.wardId,
          }),
        "Patient profile saved",
      );
    },
    [actResult, data.patients],
  );

  const updateStaffProfile = useCallback(
    (input: { name: string; detail: string; initials: string }): Promise<Result> => {
      if (!input.name.trim() || !input.initials.trim()) {
        return Promise.resolve({ error: "Name and initials are required." });
      }
      return actResult(() => api.updateMyProfile(input), "Profile saved");
    },
    [actResult],
  );

  const inviteStaff = useCallback(
    (input: {
      email: string;
      name: string;
      role: Role;
      detail: string;
      initials: string;
    }) =>
      actResult(
        () => api.inviteStaff(input),
        "Invitation created. They can sign up with that email to join.",
      ),
    [actResult],
  );

  const revokeInvite = useCallback(
    (inviteId: string) => actResult(() => api.revokeInvite(inviteId), "Invitation revoked"),
    [actResult],
  );

  const updateStaffMember = useCallback(
    (input: { id: string; name: string; role: Role; detail: string; initials: string }) =>
      actResult(() => api.updateStaff(input), "Staff updated"),
    [actResult],
  );

  const setStaffActive = useCallback(
    (staffId: string, active: boolean) =>
      actResult(
        () => api.setStaffActive(staffId, active),
        active ? "Staff reactivated" : "Staff deactivated",
      ),
    [actResult],
  );

  const updateHospital = useCallback(
    (input: { name?: string; settings?: HospitalSettings }) =>
      actResult(() => api.updateHospitalSettings(input), "Hospital settings saved"),
    [actResult],
  );

  const createWard = useCallback(
    (name: string) => actResult(() => api.createWard(name), "Ward created"),
    [actResult],
  );

  const renameWard = useCallback(
    (wardId: string, name: string) =>
      actResult(() => api.renameWard(wardId, name), "Ward renamed"),
    [actResult],
  );

  const fetchInvites = useCallback(async () => {
    try {
      return { invites: await api.loadInvites(), error: null };
    } catch (err) {
      return {
        invites: [] as HospitalInvite[],
        error: errorMessage(err, "Failed to load invitations"),
      };
    }
  }, []);

  const fetchAuditLog = useCallback(async (limit = 50) => {
    try {
      return { events: await api.loadAuditEvents(limit), error: null };
    } catch (err) {
      return {
        events: [] as AuditEvent[],
        error: errorMessage(err, "Failed to load audit log"),
      };
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      staff: authStaff ?? NO_STAFF,
      hospital,
      wards,
      allStaff,
      data,
      toast,
      clearToast,
      loadState,
      loadError,
      refreshing,
      actionBusy,
      authStatus,
      user,
      authError,
      signIn,
      signUp,
      signOut,
      changePassword,
      refreshAccount,
      createHospital,
      recordVitals,
      acknowledgeAlert,
      resolveAlert,
      completeTask,
      createTask,
      administerMedication,
      orderMedication,
      addNote,
      admitPatient,
      updatePatientProfile,
      updateStaffProfile,
      inviteStaff,
      revokeInvite,
      updateStaffMember,
      setStaffActive,
      updateHospital,
      createWard,
      renameWard,
      fetchInvites,
      fetchAuditLog,
      reload,
    }),
    [
      authStaff,
      hospital,
      wards,
      allStaff,
      data,
      toast,
      clearToast,
      loadState,
      loadError,
      refreshing,
      actionBusy,
      authStatus,
      user,
      authError,
      signIn,
      signUp,
      signOut,
      changePassword,
      refreshAccount,
      createHospital,
      recordVitals,
      acknowledgeAlert,
      resolveAlert,
      completeTask,
      createTask,
      administerMedication,
      orderMedication,
      addNote,
      admitPatient,
      updatePatientProfile,
      updateStaffProfile,
      inviteStaff,
      revokeInvite,
      updateStaffMember,
      setStaffActive,
      updateHospital,
      createWard,
      renameWard,
      fetchInvites,
      fetchAuditLog,
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
