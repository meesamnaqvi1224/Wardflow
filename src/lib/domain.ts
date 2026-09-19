import type {
  Alert,
  Patient,
  PatientStatus,
  StaffMember,
  Task,
  WardData,
} from "./types";

/**
 * Pure read-side helpers for rendering ward data. All business rules that
 * change data (vitals thresholds, alert lifecycle, patient status, permissions)
 * live in the database functions in supabase/v2/03_workflows.sql, not here.
 */

/** Lower rank = more urgent; used to sort patients so the sickest surface first. */
export function statusRank(status: PatientStatus): number {
  return { urgent: 0, warning: 1, stable: 2 }[status] ?? 3;
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
