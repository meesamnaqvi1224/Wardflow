"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { Toast } from "@/components/Toast";
import { DemoBanner } from "./DemoBanner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Persistent application chrome. Login route renders children only (no shell).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const {
    toast,
    clearToast,
    loadState,
    loadError,
    dataSource,
    reload,
    refreshing,
    authMode,
    authStatus,
    authError,
  } = useSession();

  if (pathname.startsWith("/login")) {
    return (
      <>
        {children}
        {toast ? <Toast message={toast} onDismiss={clearToast} /> : null}
      </>
    );
  }

  const blockingAuth =
    authMode === "auth" &&
    (authStatus === "loading" || authStatus === "signed_out");

  const unlinked = authMode === "auth" && authStatus === "unlinked";

  return (
    <>
      <DemoBanner />
      <div className="shell">
        <Sidebar open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
        <main className="main">
          <Topbar onMenu={() => setMobileNavOpen((v) => !v)} />
          <div className="content">
            {blockingAuth ? (
              <div className="empty">Checking session…</div>
            ) : unlinked ? (
              <div className="clinical-callout">
                <strong>Account not linked to staff.</strong>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  {authError ??
                    "Sign in with a demo account that has staff.auth_user_id set."}
                </p>
              </div>
            ) : loadState === "loading" ? (
              <div className="empty">Loading ward data…</div>
            ) : (
              <>
                {loadError && dataSource === "seed" ? (
                  <div className="clinical-callout" style={{ marginBottom: 18 }}>
                    Could not load Supabase ({loadError}). Showing local demo data.{" "}
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => void reload()}
                      disabled={refreshing}
                    >
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
