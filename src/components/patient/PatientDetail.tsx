"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import type { Patient, Vitals } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { VitalsGrid } from "@/components/vitals/VitalsGrid";
import { RecordVitalsDrawer } from "@/components/vitals/RecordVitalsDrawer";
import { AlertRow } from "@/components/alerts/AlertRow";
import { TaskRow } from "@/components/tasks/TaskRow";
import { MedicationRow } from "@/components/medications/MedicationRow";
import { NoteRow } from "@/components/notes/NoteRow";
import { Timeline } from "@/components/Timeline";

const TABS = ["Overview", "Vitals", "Medications", "Notes", "Tasks", "Timeline"] as const;
type Tab = (typeof TABS)[number];

/**
 * Patient detail view with the six-tab layout from v1.
 * Record vitals is live (in-memory); notes / tasks / meds still land next.
 */
export function PatientDetail({ patient }: { patient: Patient }) {
  const {
    staff,
    data,
    recordVitals,
    acknowledgeAlert,
    resolveAlert,
  } = useSession();
  const [tab, setTab] = useState<Tab>("Overview");
  const [notice, setNotice] = useState<string | null>(null);
  const [vitalsOpen, setVitalsOpen] = useState(false);

  // Re-read patient from session so vitals updates re-render after recording.
  const live = data.patients.find((p) => p.id === patient.id) ?? patient;

  const alerts = data.alerts.filter((a) => a.patientId === live.id && a.status !== "resolved");
  const tasks = data.tasks.filter((t) => t.patientId === live.id && t.status !== "completed");
  const meds = data.medications.filter((m) => m.patientId === live.id);
  const notes = data.notes.filter((n) => n.patientId === live.id);
  const timeline = data.timeline.filter((e) => e.patientId === live.id);

  const isClinician = staff.role === "doctor" || staff.role === "nurse";
  const canManageAlerts = staff.role === "doctor" || staff.role === "nurse";
  const futureAction = (label: string) => () =>
    setNotice(`"${label}" is next after the vitals workflow. Still in-memory demo mode.`);

  const patientNumber = `DEMO-${1000 + Number(live.id.slice(1))}`;

  function handleRecordVitals(vitals: Vitals, note: string) {
    recordVitals(live.id, vitals, note || undefined);
    setVitalsOpen(false);
    setTab("Vitals");
    setNotice(null);
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
          </div>
          <div>
            <Badge tone={live.status} />
          </div>
        </div>
        <div className="allergy">Allergy: {live.allergy}</div>
        <div className="actions" style={{ marginTop: 14 }}>
          {isClinician ? (
            <>
              <button className="btn primary" onClick={() => setVitalsOpen(true)}>
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
            {isClinician ? (
              <button className="btn primary" onClick={() => setVitalsOpen(true)}>
                Record vitals
              </button>
            ) : null}
          </div>
          <VitalsGrid vitals={live.vitals} />
          <div className="clinical-callout">
            Recordings update this session immediately. When Supabase is connected (Phase 3),
            readings and automatic alerts will persist across devices.
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

      {vitalsOpen ? (
        <RecordVitalsDrawer
          patient={live}
          onClose={() => setVitalsOpen(false)}
          onSubmit={handleRecordVitals}
        />
      ) : null}
    </>
  );
}
