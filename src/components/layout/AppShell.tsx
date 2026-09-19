"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { Toast } from "@/components/Toast";
import { DemoBanner } from "./DemoBanner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";

const PUBLIC_PREFIXES = ["/login", "/signup"];

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
    reload,
    refreshing,
    authStatus,
  } = useSession();

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Session expired / signed out while browsing → login
  useEffect(() => {
    if (isPublic) return;
    if (authStatus === "signed_out") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authStatus, pathname, router, isPublic]);

  if (isPublic) {
    return (
      <>
        {children}
        {toast ? <Toast message={toast} onDismiss={clearToast} /> : null}
      </>
    );
  }

  const blockingAuth = authStatus === "loading" || authStatus === "signed_out";
  const unconfigured = authStatus === "unconfigured";
  const noHospital = authStatus === "no_hospital";

  // Signed in but not in a hospital yet: full-page onboarding, no app chrome.
  if (noHospital) {
    return (
      <>
        <OnboardingScreen />
        {toast ? <Toast message={toast} onDismiss={clearToast} /> : null}
      </>
    );
  }

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
            ) : unconfigured ? (
              <div className="clinical-callout">
                <strong>Supabase is not configured.</strong>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY,
                  then rebuild.
                </p>
              </div>
            ) : loadState === "loading" ? (
              <div className="empty loading-block">
                <div className="spinner" aria-hidden="true" />
                Loading ward data…
              </div>
            ) : loadState === "error" ? (
              <div className="clinical-callout">
                <strong>Could not load ward data.</strong>
                <p className="muted" style={{ margin: "8px 0 0" }}>{loadError}</p>
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 12 }}
                  onClick={() => void reload()}
                  disabled={refreshing}
                >
                  {refreshing ? "Retrying…" : "Retry"}
                </button>
              </div>
            ) : (
              <>
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
