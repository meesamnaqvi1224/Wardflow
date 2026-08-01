"use client";

import { useSession } from "@/lib/session";

/**
 * Persistent reminder that this is a demonstration environment. Ships from
 * Phase 2 onward so it is impossible to mistake seeded fiction for real PHI.
 */
export function DemoBanner() {
  const { dataSource, loadState, refreshing } = useSession();
  const sourceLabel =
    loadState === "loading" || refreshing
      ? "Loading…"
      : dataSource === "supabase"
        ? "Live Supabase"
        : "Local demo data";

  return (
    <div className="demo-banner" role="note">
      Demonstration system · Fictional patient data only · {sourceLabel}
    </div>
  );
}
