"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { assignedPatients, bySeverity } from "@/lib/domain";
import { patientHref } from "@/lib/routes";
import { PatientTable } from "@/components/patient/PatientTable";
import { AdmitPatientDrawer } from "@/components/patient/AdmitPatientDrawer";

export default function MyPatientsPage() {
  const { staff, data, hospital, wards, allStaff, admitPatient } = useSession();
  const router = useRouter();
  const [admitOpen, setAdmitOpen] = useState(false);
  const patients = bySeverity(assignedPatients(data.patients, staff));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{hospital?.name ?? "Ward"}</p>
          <h1>My patients</h1>
          <p className="muted">
            {staff.role === "admin"
              ? "Every patient currently admitted."
              : "Patients currently assigned to you, most urgent first."}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => setAdmitOpen(true)}>
            Admit patient
          </button>
        </div>
      </div>
      {patients.length ? (
        <PatientTable patients={patients} alerts={data.alerts} tasks={data.tasks} />
      ) : (
        <div className="empty panel panel-pad">
          {staff.role === "admin"
            ? "No patients yet. Use Admit patient to add the first one."
            : "No patients are assigned to you yet."}
        </div>
      )}

      {admitOpen ? (
        <AdmitPatientDrawer
          wards={wards}
          staffList={allStaff}
          defaultDoctorId={staff.role === "doctor" ? staff.id : undefined}
          defaultNurseId={staff.role === "nurse" ? staff.id : undefined}
          onClose={() => setAdmitOpen(false)}
          onSubmit={async (input) => {
            const result = await admitPatient(input);
            if (!result.error && result.id) router.push(patientHref(result.id));
            return { error: result.error };
          }}
        />
      ) : null}
    </>
  );
}
