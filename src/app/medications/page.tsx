"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { assignedPatients } from "@/lib/domain";
import { MedicationRow } from "@/components/medications/MedicationRow";
import { OrderMedicationDrawer } from "@/components/medications/OrderMedicationDrawer";

export default function MedicationsPage() {
  const { staff, data, administerMedication, orderMedication, actionBusy } =
    useSession();
  const [orderOpen, setOrderOpen] = useState(false);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const canOrder = staff.role === "doctor";
  const canAdminister = staff.role === "nurse" || staff.role === "doctor";

  const patients = useMemo(
    () => assignedPatients(data.patients, staff),
    [data.patients, staff],
  );
  const patientName = (id: string) =>
    data.patients.find((p) => p.id === id)?.name ?? id;

  const medications = useMemo(() => {
    const list =
      filter === "active"
        ? data.medications.filter((m) => m.status !== "administered")
        : data.medications;
    const rank = { due: 0, upcoming: 1, administered: 2 } as const;
    return [...list].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [data.medications, filter]);

  const dueCount = data.medications.filter((m) => m.status === "due").length;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Ward pharmacy</p>
          <h1>Medications</h1>
          <p className="muted">
            {dueCount} medication{dueCount === 1 ? "" : "s"} due now.
          </p>
        </div>
        <div className="actions">
          <div className="filter-pills" role="group" aria-label="Medication filter">
            <button
              type="button"
              className={`mini-btn ${filter === "active" ? "active-filter" : ""}`}
              onClick={() => setFilter("active")}
            >
              Active
            </button>
            <button
              type="button"
              className={`mini-btn ${filter === "all" ? "active-filter" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
          </div>
          {canOrder ? (
            <button type="button" className="btn primary" onClick={() => setOrderOpen(true)}>
              Order medication
            </button>
          ) : null}
        </div>
      </div>

      <div className="panel panel-pad">
        {medications.length ? (
          medications.map((med) => (
            <div key={med.id} className="list-item-block">
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                <Link href={`/patients/${med.patientId}`} className="text-link" style={{ display: "inline" }}>
                  {patientName(med.patientId)}
                </Link>
              </div>
              <MedicationRow
                medication={med}
                busy={actionBusy}
                onAdminister={
                  canAdminister && med.status !== "administered"
                    ? (id) => void administerMedication(id)
                    : undefined
                }
              />
            </div>
          ))
        ) : (
          <div className="empty">
            {filter === "active" ? "No active medication orders." : "No medications yet."}
          </div>
        )}
      </div>

      {orderOpen ? (
        <OrderMedicationDrawer
          patients={patients.length ? patients : data.patients}
          onClose={() => setOrderOpen(false)}
          onSubmit={orderMedication}
        />
      ) : null}
    </>
  );
}
