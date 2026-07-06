"use client";

import { use } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { PatientDetail } from "@/components/patient/PatientDetail";

export default function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data } = useSession();
  const patient = data.patients.find((p) => p.id === id);

  if (!patient) {
    return (
      <>
        <Link href="/" className="back">
          ← Ward dashboard
        </Link>
        <div className="empty">Patient not found.</div>
      </>
    );
  }

  return <PatientDetail patient={patient} />;
}
