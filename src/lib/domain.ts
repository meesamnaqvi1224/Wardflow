import type {
  Alert,
  AlertSeverity,
  Patient,
  PatientStatus,
  Role,
  StaffMember,
  Task,
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
  const activeAlertList = data.alerts.filter((a) => a.status !== "resolved");
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
