/**
 * Destructive "reset to seed" is only offered when explicitly enabled, so a
 * production deployment cannot wipe clinical tables and the audit log.
 * Offline seed mode only resets local in-memory data and is always allowed.
 */
export function isDemoResetEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_RESET === "true";
}
