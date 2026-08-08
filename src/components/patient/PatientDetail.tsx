"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import type { Patient, Vitals } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { VitalsGrid } from "@/components/vitals/VitalsGrid";
import { RecordVitalsDrawer } from "@/components/vitals/RecordVitalsDrawer";
import { EditPatientDrawer } from "@/components/patient/EditPatientDrawer";
import { AlertRow } from "@/components/alerts/AlertRow";
import { TaskRow } from "@/components/tasks/TaskRow";
import { CreateTaskDrawer } from "@/components/tasks/CreateTaskDrawer";
import { MedicationRow } from "@/components/medications/MedicationRow";
import { OrderMedicationDrawer } from "@/components/medications/OrderMedicationDrawer";
import { NoteRow } from "@/components/notes/NoteRow";
import { AddNoteDrawer } from "@/components/notes/AddNoteDrawer";
import { Timeline } from "@/components/Timeline";

const TABS = ["Overview", "Vitals", "Medications", "Notes", "Tasks", "Timeline"] as const;
type Tab = (typeof TABS)[number];

/**
 * Patient detail view with the six-tab layout from v1.
 * Vitals, profile, tasks, and medications are interactive.
 */
export function PatientDetail({ patient }: { patient: Patient }) {
  const {
    staff,
    allStaff,
    data,
    recordVitals,
    updatePatientProfile,
    acknowledgeAlert,
    resolveAlert,
    completeTask,
    createTask,
    administerMedication,
    orderMedication,
    addNote,
  } = useSession();
  const [tab, setTab] = useState<Tab>("Overview");
  const [notice, setNotice] = useState<string | null>(null);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [medOpen, setMedOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // Re-read patient from session so vitals updates re-render after recording.
  const live = data.patients.find((p) => p.id === patient.id) ?? patient;

  const alerts = data.alerts.filter((a) => a.patientId === live.id && a.status !== "resolved");
  const tasks = data.tasks.filter((t) => t.patientId === live.id && t.status !== "completed");
  const meds = data.medications.filter((m) => m.patientId === live.id);
  const notes = data.notes.filter((n) => n.patientId === live.id);
  const timeline = data.timeline.filter((e) => e.patientId === live.id);

  const isClinician = staff.role === "doctor" || staff.role === "nurse";
  const canEditProfile =
    staff.role === "doctor" || staff.role === "nurse" || staff.role === "admin";
  const canEditAssignments = staff.role === "admin" || staff.role === "doctor";
  const canManageAlerts = staff.role === "doctor" || staff.role === "nurse";
  const canAdminister = staff.role === "nurse" || staff.role === "doctor";
  const canAddNote = isClinician || staff.role === "admin";

  const patientNumber = `DEMO-${1000 + Number(live.id.slice(1))}`;
  const doctorName =
    allStaff.find((s) => s.id === live.doctorId)?.name ?? live.doctorId;
  const nurseName =
    allStaff.find((s) => s.id === live.nurseId)?.name ?? live.nurseId;

  async function handleRecordVitals(vitals: Vitals, note: string) {
    setVitalsOpen(false);
    setTab("Vitals");
    setNotice(null);
    await recordVitals(live.id, vitals, note || undefined);
  }

  return (
    <>
      <Link href="/" className="back">
        ← Ward dashboard
      </Link>

      <div className="patient-banner">
        <div className="patient-banner-main">
          <div>
            <p className="eyebrow">
              Room {live.room} · Patient {patientNumber}
            </p>
            <h1>
              {live.name} <span className="muted">· {live.age} years</span>
            </h1>
            <p className="muted">
              Admitted {live.admitted} · Primary diagnosis: {live.diagnosis}
            </p>
            <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              Care team: {doctorName} · {nurseName}
            </p>
          </div>
          <div>
            <Badge tone={live.status} />
          </div>
        </div>
        <div className="allergy">Allergy: {live.allergy}</div>
        <div className="actions" style={{ marginTop: 14 }}>
          {canEditProfile ? (
            <button className="btn" onClick={() => setEditOpen(true)}>
              Edit profile
            </button>
          ) : null}
          {isClinician ? (
            <>
              <button className="btn primary" onClick={() => setVitalsOpen(true)}>
                Record vitals
              </button>
              <button
                className="btn"
                onClick={() => {
                  setNotice(null);
                  setNoteOpen(true);
                }}
              >
                Add note
              </button>
              <button
                className="btn"
                onClick={() => {
                  setNotice(null);
                  setTaskOpen(true);
                }}
              >
                Create task
              </button>
            </>
          ) : null}
          {staff.role === "doctor" ? (
            <button
              className="btn"
              onClick={() => {
                setNotice(null);
                setMedOpen(true);
              }}
            >
              Order medication
            </button>
          ) : null}
        </div>
      </div>

      <nav className="tabs" aria-label="Patient sections">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
          >
            {t}
          </button>
        ))}
      </nav>

      {notice ? <div className="clinical-callout">{notice}</div> : null}

      {tab === "Overview" ? (
        <>
          <div className="two-col">
            <div className="panel panel-pad">
              <h2>Current status</h2>
              <VitalsGrid vitals={live.vitals} />
            </div>
            <div className="panel panel-pad">
              <h2>Alerts and tasks</h2>
              {alerts.length ? (
                alerts.map((a) => (
                  <AlertRow
                    key={a.id}
                    alert={a}
                    onAcknowledge={canManageAlerts ? acknowledgeAlert : undefined}
                    onResolve={canManageAlerts ? resolveAlert : undefined}
                  />
                ))
              ) : (
                <div className="empty">No active alerts</div>
              )}
              {tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onComplete={
                    isClinician ? (id) => void completeTask(id) : undefined
                  }
                />
              ))}
            </div>
          </div>
          <div className="two-col section">
            <div className="panel panel-pad">
              <h2>Current medications</h2>
              {meds.length ? (
                meds.map((m) => (
                  <MedicationRow
                    key={m.id}
                    medication={m}
                    onAdminister={
                      canAdminister ? (id) => void administerMedication(id) : undefined
                    }
                  />
                ))
              ) : (
                <div className="empty">No active medications</div>
              )}
            </div>
            <div className="panel panel-pad">
              <h2>Recent activity</h2>
              <Timeline events={timeline} />
            </div>
          </div>
        </>
      ) : null}

      {tab === "Vitals" ? (
        <div className="panel panel-pad">
          <div className="section-head">
            <h2>Latest vital readings</h2>
            {isClinician ? (
              <button className="btn primary" onClick={() => setVitalsOpen(true)}>
                Record vitals
              </button>
            ) : null}
          </div>
          <VitalsGrid vitals={live.vitals} />
          <div className="clinical-callout">
            Recordings save to the connected data store (Supabase when configured). Abnormal
            values automatically create alerts and timeline entries.
          </div>
        </div>
      ) : null}

      {tab === "Medications" ? (
        <div className="panel panel-pad">
          <div className="section-head">
            <h2>Medication orders</h2>
            {staff.role === "doctor" ? (
              <button type="button" className="btn primary" onClick={() => setMedOpen(true)}>
                Order medication
              </button>
            ) : null}
          </div>
          {meds.length ? (
            meds.map((m) => (
              <MedicationRow
                key={m.id}
                medication={m}
                onAdminister={
                  canAdminister ? (id) => void administerMedication(id) : undefined
                }
              />
            ))
          ) : (
            <div className="empty">No active medications</div>
          )}
        </div>
      ) : null}

      {tab === "Notes" ? (
        <div className="panel panel-pad">
          <div className="section-head">
            <h2>Clinical notes</h2>
            {canAddNote ? (
              <button type="button" className="btn primary" onClick={() => setNoteOpen(true)}>
                Add note
              </button>
            ) : null}
          </div>
          {notes.length ? (
            notes.map((n) => <NoteRow key={n.id} note={n} />)
          ) : (
            <div className="empty">No clinical notes yet.</div>
          )}
        </div>
      ) : null}

      {tab === "Tasks" ? (
        <div className="panel panel-pad">
          <div className="section-head">
            <h2>Care tasks</h2>
            {isClinician ? (
              <button type="button" className="btn primary" onClick={() => setTaskOpen(true)}>
                Create task
              </button>
            ) : null}
          </div>
          {tasks.length ? (
            tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onComplete={
                  isClinician ? (id) => void completeTask(id) : undefined
                }
              />
            ))
          ) : (
            <div className="empty">No open tasks.</div>
          )}
        </div>
      ) : null}

      {tab === "Timeline" ? (
        <div className="panel panel-pad">
          <h2>Complete activity timeline</h2>
          <Timeline events={timeline} />
        </div>
      ) : null}

      {vitalsOpen ? (
        <RecordVitalsDrawer
          patient={live}
          onClose={() => setVitalsOpen(false)}
          onSubmit={handleRecordVitals}
        />
      ) : null}

      {editOpen ? (
        <EditPatientDrawer
          patient={live}
          staffList={allStaff}
          canEditAssignments={canEditAssignments}
          onClose={() => setEditOpen(false)}
          onSubmit={async (input) => {
            const result = await updatePatientProfile(live.id, input);
            if (result.error) throw new Error(result.error);
            setNotice(null);
          }}
        />
      ) : null}

      {taskOpen ? (
        <CreateTaskDrawer
          patients={[live]}
          defaultPatientId={live.id}
          onClose={() => setTaskOpen(false)}
          onSubmit={async (input) => {
            const result = await createTask(input);
            if (!result.error) setTab("Tasks");
            return result;
          }}
        />
      ) : null}

      {medOpen ? (
        <OrderMedicationDrawer
          patients={[live]}
          defaultPatientId={live.id}
          onClose={() => setMedOpen(false)}
          onSubmit={async (input) => {
            const result = await orderMedication(input);
            if (!result.error) setTab("Medications");
            return result;
          }}
        />
      ) : null}

      {noteOpen ? (
        <AddNoteDrawer
          patient={live}
          role={staff.role}
          onClose={() => setNoteOpen(false)}
          onSubmit={async (input) => {
            const result = await addNote(input);
            if (!result.error) setTab("Notes");
            return result;
          }}
        />
      ) : null}
    </>
  );
}
