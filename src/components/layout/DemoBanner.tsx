"use client";

import { useSession } from "@/lib/session";

/**
 * Persistent reminder that this build is not cleared for real patient data yet.
 * Remove only once the compliance checklist for a real deployment is done.
 */
export function DemoBanner() {
  const { hospital, staff, authStatus } = useSession();

  const who =
    authStatus === "signed_in" && hospital
      ? ` · ${hospital.name} · ${staff.role}`
      : "";

  return (
    <div className="demo-banner" role="note">
      Demonstration system · Do not enter real patient data{who}
    </div>
  );
}
