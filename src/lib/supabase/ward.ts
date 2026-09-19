import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AlertStatus,
  AuditEvent,
  Hospital,
  HospitalInvite,
  HospitalSettings,
  Role,
  StaffMember,
  TaskPriority,
  Vitals,
  Ward,
  WardData,
} from "@/lib/types";
import {
  buildWardData,
  mapAudit,
  mapHospital,
  mapInvite,
  mapStaff,
  mapWard,
  type AlertRow,
  type AuditRow,
  type HospitalRow,
  type InviteRow,
  type MedicationRow,
  type NoteRow,
  type PatientRow,
  type StaffRow,
  type TaskRow,
  type TimelineRow,
  type WardRow,
} from "./mappers";
import { createSupabaseBrowserClient } from "./client";

/**
 * Data layer for the v2 multi-hospital schema (supabase/v2).
 *
 * Reads are plain selects; Row Level Security limits every table to the
 * signed-in user's hospital, so no query here filters by hospital. Every write
 * is a call to a database function (supabase/v2/02_onboarding.sql and
 * 03_workflows.sql) which checks the caller's role, runs in one transaction,
 * and writes the timeline and audit rows itself. The client never inserts or
 * updates tables directly (it has no privilege to).
 */

export type WardBundle = {
  hospital: Hospital;
  wards: Ward[];
  staff: StaffMember[];
  data: WardData;
};

function client(): SupabaseClient {
  const sb = createSupabaseBrowserClient();
  if (!sb) throw new Error("Supabase is not configured");
  return sb;
}

/** Call a database function; throws an Error carrying the server's message. */
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const STAFF_COLUMNS = "id,name,role,detail,initials,auth_user_id,active";

/** The staff row linked to an auth user, or null if none is visible to them. */
export async function fetchStaffForUser(userId: string): Promise<StaffMember | null> {
  const { data, error } = await client()
    .from("staff")
    .select(STAFF_COLUMNS)
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapStaff(data as StaffRow) : null;
}

