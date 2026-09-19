/**
 * Patient detail lives at a single static route (/patient?id=…) so any patient
 * id works under `output: "export"`, where dynamic segments must be known at
 * build time.
 */
export function patientHref(id: string): string {
  return `/patient?id=${encodeURIComponent(id)}`;
}
