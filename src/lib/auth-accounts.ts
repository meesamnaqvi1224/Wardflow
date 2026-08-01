/**
 * Demo auth accounts for Phase 4.
 * Password is set by scripts/setup-demo-auth.mjs (default WardFlow!demo1).
 *
 * Note: Supabase rejects some fake TLDs (e.g. .demo). Use example.com.
 */

export const DEMO_ACCOUNTS = [
  {
    email: "doctor@example.com",
    staffId: "doctor-1",
    label: "Doctor — Dr. Sarah Khan",
    role: "doctor" as const,
  },
  {
    email: "nurse@example.com",
    staffId: "nurse-1",
    label: "Nurse — Alex Morgan",
    role: "nurse" as const,
  },
  {
    email: "admin@example.com",
    staffId: "admin-1",
    label: "Admin — Jordan Lee",
    role: "admin" as const,
  },
] as const;

export const DEFAULT_DEMO_PASSWORD = "WardFlow!demo1";
