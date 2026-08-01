"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { Toast } from "@/components/Toast";
import { DemoBanner } from "./DemoBanner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * The persistent application chrome: demo banner, sidebar, top bar, and the
 * scrollable content region. Owns the mobile-navigation open state so the
 * sidebar and the top bar's menu button stay in sync.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { toast, clearToast, loadState, loadError, dataSource, reload, refreshing } =
    useSession();

  return (
    <>
      <DemoBanner />
      <div className="shell">
        <Sidebar open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
        <main className="main">
          <Topbar onMenu={() => setMobileNavOpen((v) => !v)} />
          <div className="content">
            {loadState === "loading" ? (
              <div className="empty">Loading ward data…</div>
            ) : (
              <>
                {loadError && dataSource === "seed" ? (
                  <div className="clinical-callout" style={{ marginBottom: 18 }}>
                    Could not load Supabase ({loadError}). Showing local demo data.{" "}
                    <button type="button" className="mini-btn" onClick={() => void reload()} disabled={refreshing}>
                      Retry
                    </button>
                  </div>
                ) : null}
                {children}
              </>
            )}
          </div>
        </main>
      </div>
      {toast ? <Toast message={toast} onDismiss={clearToast} /> : null}
    </>
  );
}
