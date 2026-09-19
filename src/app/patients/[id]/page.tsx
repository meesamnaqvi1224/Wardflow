import Link from "next/link";
import { PatientDetail } from "@/components/patient/PatientDetail";
import { SEED } from "@/lib/seed";

export function generateStaticParams() {
  return SEED.patients.map((p) => ({ id: p.id }));
}

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = SEED.patients.find((p) => p.id === id);

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
