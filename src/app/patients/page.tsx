"use client";

import { useSession } from "@/lib/session";
import { assignedPatients, bySeverity } from "@/lib/domain";
import { PatientTable } from "@/components/patient/PatientTable";

export default function MyPatientsPage() {
  const { staff, data } = useSession();
  const patients = bySeverity(assignedPatients(data.patients, staff));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Medical Ward A · Day Shift</p>
          <h1>My patients</h1>
          <p className="muted">
            {staff.role === "admin"
              ? "Every patient currently admitted to the ward."
              : "Patients currently assigned to you, most urgent first."}
          </p>
        </div>
      </div>
      <PatientTable patients={patients} alerts={data.alerts} tasks={data.tasks} />
    </>
  );
}
