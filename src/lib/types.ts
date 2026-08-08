/**
 * WardFlow domain types.
 *
 * These are deliberately shaped to map cleanly onto the Supabase schema we
 * add in Phase 3 (one interface ≈ one table row). For now they back the
 * in-memory seed dataset. When the database lands, these become the row
 * types returned by the data layer, so components downstream don't change.
 */

export type Role = "doctor" | "nurse" | "admin";

/** Clinical acuity used for sorting and colour coding across the app. */
export type PatientStatus = "urgent" | "warning" | "stable";

export type AlertSeverity = "urgent" | "warning";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export type TaskPriority = "urgent" | "important" | "routine";
export type TaskStatus = "open" | "completed";

export type MedicationStatus = "due" | "upcoming" | "administered";

/** Timeline entry categories — drive the feed dot colour. */
export type TimelineType =
  | "urgent"
  | "warning"
  | "task"
  | "alert"
  | "medication"
  | "note"
  | "vitals";

export interface StaffMember {
  id: string;
  name: string;
  role: Role;
  detail: string;
  initials: string;
  /** Present when linked to a Supabase Auth user. */
  authUserId?: string | null;
}

/** Row from audit_events for admin review. */
export interface AuditEvent {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  patientId: string | null;
  detail: Record<string, unknown>;
  at: string;
}

export interface Vitals {
  oxygen: number; // SpO2 %
  heartRate: number; // bpm
  bp: string; // systolic/diastolic
  temperature: number; // °C
  respiratory: number; // breaths/min
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  room: string;
  diagnosis: string;
  allergy: string;
  status: PatientStatus;
  doctorId: string;
  nurseId: string;
  admitted: string;
  vitals: Vitals;
  updated: string;
}

export interface Alert {
  id: string;
  patientId: string;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  at: string;
}

export interface Task {
  id: string;
  patientId: string;
  title: string;
  due: string;
  priority: TaskPriority;
  status: TaskStatus;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dose: string;
  due: string;
  status: MedicationStatus;
}

export interface Note {
  id: string;
  patientId: string;
  author: string;
  type: string;
  content: string;
  at: string;
}

export interface TimelineEvent {
  id: string;
  patientId: string;
  summary: string;
  at: string;
  type: TimelineType;
}

/** The complete ward dataset. Mirrors what the Supabase queries will return. */
export interface WardData {
  patients: Patient[];
  alerts: Alert[];
  tasks: Task[];
  medications: Medication[];
  notes: Note[];
  timeline: TimelineEvent[];
}
