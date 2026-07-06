"use client";

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
        <StatCard label="Ward patients" value={summary.patients} note="Currently admitted" />
        <StatCard
          label="Active alerts"
          value={summary.activeAlerts}
          note={`${summary.urgentAlerts} urgent`}
        />
        <StatCard
          label="Open tasks"
          value={summary.openTasks}
          note={`${summary.urgentTasks} urgent`}
        />
        <StatCard label="Medications due" value={summary.medicationsDue} note="Next 60 minutes" />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Needs attention</h2>
          <span className="muted">{attention.length} patients</span>
        </div>
        <div className="attention-grid">
          {attention.map((p) => (
            <PatientCard key={p.id} patient={p} />
          ))}
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
          </div>
          <div className="panel panel-pad">
            {dueWork.map((row) => (
              <div className="task-row" key={row.id}>
                <div className="row-top">
                  <div>
                    <strong>{row.title}</strong>
                    <div className="muted">
                      {patientName(row.patientId)} · {row.meta}
                    </div>
                  </div>
                  <Badge tone={row.tone === "routine" ? "neutral" : row.tone} label={row.tone} />
                </div>
              </div>
            ))}
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
          <span className="muted">Searchable from the top bar</span>
        </div>
        <PatientTable patients={allPatients} alerts={data.alerts} tasks={data.tasks} />
      </section>
    </>
  );
}
