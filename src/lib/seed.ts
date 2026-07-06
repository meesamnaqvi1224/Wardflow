import type { StaffMember, WardData } from "./types";

/**
 * Seeded demo dataset — fictional patients only.
 *
 * This is the same scenario the v1 prototype ships, re-typed. In Phase 3 it
 * becomes the SQL seed for Supabase; the shape is intentionally identical so
 * the migration is a straight copy rather than a re-model.
 */

export const STAFF: StaffMember[] = [
  { id: "doctor-1", name: "Dr. Sarah Khan", role: "doctor", detail: "Attending physician", initials: "SK" },
  { id: "doctor-2", name: "Dr. Omar Siddiqui", role: "doctor", detail: "Ward physician", initials: "OS" },
  { id: "nurse-1", name: "Nurse Alex Morgan", role: "nurse", detail: "Day shift", initials: "AM" },
  { id: "nurse-2", name: "Nurse Priya Nair", role: "nurse", detail: "Day shift", initials: "PN" },
  { id: "admin-1", name: "Jordan Lee", role: "admin", detail: "Ward administrator", initials: "JL" },
];

const ADMITTED = "June 4, 2026";
const UPDATED = "A few minutes ago";

export const SEED: WardData = {
  patients: [
    { id: "p1", name: "Maya Patel", age: 67, room: "204-B", diagnosis: "Pneumonia", allergy: "Penicillin", status: "urgent", doctorId: "doctor-1", nurseId: "nurse-1", admitted: ADMITTED, updated: UPDATED, vitals: { oxygen: 89, heartRate: 112, bp: "128/82", temperature: 38.4, respiratory: 25 } },
    { id: "p2", name: "Robert Allen", age: 54, room: "208-A", diagnosis: "Post-operative recovery", allergy: "None recorded", status: "warning", doctorId: "doctor-1", nurseId: "nurse-1", admitted: ADMITTED, updated: UPDATED, vitals: { oxygen: 96, heartRate: 102, bp: "139/88", temperature: 38.2, respiratory: 20 } },
    { id: "p3", name: "Elena Garcia", age: 42, room: "206-A", diagnosis: "Acute asthma", allergy: "Ibuprofen", status: "stable", doctorId: "doctor-1", nurseId: "nurse-1", admitted: ADMITTED, updated: UPDATED, vitals: { oxygen: 97, heartRate: 84, bp: "118/76", temperature: 37.1, respiratory: 18 } },
    { id: "p4", name: "Noah Williams", age: 73, room: "202-C", diagnosis: "Heart failure observation", allergy: "Latex", status: "warning", doctorId: "doctor-1", nurseId: "nurse-2", admitted: ADMITTED, updated: UPDATED, vitals: { oxygen: 94, heartRate: 98, bp: "152/91", temperature: 36.9, respiratory: 22 } },
    { id: "p5", name: "Aisha Rahman", age: 29, room: "210-A", diagnosis: "Severe dehydration", allergy: "None recorded", status: "stable", doctorId: "doctor-2", nurseId: "nurse-1", admitted: ADMITTED, updated: UPDATED, vitals: { oxygen: 99, heartRate: 88, bp: "111/72", temperature: 37.0, respiratory: 16 } },
    { id: "p6", name: "Daniel Kim", age: 61, room: "205-B", diagnosis: "Diabetic foot infection", allergy: "Sulfa drugs", status: "stable", doctorId: "doctor-2", nurseId: "nurse-2", admitted: ADMITTED, updated: UPDATED, vitals: { oxygen: 98, heartRate: 80, bp: "126/80", temperature: 37.4, respiratory: 17 } },
    { id: "p7", name: "Priya Sharma", age: 35, room: "207-A", diagnosis: "Appendicitis observation", allergy: "None recorded", status: "stable", doctorId: "doctor-1", nurseId: "nurse-2", admitted: ADMITTED, updated: UPDATED, vitals: { oxygen: 99, heartRate: 78, bp: "116/75", temperature: 37.2, respiratory: 15 } },
    { id: "p8", name: "James Walker", age: 48, room: "209-B", diagnosis: "Cellulitis", allergy: "Amoxicillin", status: "stable", doctorId: "doctor-2", nurseId: "nurse-1", admitted: ADMITTED, updated: UPDATED, vitals: { oxygen: 98, heartRate: 82, bp: "124/79", temperature: 37.5, respiratory: 16 } },
  ],
  alerts: [
    { id: "a1", patientId: "p1", severity: "urgent", message: "Oxygen saturation 89% is below threshold", status: "active", at: "10:42 AM" },
    { id: "a2", patientId: "p2", severity: "warning", message: "Temperature 38.2°C is above threshold", status: "active", at: "10:18 AM" },
    { id: "a3", patientId: "p4", severity: "warning", message: "Oxygen saturation 94% is below threshold", status: "acknowledged", at: "9:52 AM" },
  ],
  tasks: [
    { id: "t1", patientId: "p1", title: "Recheck oxygen saturation", due: "In 15 minutes", priority: "urgent", status: "open" },
    { id: "t2", patientId: "p2", title: "Review surgical dressing", due: "11:30 AM", priority: "important", status: "open" },
    { id: "t3", patientId: "p3", title: "Complete respiratory assessment", due: "12:00 PM", priority: "routine", status: "open" },
    { id: "t4", patientId: "p5", title: "Repeat fluid balance", due: "1:00 PM", priority: "routine", status: "open" },
  ],
  medications: [
    { id: "m1", patientId: "p1", name: "Ceftriaxone", dose: "1 g IV", due: "12:00 PM", status: "due" },
    { id: "m2", patientId: "p1", name: "Paracetamol", dose: "500 mg oral", due: "2:00 PM", status: "upcoming" },
    { id: "m3", patientId: "p2", name: "Enoxaparin", dose: "40 mg SC", due: "11:30 AM", status: "due" },
    { id: "m4", patientId: "p3", name: "Salbutamol", dose: "2.5 mg nebulized", due: "1:00 PM", status: "upcoming" },
  ],
  notes: [
    { id: "n1", patientId: "p1", author: "Nurse Alex Morgan", type: "Nursing note", content: "Patient reports increasing shortness of breath on movement.", at: "10:40 AM" },
    { id: "n2", patientId: "p1", author: "Dr. Sarah Khan", type: "Doctor note", content: "Continue close oxygen monitoring and repeat reading after intervention.", at: "10:47 AM" },
    { id: "n3", patientId: "p3", author: "Nurse Alex Morgan", type: "Nursing note", content: "Breathing comfortable following morning nebulizer.", at: "9:50 AM" },
  ],
  timeline: [
    { id: "e1", patientId: "p1", summary: "Nurse Alex recorded vitals: oxygen saturation 89%", at: "10:42 AM", type: "urgent" },
    { id: "e2", patientId: "p1", summary: "Urgent vital alert automatically created", at: "10:42 AM", type: "urgent" },
    { id: "e3", patientId: "p1", summary: "Dr. Sarah requested another oxygen reading", at: "10:46 AM", type: "task" },
    { id: "e4", patientId: "p2", summary: "Nurse Alex recorded temperature 38.2°C", at: "10:18 AM", type: "warning" },
    { id: "e5", patientId: "p3", summary: "Morning medication administered", at: "9:45 AM", type: "medication" },
    { id: "e6", patientId: "p4", summary: "Dr. Sarah acknowledged oxygen alert", at: "10:02 AM", type: "alert" },
  ],
};
