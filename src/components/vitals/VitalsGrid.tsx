"use client";

import type { PatientStatus, PatientVitals } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { useSession } from "@/lib/session";
import { effectiveThresholds } from "@/lib/thresholds";

type Bounds = {
  urgentLow?: number;
  warnLow?: number;
  warnHigh?: number;
  urgentHigh?: number;
};

/** Colour-code a single reading; mirrors the server's alert rules. */
function tone(value: number, b: Bounds): PatientStatus {
  if ((b.urgentLow !== undefined && value < b.urgentLow) || (b.urgentHigh !== undefined && value > b.urgentHigh))
    return "urgent";
  if ((b.warnLow !== undefined && value < b.warnLow) || (b.warnHigh !== undefined && value > b.warnHigh))
    return "warning";
  return "stable";
}

/**
 * Grid of the five tracked vitals, colour-coded against this hospital's own
 * alert limits. Blood pressure has no computed tone. A reading that has never
 * been recorded shows "Not recorded" instead of a misleading zero.
 */
export function VitalsGrid({ vitals }: { vitals: PatientVitals }) {
  const { hospital } = useSession();
  const t = effectiveThresholds(hospital?.settings.alertThresholds);

  const readings: { label: string; value: string | null; tone: PatientStatus }[] = [
    {
      label: "Oxygen saturation",
      value: vitals.oxygen === null ? null : `${vitals.oxygen}%`,
      tone:
        vitals.oxygen === null
          ? "stable"
          : tone(vitals.oxygen, { urgentLow: t.oxygen.urgentBelow, warnLow: t.oxygen.warningBelow }),
    },
    {
      label: "Heart rate",
      value: vitals.heartRate === null ? null : `${vitals.heartRate} bpm`,
      tone:
        vitals.heartRate === null
          ? "stable"
          : tone(vitals.heartRate, {
              urgentLow: t.heartRate.urgentLow,
              warnLow: t.heartRate.warningLow,
              warnHigh: t.heartRate.warningHigh,
              urgentHigh: t.heartRate.urgentHigh,
            }),
    },
    {
      label: "Blood pressure",
      value: vitals.bp === null ? null : `${vitals.bp} mmHg`,
      tone: "stable",
    },
    {
      label: "Temperature",
      value: vitals.temperature === null ? null : `${vitals.temperature}°C`,
      tone:
        vitals.temperature === null
          ? "stable"
          : tone(vitals.temperature, {
              warnHigh: t.temperature.warningAbove,
              urgentHigh: t.temperature.urgentAbove,
            }),
    },
    {
      label: "Respiratory rate",
      value: vitals.respiratory === null ? null : `${vitals.respiratory} /min`,
      tone:
        vitals.respiratory === null
          ? "stable"
          : tone(vitals.respiratory, {
              urgentLow: t.respiratory.urgentLow,
              warnLow: t.respiratory.warningLow,
              warnHigh: t.respiratory.warningHigh,
              urgentHigh: t.respiratory.urgentHigh,
            }),
    },
  ];

  return (
    <div className="vital-grid">
      {readings.map((r) => (
        <div className="vital" key={r.label}>
          <span className="vital-label">{r.label}</span>
          <div className="vital-value">
            {r.value === null ? (
              <>
                <strong className="muted">Not recorded</strong>
                <Badge tone="neutral" label="no reading" />
              </>
            ) : (
              <>
                <strong>{r.value}</strong>
                <Badge tone={r.tone} />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
