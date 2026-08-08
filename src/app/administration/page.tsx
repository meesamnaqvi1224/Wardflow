"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/session";
import type { AuditEvent, Patient, PatientStatus, Role, StaffMember } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { StaffFormDrawer } from "@/components/admin/StaffFormDrawer";

export default function AdministrationPage() {
  const {
    staff,
    allStaff,
    data,
    authMode,
    authStatus,
    updatePatientProfile,
    createStaffMember,
    updateStaffMember,
    fetchAuditLog,
    resetDemo,
    refreshing,
  } = useSession();
  const router = useRouter();
  const allowed = staff.role === "admin";
  const [savingId, setSavingId] = useState<string | null>(null);
  const [staffDrawer, setStaffDrawer] = useState<"create" | StaffMember | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (authMode === "auth" && authStatus === "signed_in" && !allowed) {
      router.replace("/");
    }
  }, [authMode, authStatus, allowed, router]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    const result = await fetchAuditLog(40);
    setAudit(result.events);
    setAuditError(result.error);
    setAuditLoading(false);
  }, [fetchAuditLog]);

  useEffect(() => {
    if (allowed) void loadAudit();
  }, [allowed, loadAudit]);

  const doctors = useMemo(
    () => allStaff.filter((s) => s.role === "doctor"),
    [allStaff],
  );
  const nurses = useMemo(
    () => allStaff.filter((s) => s.role === "nurse"),
    [allStaff],
  );

  const staffLoad = useMemo(() => {
    return allStaff.map((s) => {
      const assigned =
        s.role === "doctor"
          ? data.patients.filter((p) => p.doctorId === s.id).length
          : s.role === "nurse"
            ? data.patients.filter((p) => p.nurseId === s.id).length
            : data.patients.length;
      return { ...s, assigned };
    });
  }, [allStaff, data.patients]);

  async function reassign(
    patient: Patient,
    field: "doctorId" | "nurseId",
    value: string,
  ) {
    setSavingId(patient.id);
    try {
      await updatePatientProfile(patient.id, {
        name: patient.name,
        age: patient.age,
        room: patient.room,
        diagnosis: patient.diagnosis,
        allergy: patient.allergy,
        status: patient.status as PatientStatus,
        doctorId: field === "doctorId" ? value : patient.doctorId,
        nurseId: field === "nurseId" ? value : patient.nurseId,
      });
    } finally {
      setSavingId(null);
    }
  }

  if (!allowed) {
    return (
      <div className="clinical-callout">
        Administration is restricted to ward admins.
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Manage</p>
          <h1>Administration</h1>
          <p className="muted">
            Staff directory, care-team assignments, and activity audit trail.
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => setStaffDrawer("create")}
          >
            Add staff
          </button>
          <button
            type="button"
            className="btn"
            disabled={refreshing}
            onClick={() => void resetDemo()}
          >
            {refreshing ? "Resetting…" : "Reset demo data"}
          </button>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Care team</h2>
          <span className="muted">{allStaff.length} staff</span>
        </div>
        <div className="panel panel-pad">
          <div className="admin-table admin-table-staff">
            <div className="admin-row admin-head">
              <span>Name</span>
              <span>Role</span>
              <span>Auth</span>
              <span>Assignments</span>
              <span />
            </div>
            {staffLoad.map((s) => (
              <div key={s.id} className="admin-row">
                <span>
                  <strong>{s.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {s.detail || s.initials}
                  </div>
                </span>
                <span style={{ textTransform: "capitalize" }}>{s.role}</span>
                <span>
                  {s.authUserId ? (
                    <Badge tone="stable" label="Linked" />
                  ) : (
                    <Badge tone="neutral" label="Unlinked" />
                  )}
                </span>
                <span>
                  {s.role === "admin"
                    ? "Ward-wide"
                    : `${s.assigned} patient${s.assigned === 1 ? "" : "s"}`}
                </span>
                <span>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setStaffDrawer(s)}
                  >
                    Edit
                  </button>
                </span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            To link a login: create the user in Supabase Authentication, then set{" "}
            <code>staff.auth_user_id</code> to that user&apos;s UUID (SQL editor).
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Patient assignments</h2>
          <span className="muted">{data.patients.length} admitted</span>
        </div>
        <div className="panel panel-pad">
          <div className="admin-table admin-table-patients">
            <div className="admin-row admin-head">
              <span>Patient</span>
              <span>Status</span>
              <span>Doctor</span>
              <span>Nurse</span>
            </div>
            {data.patients.map((p) => (
              <div key={p.id} className="admin-row">
                <span>
                  <Link
                    href={`/patients/${p.id}`}
                    className="text-link"
                    style={{ display: "inline" }}
                  >
                    {p.name}
                  </Link>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Room {p.room}
                  </div>
                </span>
                <span>
                  <Badge tone={p.status} />
                </span>
                <span>
                  <select
                    className="assignment-select"
                    value={p.doctorId}
                    disabled={savingId === p.id}
                    onChange={(e) => void reassign(p, "doctorId", e.target.value)}
                    aria-label={`Doctor for ${p.name}`}
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span>
                  <select
                    className="assignment-select"
                    value={p.nurseId}
                    disabled={savingId === p.id}
                    onChange={(e) => void reassign(p, "nurseId", e.target.value)}
                    aria-label={`Nurse for ${p.name}`}
                  >
                    {nurses.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Audit log</h2>
          <button
            type="button"
            className="mini-btn"
            disabled={auditLoading}
            onClick={() => void loadAudit()}
          >
            {auditLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <div className="panel panel-pad">
          {auditError ? (
            <div className="clinical-callout">{auditError}</div>
          ) : null}
          {audit.length ? (
            <div className="admin-table admin-table-audit">
              <div className="admin-row admin-head">
                <span>When</span>
                <span>Actor</span>
                <span>Action</span>
                <span>Entity</span>
              </div>
              {audit.map((e) => (
                <div key={e.id} className="admin-row">
                  <span className="muted">{e.at}</span>
                  <span>{e.actorName || e.actorId || "—"}</span>
                  <span>
                    <code>{e.action}</code>
                  </span>
                  <span className="muted">
                    {e.entityType}
                    {e.patientId ? (
                      <>
                        {" · "}
                        <Link
                          href={`/patients/${e.patientId}`}
                          className="text-link"
                          style={{ display: "inline" }}
                        >
                          patient
                        </Link>
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              {auditLoading
                ? "Loading audit events…"
                : "No audit events yet (actions will appear after vitals, tasks, notes, etc.)."}
            </div>
          )}
        </div>
      </section>

      {staffDrawer ? (
        <StaffFormDrawer
          mode={staffDrawer === "create" ? "create" : "edit"}
          initial={staffDrawer === "create" ? null : staffDrawer}
          onClose={() => setStaffDrawer(null)}
          onSubmit={async (input) => {
            if (staffDrawer === "create") {
              return createStaffMember({
                name: input.name,
                role: input.role as Role,
                detail: input.detail,
                initials: input.initials,
              });
            }
            return updateStaffMember({
              id: input.id!,
              name: input.name,
              role: input.role as Role,
              detail: input.detail,
              initials: input.initials,
            });
          }}
        />
      ) : null}
    </>
  );
}
