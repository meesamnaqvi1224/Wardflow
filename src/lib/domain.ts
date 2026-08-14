import type {
  Alert,
  AlertSeverity,
  Medication,
  MedicationStatus,
  Note,
  Patient,
  PatientStatus,
  Role,
  StaffMember,
  Task,
  TaskPriority,
  TimelineEvent,
  Vitals,
  WardData,
} from "./types";
import { STAFF } from "./seed";

/**
 * Pure domain logic — no rendering, no storage. Kept framework-agnostic so
 * the same rules can run on the server (Supabase triggers / server actions)
 * once the database lands. The vitals thresholds here are the single source
 * of truth for "abnormal reading → alert".
 */

/** Lower rank = more urgent; used to sort patients so the sickest surface first. */
export function statusRank(status: PatientStatus): number {
  return { urgent: 0, warning: 1, stable: 2 }[status] ?? 3;
}

export function staffById(id: string): StaffMember | undefined {
  return STAFF.find((s) => s.id === id);
}

export function staffByRole(role: Role): StaffMember[] {
  return STAFF.filter((s) => s.role === role);
}

/** Patients a given staff member is responsible for (admins see the whole ward). */
export function assignedPatients(patients: Patient[], staff: StaffMember): Patient[] {
  if (staff.role === "nurse") return patients.filter((p) => p.nurseId === staff.id);
  if (staff.role === "doctor") return patients.filter((p) => p.doctorId === staff.id);
  return patients;
}

export function bySeverity<T extends Patient>(patients: T[]): T[] {
  return [...patients].sort((a, b) => statusRank(a.status) - statusRank(b.status));
}

export function activeAlerts(alerts: Alert[], patientId: string): Alert[] {
  return alerts.filter((a) => a.patientId === patientId && a.status !== "resolved");
}

export function openTasks(tasks: Task[], patientId: string): Task[] {
  return tasks.filter((t) => t.patientId === patientId && t.status !== "completed");
}

export interface Abnormality {
  severity: AlertSeverity;
  message: string;
}

/**
 * Evaluate a vitals reading against ward thresholds. Returns every abnormal
 * finding. An empty array means the reading is within normal limits.
 *
 * These thresholds are ported verbatim from the v1 prototype and are the rule
 * Phase 5 will enforce server-side when a reading is saved.
 */
export function evaluateVitals(v: Vitals): Abnormality[] {
  const result: Abnormality[] = [];

  if (v.oxygen < 90) result.push({ severity: "urgent", message: `Oxygen saturation ${v.oxygen}%` });
  else if (v.oxygen < 95) result.push({ severity: "warning", message: `Oxygen saturation ${v.oxygen}%` });

  if (v.heartRate < 40 || v.heartRate > 130) result.push({ severity: "urgent", message: `Heart rate ${v.heartRate} bpm` });
  else if (v.heartRate < 50 || v.heartRate > 100) result.push({ severity: "warning", message: `Heart rate ${v.heartRate} bpm` });

  if (v.temperature > 39.5) result.push({ severity: "urgent", message: `Temperature ${v.temperature}°C` });
  else if (v.temperature > 38) result.push({ severity: "warning", message: `Temperature ${v.temperature}°C` });

  if (v.respiratory < 8 || v.respiratory > 30) result.push({ severity: "urgent", message: `Respiratory rate ${v.respiratory}/min` });
  else if (v.respiratory < 10 || v.respiratory > 22) result.push({ severity: "warning", message: `Respiratory rate ${v.respiratory}/min` });

  return result;
}

/** Overall severity of a set of abnormalities (urgent wins over warning). */
export function overallSeverity(abnormalities: Abnormality[]): AlertSeverity | null {
  if (abnormalities.length === 0) return null;
  return abnormalities.some((a) => a.severity === "urgent") ? "urgent" : "warning";
}

