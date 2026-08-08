"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
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

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Session expired / signed out while browsing → login
  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    if (authMode === "auth" && authStatus === "signed_out") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authMode, authStatus, pathname, router]);

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
        {mobileNavOpen ? (
          <button
            type="button"
            className="nav-backdrop"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
        <Sidebar open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
        <main className="main">
          <Topbar onMenu={() => setMobileNavOpen((v) => !v)} />
          <div className="content">
            {blockingAuth ? (
              <div className="empty loading-block">
                <div className="spinner" aria-hidden="true" />
                Checking session…
              </div>
            ) : unlinked ? (
              <div className="clinical-callout">
                <strong>Account not linked to staff.</strong>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  {authError ??
                    "Your login is not linked to a staff profile. Contact a ward admin to set staff.auth_user_id."}
                </p>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 12 }}
                  onClick={() => router.replace("/login")}
                >
                  Back to sign in
                </button>
              </div>
            ) : loadState === "loading" ? (
              <div className="empty loading-block">
                <div className="spinner" aria-hidden="true" />
                Loading ward data…
              </div>
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
                      {refreshing ? "Retrying…" : "Retry"}
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
