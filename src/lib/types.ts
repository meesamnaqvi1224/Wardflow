/**
 * WardFlow domain types. One interface is roughly one row of the v2
 * multi-hospital Supabase schema (supabase/v2). Ids are UUID strings; an empty
 * string means "not assigned" for optional staff references.
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
  /** Deactivated staff keep their history but cannot sign in to any data. */
  active: boolean;
}

/** Per-hospital alert thresholds; any missing value falls back to defaults. */
export interface AlertThresholds {
  oxygen?: { urgentBelow?: number; warningBelow?: number };
  heartRate?: {
    urgentLow?: number;
    urgentHigh?: number;
    warningLow?: number;
    warningHigh?: number;
  };
  temperature?: { urgentAbove?: number; warningAbove?: number };
  respiratory?: {
    urgentLow?: number;
    urgentHigh?: number;
    warningLow?: number;
    warningHigh?: number;
  };
}

export interface HospitalSettings {
  timezone?: string;
  alertThresholds?: AlertThresholds;
}

/** The tenant. Every signed-in user belongs to exactly one hospital. */
export interface Hospital {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: "active" | "paused";
  settings: HospitalSettings;
}

export interface Ward {
  id: string;
  name: string;
}

export type InviteStatus = "pending" | "claimed" | "revoked";

export interface HospitalInvite {
  id: string;
  email: string;
  name: string;
  role: Role;
  detail: string;
  initials: string;
  status: InviteStatus;
  at: string;
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
  wardId: string | null;
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

/** Everything the signed-in user's hospital lets them read. */
export interface WardData {
  patients: Patient[];
  alerts: Alert[];
  tasks: Task[];
  medications: Medication[];
  notes: Note[];
  timeline: TimelineEvent[];
}
