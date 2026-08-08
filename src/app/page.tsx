"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { assignedPatients, bySeverity, wardSummary } from "@/lib/domain";
import { StatCard } from "@/components/StatCard";
import { PatientCard } from "@/components/patient/PatientCard";
import { PatientTable } from "@/components/patient/PatientTable";
import { Timeline } from "@/components/Timeline";
import { Badge } from "@/components/Badge";

export default function DashboardPage() {
  const { staff, data } = useSession();

  const summary = wardSummary(data);
  const attention = bySeverity(data.patients.filter((p) => p.status !== "stable"));
  const assigned = bySeverity(assignedPatients(data.patients, staff));
  const allPatients = bySeverity(data.patients);
  const patientName = (id: string) => data.patients.find((p) => p.id === id)?.name;

  // Doctors are seeded as "Dr. First Last"; greet by the given name.
  const firstName = staff.name.split(" ")[staff.role === "doctor" ? 1 : 0];

  // The "due now" work list combines open care tasks and medications due.
  const dueWork = [
    ...data.tasks
      .filter((t) => t.status === "open")
      .slice(0, 4)
      .map((t) => ({
        id: t.id,
        title: t.title,
        patientId: t.patientId,
        meta: `${t.due} · Task`,
        tone: t.priority === "important" ? ("warning" as const) : (t.priority as "urgent" | "routine"),
      })),
    ...data.medications
      .filter((m) => m.status === "due")
      .map((m) => ({
        id: m.id,
        title: `${m.name} · ${m.dose}`,
        patientId: m.patientId,
        meta: `${m.due} · Medication`,
        tone: "warning" as const,
      })),
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Medical Ward A · Day Shift</p>
          <h1>Good morning, {firstName}</h1>
          <p className="muted">Here is what needs attention across the ward.</p>
        </div>
      </div>

      <div className="stats">
        <Link href="/patients" className="stat-link">
          <StatCard label="Ward patients" value={summary.patients} note="Currently admitted" />
        </Link>
        <Link href="/alerts" className="stat-link">
          <StatCard
            label="Active alerts"
            value={summary.activeAlerts}
            note={`${summary.urgentAlerts} urgent`}
          />
        </Link>
        <Link href="/tasks" className="stat-link">
          <StatCard
            label="Open tasks"
            value={summary.openTasks}
            note={`${summary.urgentTasks} urgent`}
          />
        </Link>
        <Link href="/medications" className="stat-link">
          <StatCard label="Medications due" value={summary.medicationsDue} note="Next 60 minutes" />
        </Link>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Needs attention</h2>
          <span className="muted">{attention.length} patients</span>
        </div>
        <div className="attention-grid">
          {attention.length ? (
            attention.map((p) => <PatientCard key={p.id} patient={p} />)
          ) : (
            <div className="empty panel panel-pad">All patients are stable right now.</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>My assigned patients</h2>
          <span className="muted">
            {assigned.length} assigned to {staff.role === "admin" ? "ward" : "you"}
          </span>
        </div>
        <PatientTable patients={assigned} alerts={data.alerts} tasks={data.tasks} />
      </section>

      <section className="section two-col">
        <div>
          <div className="section-head">
            <h2>Tasks and medications due</h2>
            <Link href="/tasks" className="text-link">
              View tasks
            </Link>
          </div>
          <div className="panel panel-pad">
            {dueWork.length ? (
              dueWork.map((row) => (
                <Link
                  key={row.id}
                  href={`/patients/${row.patientId}`}
                  className="task-row task-row-link"
                >
                  <div className="row-top">
                    <div>
                      <strong>{row.title}</strong>
                      <div className="muted">
                        {patientName(row.patientId)} · {row.meta}
                      </div>
                    </div>
                    <Badge
                      tone={row.tone === "routine" ? "neutral" : row.tone}
                      label={row.tone}
                    />
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty">Nothing due right now.</div>
            )}
          </div>
        </div>
        <div>
          <div className="section-head">
            <h2>Recent ward activity</h2>
          </div>
          <div className="panel panel-pad">
            <Timeline events={data.timeline.slice(0, 6)} patients={data.patients} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>All ward patients</h2>
          <span className="muted">Search from the top bar by name, room, or diagnosis</span>
        </div>
        <PatientTable patients={allPatients} alerts={data.alerts} tasks={data.tasks} />
      </section>
    </>
  );
}