/** Ward-level counts used by the dashboard stat cards. */
export function wardSummary(data: WardData) {
  // Only unacknowledged alerts count as "active" for badges/stats.
  // Acknowledged alerts stay on the Alerts page until resolved, but must not
  // keep the red nav badge or "active alerts" stat inflated.
  const activeAlertList = data.alerts.filter((a) => a.status === "active");
  const openTaskList = data.tasks.filter((t) => t.status !== "completed");
  return {
    patients: data.patients.length,
    activeAlerts: activeAlertList.length,
    urgentAlerts: activeAlertList.filter((a) => a.severity === "urgent").length,
    openTasks: openTaskList.length,
    urgentTasks: openTaskList.filter((t) => t.priority === "urgent").length,
    medicationsDue: data.medications.filter((m) => m.status === "due").length,
  };
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Derive patient acuity from non-resolved alerts (urgent wins). */
export function patientStatusFromAlerts(
  alerts: Alert[],
  patientId: string,
): PatientStatus {
  const open = alerts.filter((a) => a.patientId === patientId && a.status !== "resolved");
  if (open.some((a) => a.severity === "urgent")) return "urgent";
  if (open.length) return "warning";
  return "stable";
}

export interface RecordVitalsInput {
  patientId: string;
  vitals: Vitals;
  staffName: string;
  note?: string;
}

export interface RecordVitalsResult {
  data: WardData;
  abnormalCount: number;
  /** Patient after the update (for DB write). */
  patient: Patient;
  newAlert: Alert | null;
  newTimeline: TimelineEvent[];
}

export interface AlertStatusResult {
  data: WardData;
  alert: Alert;
  newTimeline: TimelineEvent;
  patientId: string;
  patientStatus: PatientStatus;
}

/**
 * Pure reducer: record vitals, create alerts for abnormalities, append timeline.
 * Returns mutation metadata so the Supabase layer can persist the same IDs.
 */
export function applyRecordVitals(
  data: WardData,
  input: RecordVitalsInput,
): RecordVitalsResult | null {
  const { patientId, vitals, staffName, note } = input;
  const existing = data.patients.find((p) => p.id === patientId);
  if (!existing) return null;

  const abnormalities = evaluateVitals(vitals);
  const severity = overallSeverity(abnormalities);
  let alerts = data.alerts;
  let timeline = data.timeline;
  let newAlert: Alert | null = null;
  const newTimeline: TimelineEvent[] = [];

  if (severity && abnormalities.length) {
    const message = abnormalities.map((a) => a.message).join("; ");
    newAlert = {
      id: newId("a"),
      patientId,
      severity,
      message,
      status: "active",
      at: "Just now",
    };
    alerts = [newAlert, ...alerts];
    const alertEvent: TimelineEvent = {
      id: newId("e"),
      patientId,
      summary: `${severity === "urgent" ? "Urgent" : "Warning"} vital alert automatically created`,
      at: "Just now",
      type: severity,
    };
    newTimeline.push(alertEvent);
    timeline = [alertEvent, ...timeline];
  }

  const vitalsEvent: TimelineEvent = {
    id: newId("e"),
    patientId,
    summary: `${staffName} recorded new vitals${note ? `: ${note}` : ""}`,
    at: "Just now",
    type: "vitals",
  };
  newTimeline.unshift(vitalsEvent);
  timeline = [vitalsEvent, ...timeline];

  const patient: Patient = {
    ...existing,
    vitals,
    updated: "Just now",
    status: patientStatusFromAlerts(alerts, patientId),
  };
  const patients = data.patients.map((p) => (p.id === patientId ? patient : p));

  return {
    data: { ...data, patients, alerts, timeline },
    abnormalCount: abnormalities.length,
    patient,
    newAlert,
    newTimeline,
  };
}

export function applyAlertStatus(
  data: WardData,
  alertId: string,
  status: "acknowledged" | "resolved",
  staffName: string,
): AlertStatusResult | null {
  const existing = data.alerts.find((a) => a.id === alertId);
  if (!existing) return null;

  const alert: Alert = { ...existing, status, at: existing.at };
  const alerts = data.alerts.map((a) => (a.id === alertId ? alert : a));
  const newTimeline: TimelineEvent = {
    id: newId("e"),
    patientId: existing.patientId,
    summary: `${staffName} ${status} alert: ${existing.message}`,
    at: "Just now",
    type: "alert",
  };
  const timeline = [newTimeline, ...data.timeline];
  const patientStatus = patientStatusFromAlerts(alerts, existing.patientId);
  const patients = data.patients.map((p) =>
    p.id === existing.patientId
      ? { ...p, status: patientStatus, updated: "Just now" }
      : p,
  );

  return {
    data: { ...data, alerts, timeline, patients },
    alert,
    newTimeline,
    patientId: existing.patientId,
    patientStatus,
  };
}

export interface TaskMutationResult {
  data: WardData;
  task: Task;
  newTimeline: TimelineEvent;
}

export interface MedicationMutationResult {
  data: WardData;
  medication: Medication;
  newTimeline: TimelineEvent;
}

/** Mark a care task complete and append a timeline event. */
export function applyCompleteTask(
  data: WardData,
  taskId: string,
  staffName: string,
): TaskMutationResult | null {
  const existing = data.tasks.find((t) => t.id === taskId);
  if (!existing || existing.status === "completed") return null;

  const task: Task = { ...existing, status: "completed" };
  const tasks = data.tasks.map((t) => (t.id === taskId ? task : t));
  const newTimeline: TimelineEvent = {
    id: newId("e"),
    patientId: existing.patientId,
    summary: `${staffName} completed task: ${existing.title}`,
    at: "Just now",
    type: "task",
  };

  return {
    data: {
      ...data,
      tasks,
      timeline: [newTimeline, ...data.timeline],
    },
    task,
    newTimeline,
  };
}

/** Create a new open care task. */
export function applyCreateTask(
  data: WardData,
  input: {
    patientId: string;
    title: string;
    due: string;
    priority: TaskPriority;
    staffName: string;
  },
): TaskMutationResult | null {
  if (!data.patients.some((p) => p.id === input.patientId)) return null;
  const title = input.title.trim();
  const due = input.due.trim() || "Next shift";
  if (!title) return null;

  const task: Task = {
    id: newId("t"),
    patientId: input.patientId,
    title,
    due,
    priority: input.priority,
    status: "open",
  };
  const newTimeline: TimelineEvent = {
    id: newId("e"),
    patientId: input.patientId,
    summary: `${input.staffName} created task: ${title}`,
    at: "Just now",
    type: "task",
  };

  return {
    data: {
      ...data,
      tasks: [task, ...data.tasks],
      timeline: [newTimeline, ...data.timeline],
    },
    task,
    newTimeline,
  };
}

/** Record medication administration (due/upcoming → administered). */
export function applyAdministerMedication(
  data: WardData,
  medicationId: string,
  staffName: string,
): MedicationMutationResult | null {
  const existing = data.medications.find((m) => m.id === medicationId);
  if (!existing || existing.status === "administered") return null;

  const medication: Medication = { ...existing, status: "administered" as MedicationStatus };
  const medications = data.medications.map((m) =>
    m.id === medicationId ? medication : m,
  );
  const newTimeline: TimelineEvent = {
    id: newId("e"),
    patientId: existing.patientId,
    summary: `${staffName} administered ${existing.name} (${existing.dose})`,
    at: "Just now",
    type: "medication",
  };

  return {
    data: {
      ...data,
      medications,
      timeline: [newTimeline, ...data.timeline],
    },
    medication,
    newTimeline,
  };
}

/** Doctor orders a new medication. */
export function applyOrderMedication(
  data: WardData,
  input: {
    patientId: string;
    name: string;
    dose: string;
    due: string;
    staffName: string;
  },
): MedicationMutationResult | null {
  if (!data.patients.some((p) => p.id === input.patientId)) return null;
  const name = input.name.trim();
  const dose = input.dose.trim();
  const due = input.due.trim() || "As scheduled";
  if (!name || !dose) return null;

  const medication: Medication = {
    id: newId("m"),
    patientId: input.patientId,
    name,
    dose,
    due,
    status: "due",
  };
  const newTimeline: TimelineEvent = {
    id: newId("e"),
    patientId: input.patientId,
    summary: `${input.staffName} ordered ${name} ${dose}`,
    at: "Just now",
    type: "medication",
  };

  return {
    data: {
      ...data,
      medications: [medication, ...data.medications],
      timeline: [newTimeline, ...data.timeline],
    },
    medication,
    newTimeline,
  };
}

export interface NoteMutationResult {
  data: WardData;
  note: Note;
  newTimeline: TimelineEvent;
}

/** Add a clinical note and timeline entry. */
export function applyAddNote(
  data: WardData,
  input: {
    patientId: string;
    type: string;
    content: string;
    staffName: string;
  },
): NoteMutationResult | null {
  if (!data.patients.some((p) => p.id === input.patientId)) return null;
  const content = input.content.trim();
  const type = input.type.trim() || "Clinical note";
  if (!content) return null;

  const note: Note = {
    id: newId("n"),
    patientId: input.patientId,
    author: input.staffName,
    type,
    content,
    at: "Just now",
  };
  const newTimeline: TimelineEvent = {
    id: newId("e"),
    patientId: input.patientId,
    summary: `${input.staffName} added ${type.toLowerCase()}`,
    at: "Just now",
    type: "note",
  };

  return {
    data: {
      ...data,
      notes: [note, ...data.notes],
      timeline: [newTimeline, ...data.timeline],
    },
    note,
    newTimeline,
  };
}
