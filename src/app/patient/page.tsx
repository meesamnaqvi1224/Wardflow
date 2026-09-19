"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PatientDetail } from "@/components/patient/PatientDetail";
import { useSession } from "@/lib/session";

function PatientRoute() {
  const id = useSearchParams().get("id");
  const { data } = useSession();
  const patient = id ? data.patients.find((p) => p.id === id) : undefined;

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

export default function PatientPage() {
  return (
    <Suspense fallback={<div className="empty">Loading patient…</div>}>
      <PatientRoute />
    </Suspense>
  );
}
