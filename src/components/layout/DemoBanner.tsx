"use client";

import { useSession } from "@/lib/session";

/**
 * Persistent reminder that this is a demonstration environment. Ships from
 * Phase 2 onward so it is impossible to mistake seeded fiction for real PHI.
 */
export function DemoBanner() {
  const { dataSource, loadState, refreshing, authMode, authStatus, staff } =
    useSession();

  let sourceLabel = "Local demo data";
  if (loadState === "loading" || refreshing) {
    sourceLabel = "Loading…";
  } else if (authMode === "auth" && authStatus === "signed_in") {
    sourceLabel = `Signed in · ${staff.role} · ${dataSource === "supabase" ? "Live Supabase" : "Local"}`;
  } else if (dataSource === "supabase") {
    sourceLabel = "Live Supabase";
  }

  return (
    <div className="demo-banner" role="note">
      Demonstration system · Fictional patient data only · {sourceLabel}
    </div>
  );
}
