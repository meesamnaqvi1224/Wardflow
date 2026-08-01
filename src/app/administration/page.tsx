"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { useSession } from "@/lib/session";

export default function AdministrationPage() {
  const { staff, authMode, authStatus } = useSession();
  const router = useRouter();
  const allowed = staff.role === "admin";

  useEffect(() => {
    if (authMode === "auth" && authStatus === "signed_in" && !allowed) {
      router.replace("/");
    }
  }, [authMode, authStatus, allowed, router]);

  if (!allowed) {
    return (
      <div className="clinical-callout">
        Administration is restricted to ward admins.
      </div>
    );
  }

  return (
    <ModulePlaceholder
      eyebrow="Manage"
      title="Administration"
      description="Care-team assignments and ward staffing (admin only)."
      phase="Phase 6"
    />
  );
}