/** Load the signed-in user's hospital, wards, staff and ward data. */
export async function loadWardBundle(): Promise<WardBundle> {
  const sb = client();

  const [
    hospitalRes,
    wardsRes,
    staffRes,
    patientsRes,
    alertsRes,
    tasksRes,
    medsRes,
    notesRes,
    timelineRes,
  ] = await Promise.all([
    sb.from("hospitals").select("id,name,slug,plan,status,settings").maybeSingle(),
    sb.from("wards").select("id,name").order("name"),
    sb.from("staff").select(STAFF_COLUMNS).order("name"),
    sb.from("patients").select("*").order("room"),
    sb.from("alerts").select("*").order("created_at", { ascending: false }),
    sb.from("tasks").select("*").order("created_at", { ascending: false }),
    sb.from("medications").select("*").order("created_at", { ascending: false }),
    sb.from("notes").select("*").order("created_at", { ascending: false }),
    sb
      .from("timeline_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const errors = [
    hospitalRes.error,
    wardsRes.error,
    staffRes.error,
    patientsRes.error,
    alertsRes.error,
    tasksRes.error,
    medsRes.error,
    notesRes.error,
    timelineRes.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(errors.map((e) => e!.message).join("; "));
  }
  if (!hospitalRes.data) {
    throw new Error("No hospital is linked to this account.");
  }

  return {
    hospital: mapHospital(hospitalRes.data as HospitalRow),
    wards: ((wardsRes.data ?? []) as WardRow[]).map(mapWard),
    staff: ((staffRes.data ?? []) as StaffRow[]).map(mapStaff),
    data: buildWardData({
      patients: (patientsRes.data ?? []) as PatientRow[],
      alerts: (alertsRes.data ?? []) as AlertRow[],
      tasks: (tasksRes.data ?? []) as TaskRow[],
      medications: (medsRes.data ?? []) as MedicationRow[],
      notes: (notesRes.data ?? []) as NoteRow[],
      timeline: (timelineRes.data ?? []) as TimelineRow[],
    }),
  };
}

/** Admin only (RLS returns nothing for other roles). */
export async function loadAuditEvents(limit = 50): Promise<AuditEvent[]> {
  const { data, error } = await client()
    .from("audit_events")
    .select(
      "id,actor_id,actor_name,action,entity_type,entity_id,patient_id,detail,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapAudit(row as AuditRow));
}

/** Admin only. Pending invitations for the caller's hospital. */
export async function loadInvites(): Promise<HospitalInvite[]> {
  const { data, error } = await client()
    .from("hospital_invites")
    .select("id,email,name,role,detail,initials,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapInvite(row as InviteRow));
}

// ---------------------------------------------------------------------------
// Signup / onboarding
// ---------------------------------------------------------------------------

/** Caller becomes the first admin of a new hospital. Returns the hospital id. */
export function createHospital(input: {
  hospitalName: string;
  adminName: string;
  wardName?: string;
}): Promise<string> {
  return rpc<string>("create_hospital", {
    p_hospital_name: input.hospitalName,
    p_admin_name: input.adminName,
    p_ward_name: input.wardName ?? null,
  });
}

/** Joins the hospital that invited the caller's verified email; null if none. */
export function claimInvite(): Promise<string | null> {
  return rpc<string | null>("claim_invite");
}

// ---------------------------------------------------------------------------
// Vitals and alerts
// ---------------------------------------------------------------------------

export async function recordVitals(input: {
  patientId: string;
  vitals: Vitals;
  note?: string;
}): Promise<{ abnormalCount: number; alertId: string | null }> {
  const r = await rpc<{ abnormal_count: number; alert_id: string | null }>(
    "record_vitals",
    {
      p_patient_id: input.patientId,
      p_oxygen: input.vitals.oxygen,
      p_heart_rate: input.vitals.heartRate,
      p_bp: input.vitals.bp,
      p_temperature: input.vitals.temperature,
      p_respiratory: input.vitals.respiratory,
      p_note: input.note ?? null,
    },
  );
  return { abnormalCount: r.abnormal_count, alertId: r.alert_id };
}

export async function setAlertStatus(
  alertId: string,
  status: Extract<AlertStatus, "acknowledged" | "resolved">,
): Promise<void> {
  await rpc("set_alert_status", { p_alert_id: alertId, p_status: status });
}

// ---------------------------------------------------------------------------
// Tasks, medications, notes
// ---------------------------------------------------------------------------

export function createTask(input: {
  patientId: string;
  title: string;
  due: string;
  priority: TaskPriority;
}): Promise<string> {
  return rpc<string>("create_task", {
    p_patient_id: input.patientId,
    p_title: input.title,
    p_due_label: input.due || null,
    p_priority: input.priority,
  });
}

export async function completeTask(taskId: string): Promise<void> {
  await rpc("complete_task", { p_task_id: taskId });
}

export function orderMedication(input: {
  patientId: string;
  name: string;
  dose: string;
  due: string;
}): Promise<string> {
  return rpc<string>("order_medication", {
    p_patient_id: input.patientId,
    p_name: input.name,
    p_dose: input.dose,
    p_due_label: input.due || null,
  });
}

export async function administerMedication(medicationId: string): Promise<void> {
  await rpc("administer_medication", { p_medication_id: medicationId });
}

export function addNote(input: {
  patientId: string;
  type: string;
  content: string;
}): Promise<string> {
  return rpc<string>("add_note", {
    p_patient_id: input.patientId,
    p_content: input.content,
    p_note_type: input.type || null,
  });
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export function admitPatient(input: {
  name: string;
  age: number;
  room: string;
  diagnosis: string;
  allergy?: string;
  wardId?: string | null;
  doctorId?: string | null;
  nurseId?: string | null;
}): Promise<string> {
  return rpc<string>("admit_patient", {
    p_name: input.name,
    p_age: input.age,
    p_room: input.room,
    p_diagnosis: input.diagnosis,
    p_allergy: input.allergy ?? null,
    p_ward_id: input.wardId || null,
    p_doctor_id: input.doctorId || null,
    p_nurse_id: input.nurseId || null,
  });
}

export async function updatePatient(input: {
  patientId: string;
  name: string;
  age: number;
  room: string;
  diagnosis: string;
  allergy: string;
  wardId: string | null;
  doctorId: string;
  nurseId: string;
}): Promise<void> {
  await rpc("update_patient", {
    p_patient_id: input.patientId,
    p_name: input.name,
    p_age: input.age,
    p_room: input.room,
    p_diagnosis: input.diagnosis,
    p_allergy: input.allergy,
    p_ward_id: input.wardId || null,
    p_doctor_id: input.doctorId || null,
    p_nurse_id: input.nurseId || null,
  });
}

// ---------------------------------------------------------------------------
// Staff, invites, hospital settings, wards
// ---------------------------------------------------------------------------

export async function updateMyProfile(input: {
  name: string;
  detail: string;
  initials: string;
}): Promise<void> {
  await rpc("update_my_profile", {
    p_name: input.name,
    p_detail: input.detail,
    p_initials: input.initials,
  });
}

export function inviteStaff(input: {
  email: string;
  name: string;
  role: Role;
  detail: string;
  initials: string;
}): Promise<string> {
  return rpc<string>("invite_staff", {
    p_email: input.email,
    p_name: input.name,
    p_role: input.role,
    p_detail: input.detail,
    p_initials: input.initials || null,
  });
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await rpc("revoke_invite", { p_invite_id: inviteId });
}

export async function updateStaff(input: {
  id: string;
  name: string;
  role: Role;
  detail: string;
  initials: string;
}): Promise<void> {
  await rpc("update_staff", {
    p_staff_id: input.id,
    p_name: input.name,
    p_role: input.role,
    p_detail: input.detail,
    p_initials: input.initials,
  });
}

export async function setStaffActive(staffId: string, active: boolean): Promise<void> {
  await rpc("set_staff_active", { p_staff_id: staffId, p_active: active });
}

/** Rename the hospital and/or merge settings (timezone, alertThresholds). */
export async function updateHospitalSettings(input: {
  name?: string;
  settings?: HospitalSettings;
}): Promise<void> {
  await rpc("update_hospital_settings", {
    p_name: input.name ?? null,
    p_settings: input.settings ?? null,
  });
}

export function createWard(name: string): Promise<string> {
  return rpc<string>("create_ward", { p_name: name });
}

export async function renameWard(wardId: string, name: string): Promise<void> {
  await rpc("rename_ward", { p_ward_id: wardId, p_name: name });
}
