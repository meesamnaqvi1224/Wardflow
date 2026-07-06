"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import type { Patient } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { VitalsGrid } from "@/components/vitals/VitalsGrid";
import { AlertRow } from "@/components/alerts/AlertRow";
import { TaskRow } from "@/components/tasks/TaskRow";
import { MedicationRow } from "@/components/medications/MedicationRow";
import { NoteRow } from "@/components/notes/NoteRow";
import { Timeline } from "@/components/Timeline";

const TABS = ["Overview", "Vitals", "Medications", "Notes", "Tasks", "Timeline"] as const;
type Tab = (typeof TABS)[number];

/**
 * Patient detail view with the six-tab layout from v1. Read-only in Phase 2 —
 * the action buttons are present so the intended workflow is reviewable, but
 * they announce that the write path lands in Phase 5 rather than mutating data
 * we don't yet persist.
 */
export function PatientDetail({ patient }: { patient: Patient }) {
  const { staff, data } = useSession();
  const [tab, setTab] = useState<Tab>("Overview");
  const [notice, setNotice] = useState<string | null>(null);

  const alerts = data.alerts.filter((a) => a.patientId === patient.id && a.status !== "resolved");
  const tasks = data.tasks.filter((t) => t.patientId === patient.id && t.status !== "completed");
  const meds = data.medications.filter((m) => m.patientId === patient.id);
  const notes = data.notes.filter((n) => n.patientId === patient.id);
  const timeline = data.timeline.filter((e) => e.patientId === patient.id);

  const isClinician = staff.role === "doctor" || staff.role === "nurse";
  const futureAction = (label: string) => () =>
    setNotice(`"${label}" becomes a live, saved workflow in Phase 5.`);

  const patientNumber = `DEMO-${1000 + Number(patient.id.slice(1))}`;

  return (
    <>
      <Link href="/" className="back">
        ← Ward dashboard
      </Link>

      <div className="patient-banner">
        <div className="patient-banner-main">
          <div>
            <p className="eyebrow">
              Room {patient.room} · Patient {patientNumber}
            </p>
            <h1>
              {patient.name} <span className="muted">· {patient.age} years</span>
            </h1>
            <p className="muted">
              Admitted {patient.admitted} · Primary diagnosis: {patient.diagnosis}
            </p>
          </div>
          <div>
            <Badge tone={patient.status} />
          </div>
        </div>
        <div className="allergy">Allergy: {patient.allergy}</div>
        <div className="actions" style={{ marginTop: 14 }}>
          {isClinician ? (
            <>
              <button className="btn primary" onClick={futureAction("Record vitals")}>
                Record vitals
              </button>
              <button className="btn" onClick={futureAction("Add note")}>
                Add note
              </button>
              <button className="btn" onClick={futureAction("Create task")}>
                Create task
              </button>
            </>
          ) : (
            <button className="btn" onClick={futureAction("Edit admission")}>
              Edit admission
            </button>
          )}
          {staff.role === "doctor" ? (
            <button className="btn" onClick={futureAction("Order medication")}>
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
              <VitalsGrid vitals={patient.vitals} />
            </div>
            <div className="panel panel-pad">
              <h2>Alerts and tasks</h2>
              {alerts.length ? (
                alerts.map((a) => <AlertRow key={a.id} alert={a} />)
              ) : (
                <div className="empty">No active alerts</div>
              )}
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </div>
          <div className="two-col section">
            <div className="panel panel-pad">
              <h2>Current medications</h2>
              {meds.length ? (
                meds.map((m) => <MedicationRow key={m.id} medication={m} />)
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
          </div>
          <VitalsGrid vitals={patient.vitals} />
          <div className="clinical-callout">
            Vital trends and historical readings will appear here once WardFlow is connected to the
            database (Phase 3).
          </div>
        </div>
      ) : null}

      {tab === "Medications" ? (
        <div className="panel panel-pad">
          <div className="section-head">
            <h2>Medication orders</h2>
          </div>
          {meds.length ? (
            meds.map((m) => <MedicationRow key={m.id} medication={m} />)
          ) : (
            <div className="empty">No active medications</div>
          )}
        </div>
      ) : null}

      {tab === "Notes" ? (
        <div className="panel panel-pad">
          <div className="section-head">
            <h2>Clinical notes</h2>
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
          </div>
          {tasks.length ? (
            tasks.map((t) => <TaskRow key={t.id} task={t} />)
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
    </>
  );
}
