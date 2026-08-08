import type {
  Alert,
  AlertSeverity,
  AlertStatus,
  AuditEvent,
  Medication,
  MedicationStatus,
  Note,
  Patient,
  PatientStatus,
  Role,
  StaffMember,
  Task,
  TaskPriority,
  TaskStatus,
  TimelineEvent,
  TimelineType,
  WardData,
} from "@/lib/types";

/** Raw row shapes returned by PostgREST (snake_case). */

export interface StaffRow {
  id: string;
  name: string;
  role: Role;
  detail: string;
  initials: string;
  auth_user_id?: string | null;
}

export interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  patient_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface PatientRow {
  id: string;
  name: string;
  age: number;
  room: string;
  diagnosis: string;
  allergy: string;
  status: PatientStatus;
  doctor_id: string | null;
  nurse_id: string | null;
  admitted_on: string;
  oxygen: number | null;
  heart_rate: number | null;
  bp: string | null;
  temperature: number | string | null;
  respiratory: number | null;
  updated_at: string;
}

export interface AlertRow {
  id: string;
  patient_id: string;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  patient_id: string;
  title: string;
  due_label: string;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
}

export interface MedicationRow {
  id: string;
  patient_id: string;
  name: string;
  dose: string;
  due_label: string;
  status: MedicationStatus;
  created_at: string;
}

export interface NoteRow {
  id: string;
  patient_id: string;
  author_name: string;
  note_type: string;
  content: string;
  created_at: string;
}

export interface TimelineRow {
  id: string;
  patient_id: string;
  summary: string;
  event_type: TimelineType;
  created_at: string;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 45_000) return "Just now";
  if (diffMs < 90_000) return "A minute ago";
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)} minutes ago`;
  if (diffMs < 86_400_000) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatAdmitted(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function mapStaff(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    detail: row.detail ?? "",
    initials: row.initials,
    authUserId: row.auth_user_id ?? null,
  };
}

export function mapAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    patientId: row.patient_id,
    detail: row.detail ?? {},
    at: formatWhen(row.created_at),
  };
}

export function mapPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    room: row.room,
    diagnosis: row.diagnosis,
    allergy: row.allergy,
    status: row.status,
    doctorId: row.doctor_id ?? "",
    nurseId: row.nurse_id ?? "",
    admitted: formatAdmitted(row.admitted_on),
    updated: formatWhen(row.updated_at),
    vitals: {
      oxygen: Number(row.oxygen ?? 0),
      heartRate: Number(row.heart_rate ?? 0),
      bp: row.bp ?? "—/—",
      temperature: Number(row.temperature ?? 0),
      respiratory: Number(row.respiratory ?? 0),
    },
  };
}

export function mapAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    patientId: row.patient_id,
    severity: row.severity,
    message: row.message,
    status: row.status,
    at: formatWhen(row.created_at),
  };
}

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    patientId: row.patient_id,
    title: row.title,
    due: row.due_label,
    priority: row.priority,
    status: row.status,
  };
}

export function mapMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    dose: row.dose,
    due: row.due_label,
    status: row.status,
  };
}

export function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    patientId: row.patient_id,
    author: row.author_name,
    type: row.note_type,
    content: row.content,
    at: formatWhen(row.created_at),
  };
}

export function mapTimeline(row: TimelineRow): TimelineEvent {
  return {
    id: row.id,
    patientId: row.patient_id,
    summary: row.summary,
    type: row.event_type,
    at: formatWhen(row.created_at),
  };
}

export function buildWardData(parts: {
  patients: PatientRow[];
  alerts: AlertRow[];
  tasks: TaskRow[];
  medications: MedicationRow[];
  notes: NoteRow[];
  timeline: TimelineRow[];
}): WardData {
  return {
    patients: parts.patients.map(mapPatient),
    alerts: parts.alerts.map(mapAlert),
    tasks: parts.tasks.map(mapTask),
    medications: parts.medications.map(mapMedication),
    notes: parts.notes.map(mapNote),
    // Newest first
    timeline: parts.timeline
      .slice()
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .map(mapTimeline),
  };
}
