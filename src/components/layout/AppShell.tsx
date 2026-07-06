"use client";

import { useState } from "react";
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

  return (
    <>
      <DemoBanner />
      <div className="shell">
        <Sidebar open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
        <main className="main">
          <Topbar onMenu={() => setMobileNavOpen((v) => !v)} />
          <div className="content">{children}</div>
        </main>
      </div>
    </>
  );
}
