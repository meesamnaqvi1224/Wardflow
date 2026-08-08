import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Alert,
  AuditEvent,
  Medication,
  Note,
  Patient,
  PatientStatus,
  StaffMember,
  Task,
  TimelineEvent,
  Vitals,
  WardData,
} from "@/lib/types";
import { SEED, STAFF } from "@/lib/seed";
import {
  buildWardData,
  mapAudit,
  mapStaff,
  type AlertRow,
  type AuditRow,
  type MedicationRow,
  type NoteRow,
  type PatientRow,
  type StaffRow,
  type TaskRow,
  type TimelineRow,
} from "./mappers";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "./client";

export type WardBundle = {
  staff: StaffMember[];
  data: WardData;
  source: "supabase" | "seed";
};

function requireClient(): SupabaseClient {
  const client = createSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export function getDataSource(): "supabase" | "seed" {
  return isSupabaseConfigured() ? "supabase" : "seed";
}

/** Load full ward snapshot from Supabase, or fall back to local seed. */
export async function loadWardBundle(): Promise<WardBundle> {
  if (!isSupabaseConfigured()) {
    return {
      staff: structuredClone(STAFF),
      data: structuredClone(SEED),
      source: "seed",
    };
  }

  const sb = requireClient();

  const [
    staffRes,
    patientsRes,
    alertsRes,
    tasksRes,
    medsRes,
    notesRes,
    timelineRes,
  ] = await Promise.all([
    sb.from("staff").select("id,name,role,detail,initials,auth_user_id").order("name"),
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

  const staffRows = (staffRes.data ?? []) as StaffRow[];
  const staff = staffRows.length ? staffRows.map(mapStaff) : structuredClone(STAFF);

  return {
    staff,
    data: buildWardData({
      patients: (patientsRes.data ?? []) as PatientRow[],
      alerts: (alertsRes.data ?? []) as AlertRow[],
      tasks: (tasksRes.data ?? []) as TaskRow[],
      medications: (medsRes.data ?? []) as MedicationRow[],
      notes: (notesRes.data ?? []) as NoteRow[],
      timeline: (timelineRes.data ?? []) as TimelineRow[],
    }),
    source: "supabase",
  };
}

/** Update staff display fields (name, detail, initials). Role is not changed here. */
export async function persistStaffProfile(args: {
  staffId: string;
  name: string;
  detail: string;
  initials: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const { error } = await sb
    .from("staff")
    .update({
      name: args.name,
      detail: args.detail,
      initials: args.initials,
    })
    .eq("id", args.staffId);
  if (error) throw new Error(error.message);
}

/** Admin create staff profile (auth link is optional / separate). */
export async function persistCreateStaff(member: StaffMember): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const { error } = await sb.from("staff").insert({
    id: member.id,
    name: member.name,
    role: member.role,
    detail: member.detail,
    initials: member.initials,
    auth_user_id: member.authUserId ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Admin update staff fields including role. */
export async function persistUpdateStaff(member: StaffMember): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const { error } = await sb
    .from("staff")
    .update({
      name: member.name,
      role: member.role,
      detail: member.detail,
      initials: member.initials,
    })
    .eq("id", member.id);
  if (error) throw new Error(error.message);
}

export async function loadAuditEvents(limit = 50): Promise<AuditEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = requireClient();
  const { data, error } = await sb
    .from("audit_events")
    .select("id,actor_id,actor_name,action,entity_type,entity_id,patient_id,detail,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapAudit(row as AuditRow));
}

/** Update patient demographic / assignment fields (not vitals). */
export async function persistPatientProfile(args: {
  patient: Patient;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const p = args.patient;
  const now = new Date().toISOString();

  // admitted is display text in the app; keep admitted_on if we can parse a date,
  // otherwise only update the fields we always have.
  const { error } = await sb
    .from("patients")
    .update({
      name: p.name,
      age: p.age,
      room: p.room,
      diagnosis: p.diagnosis,
      allergy: p.allergy,
      status: p.status,
      doctor_id: p.doctorId,
      nurse_id: p.nurseId,
      updated_at: now,
    })
    .eq("id", p.id);

  if (error) throw new Error(error.message);
}

export async function persistRecordVitals(args: {
  patient: Patient;
  vitals: Vitals;
  note?: string;
  staffId: string;
  newAlert: Alert | null;
  newTimeline: TimelineEvent[];
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const now = new Date().toISOString();

  const { error: patientError } = await sb
    .from("patients")
    .update({
      oxygen: args.vitals.oxygen,
      heart_rate: args.vitals.heartRate,
      bp: args.vitals.bp,
      temperature: args.vitals.temperature,
      respiratory: args.vitals.respiratory,
      status: args.patient.status,
      updated_at: now,
    })
    .eq("id", args.patient.id);

  if (patientError) throw new Error(patientError.message);

  const { error: readingError } = await sb.from("vital_readings").insert({
    patient_id: args.patient.id,
    recorded_by: args.staffId,
    oxygen: args.vitals.oxygen,
    heart_rate: args.vitals.heartRate,
    bp: args.vitals.bp,
    temperature: args.vitals.temperature,
    respiratory: args.vitals.respiratory,
    note: args.note ?? null,
    created_at: now,
  });

  if (readingError) throw new Error(readingError.message);

  if (args.newAlert) {
    const { error: alertError } = await sb.from("alerts").insert({
      id: args.newAlert.id,
      patient_id: args.newAlert.patientId,
      severity: args.newAlert.severity,
      message: args.newAlert.message,
      status: args.newAlert.status,
      created_at: now,
      updated_at: now,
    });
    if (alertError) throw new Error(alertError.message);
  }

  if (args.newTimeline.length) {
    const { error: timelineError } = await sb.from("timeline_events").insert(
      args.newTimeline.map((e) => ({
        id: e.id,
        patient_id: e.patientId,
        summary: e.summary,
        event_type: e.type,
        created_at: now,
      })),
    );
    if (timelineError) throw new Error(timelineError.message);
  }

  await sb.from("audit_events").insert({
    actor_id: args.staffId,
    action: "record_vitals",
    entity_type: "patient",
    entity_id: args.patient.id,
    patient_id: args.patient.id,
    detail: {
      vitals: args.vitals,
      note: args.note ?? null,
      alert_id: args.newAlert?.id ?? null,
    },
  });
}

export async function persistCompleteTask(args: {
  task: Task;
  newTimeline: TimelineEvent;
  staffId: string;
  staffName: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const now = new Date().toISOString();

  const { error: taskError } = await sb
    .from("tasks")
    .update({ status: args.task.status })
    .eq("id", args.task.id);
  if (taskError) throw new Error(taskError.message);

  const { error: timelineError } = await sb.from("timeline_events").insert({
    id: args.newTimeline.id,
    patient_id: args.newTimeline.patientId,
    summary: args.newTimeline.summary,
    event_type: args.newTimeline.type,
    created_at: now,
  });
  if (timelineError) throw new Error(timelineError.message);

  await sb.from("audit_events").insert({
    actor_id: args.staffId,
    actor_name: args.staffName,
    action: "complete_task",
    entity_type: "task",
    entity_id: args.task.id,
    patient_id: args.task.patientId,
    detail: { title: args.task.title },
  });
}

export async function persistCreateTask(args: {
  task: Task;
  newTimeline: TimelineEvent;
  staffId: string;
  staffName: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const now = new Date().toISOString();
  const t = args.task;

  const { error: taskError } = await sb.from("tasks").insert({
    id: t.id,
    patient_id: t.patientId,
    title: t.title,
    due_label: t.due,
    priority: t.priority,
    status: t.status,
    created_at: now,
  });
  if (taskError) throw new Error(taskError.message);

  const { error: timelineError } = await sb.from("timeline_events").insert({
    id: args.newTimeline.id,
    patient_id: args.newTimeline.patientId,
    summary: args.newTimeline.summary,
    event_type: args.newTimeline.type,
    created_at: now,
  });
  if (timelineError) throw new Error(timelineError.message);

  await sb.from("audit_events").insert({
    actor_id: args.staffId,
    actor_name: args.staffName,
    action: "create_task",
    entity_type: "task",
    entity_id: t.id,
    patient_id: t.patientId,
    detail: { title: t.title, priority: t.priority },
  });
}

export async function persistAdministerMedication(args: {
  medication: Medication;
  newTimeline: TimelineEvent;
  staffId: string;
  staffName: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const now = new Date().toISOString();

  const { error: medError } = await sb
    .from("medications")
    .update({ status: args.medication.status })
    .eq("id", args.medication.id);
  if (medError) throw new Error(medError.message);

  const { error: timelineError } = await sb.from("timeline_events").insert({
    id: args.newTimeline.id,
    patient_id: args.newTimeline.patientId,
    summary: args.newTimeline.summary,
    event_type: args.newTimeline.type,
    created_at: now,
  });
  if (timelineError) throw new Error(timelineError.message);

  await sb.from("audit_events").insert({
    actor_id: args.staffId,
    actor_name: args.staffName,
    action: "administer_medication",
    entity_type: "medication",
    entity_id: args.medication.id,
    patient_id: args.medication.patientId,
    detail: { name: args.medication.name, dose: args.medication.dose },
  });
}

export async function persistOrderMedication(args: {
  medication: Medication;
  newTimeline: TimelineEvent;
  staffId: string;
  staffName: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const now = new Date().toISOString();
  const m = args.medication;

  const { error: medError } = await sb.from("medications").insert({
    id: m.id,
    patient_id: m.patientId,
    name: m.name,
    dose: m.dose,
    due_label: m.due,
    status: m.status,
    ordered_by: args.staffId,
    created_at: now,
  });
  if (medError) throw new Error(medError.message);

  const { error: timelineError } = await sb.from("timeline_events").insert({
    id: args.newTimeline.id,
    patient_id: args.newTimeline.patientId,
    summary: args.newTimeline.summary,
    event_type: args.newTimeline.type,
    created_at: now,
  });
  if (timelineError) throw new Error(timelineError.message);

  await sb.from("audit_events").insert({
    actor_id: args.staffId,
    actor_name: args.staffName,
    action: "order_medication",
    entity_type: "medication",
    entity_id: m.id,
    patient_id: m.patientId,
    detail: { name: m.name, dose: m.dose, due: m.due },
  });
}

export async function persistAddNote(args: {
  note: Note;
  newTimeline: TimelineEvent;
  staffId: string;
  staffName: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const now = new Date().toISOString();
  const n = args.note;

  const { error: noteError } = await sb.from("notes").insert({
    id: n.id,
    patient_id: n.patientId,
    author_name: n.author,
    author_id: args.staffId,
    note_type: n.type,
    content: n.content,
    created_at: now,
  });
  if (noteError) throw new Error(noteError.message);

  const { error: timelineError } = await sb.from("timeline_events").insert({
    id: args.newTimeline.id,
    patient_id: args.newTimeline.patientId,
    summary: args.newTimeline.summary,
    event_type: args.newTimeline.type,
    created_at: now,
  });
  if (timelineError) throw new Error(timelineError.message);

  await sb.from("audit_events").insert({
    actor_id: args.staffId,
    actor_name: args.staffName,
    action: "add_note",
    entity_type: "note",
    entity_id: n.id,
    patient_id: n.patientId,
    detail: { type: n.type },
  });
}

export async function persistAlertStatus(args: {
  alert: Alert;
  patientId: string;
  patientStatus: PatientStatus;
  newTimeline: TimelineEvent;
  staffId: string;
  staffName: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = requireClient();
  const now = new Date().toISOString();

  const { error: alertError } = await sb
    .from("alerts")
    .update({ status: args.alert.status, updated_at: now })
    .eq("id", args.alert.id);

  if (alertError) throw new Error(alertError.message);

  const { error: patientError } = await sb
    .from("patients")
    .update({ status: args.patientStatus, updated_at: now })
    .eq("id", args.patientId);

  if (patientError) throw new Error(patientError.message);

  const { error: timelineError } = await sb.from("timeline_events").insert({
    id: args.newTimeline.id,
    patient_id: args.newTimeline.patientId,
    summary: args.newTimeline.summary,
    event_type: args.newTimeline.type,
    created_at: now,
  });

  if (timelineError) throw new Error(timelineError.message);

  await sb.from("audit_events").insert({
    actor_id: args.staffId,
    actor_name: args.staffName,
    action: `alert_${args.alert.status}`,
    entity_type: "alert",
    entity_id: args.alert.id,
    patient_id: args.patientId,
    detail: { message: args.alert.message },
  });
}

/**
 * Reset demo tables back to the fictional seed scenario.
 * Deletes runtime rows then re-upserts the known seed IDs.
 */
export async function resetWardToSeed(): Promise<WardBundle> {
  if (!isSupabaseConfigured()) {
    return {
      staff: structuredClone(STAFF),
      data: structuredClone(SEED),
      source: "seed",
    };
  }

  const sb = requireClient();

  // Clear mutable clinical tables (order respects FKs via patient cascade mostly).
  for (const table of [
    "audit_events",
    "vital_readings",
    "timeline_events",
    "notes",
    "medications",
    "tasks",
    "alerts",
  ] as const) {
    // PostgREST requires a filter; match all real ids.
    const { error } = await sb.from(table).delete().neq("id", "__none__");
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  // Restore patient snapshot from seed.
  for (const p of SEED.patients) {
    const admittedMatch = p.admitted.match(/([A-Za-z]+) (\d+), (\d+)/);
    let admittedOn = "2026-06-04";
    if (admittedMatch) {
      const months: Record<string, string> = {
        January: "01",
        February: "02",
        March: "03",
        April: "04",
        May: "05",
        June: "06",
        July: "07",
        August: "08",
        September: "09",
        October: "10",
        November: "11",
        December: "12",
      };
      const m = months[admittedMatch[1]] ?? "06";
      admittedOn = `${admittedMatch[3]}-${m}-${admittedMatch[2].padStart(2, "0")}`;
    }

    const { error } = await sb.from("patients").upsert({
      id: p.id,
      name: p.name,
      age: p.age,
      room: p.room,
      diagnosis: p.diagnosis,
      allergy: p.allergy,
      status: p.status,
      doctor_id: p.doctorId,
      nurse_id: p.nurseId,
      admitted_on: admittedOn,
      oxygen: p.vitals.oxygen,
      heart_rate: p.vitals.heartRate,
      bp: p.vitals.bp,
      temperature: p.vitals.temperature,
      respiratory: p.vitals.respiratory,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`patients ${p.id}: ${error.message}`);
  }

  // Ensure staff exist.
  for (const s of STAFF) {
    const { error } = await sb.from("staff").upsert({
      id: s.id,
      name: s.name,
      role: s.role,
      detail: s.detail,
      initials: s.initials,
    });
    if (error) throw new Error(`staff ${s.id}: ${error.message}`);
  }

  const { error: alertsError } = await sb.from("alerts").insert(
    SEED.alerts.map((a) => ({
      id: a.id,
      patient_id: a.patientId,
      severity: a.severity,
      message: a.message,
      status: a.status,
    })),
  );
  if (alertsError) throw new Error(alertsError.message);

  const { error: tasksError } = await sb.from("tasks").insert(
    SEED.tasks.map((t) => ({
      id: t.id,
      patient_id: t.patientId,
      title: t.title,
      due_label: t.due,
      priority: t.priority,
      status: t.status,
    })),
  );
  if (tasksError) throw new Error(tasksError.message);

  const { error: medsError } = await sb.from("medications").insert(
    SEED.medications.map((m) => ({
      id: m.id,
      patient_id: m.patientId,
      name: m.name,
      dose: m.dose,
      due_label: m.due,
      status: m.status,
    })),
  );
  if (medsError) throw new Error(medsError.message);

  const { error: notesError } = await sb.from("notes").insert(
    SEED.notes.map((n) => {
      const author = STAFF.find((s) => s.name === n.author);
      return {
        id: n.id,
        patient_id: n.patientId,
        author_name: n.author,
        author_id: author?.id ?? null,
        note_type: n.type,
        content: n.content,
      };
    }),
  );
  if (notesError) throw new Error(notesError.message);

  const { error: timelineError } = await sb.from("timeline_events").insert(
    SEED.timeline.map((e) => ({
      id: e.id,
      patient_id: e.patientId,
      summary: e.summary,
      event_type: e.type,
    })),
  );
  if (timelineError) throw new Error(timelineError.message);

  return loadWardBundle();
}
