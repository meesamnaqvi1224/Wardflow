import type { PatientStatus, Vitals } from "@/lib/types";
import { Badge } from "@/components/Badge";

/** Colour-code a single reading against the ward thresholds. */
function tone(
  value: number,
  { urgentLow, warnLow, warnHigh, urgentHigh }: {
    urgentLow?: number;
    warnLow?: number;
    warnHigh?: number;
    urgentHigh?: number;
  },
): PatientStatus {
  if ((urgentLow !== undefined && value < urgentLow) || (urgentHigh !== undefined && value > urgentHigh))
    return "urgent";
  if ((warnLow !== undefined && value < warnLow) || (warnHigh !== undefined && value > warnHigh))
    return "warning";
  return "stable";
}

/**
 * Grid of the five tracked vitals, each colour-coded by acuity. Blood pressure
 * is shown without a computed tone (needs range parsing we defer to Phase 6).
 */
export function VitalsGrid({ vitals }: { vitals: Vitals }) {
  const readings: { label: string; value: string; tone: PatientStatus }[] = [
    {
      label: "Oxygen saturation",
      value: `${vitals.oxygen}%`,
      tone: tone(vitals.oxygen, { urgentLow: 90, warnLow: 95 }),
    },
    {
      label: "Heart rate",
      value: `${vitals.heartRate} bpm`,
      tone: tone(vitals.heartRate, { urgentLow: 40, warnLow: 50, warnHigh: 100, urgentHigh: 130 }),
    },
    { label: "Blood pressure", value: `${vitals.bp} mmHg`, tone: "stable" },
    {
      label: "Temperature",
      value: `${vitals.temperature}°C`,
      tone: tone(vitals.temperature, { warnHigh: 38, urgentHigh: 39.5 }),
    },
    {
      label: "Respiratory rate",
      value: `${vitals.respiratory} /min`,
      tone: tone(vitals.respiratory, { urgentLow: 8, warnLow: 10, warnHigh: 22, urgentHigh: 30 }),
    },
  ];

  return (
    <div className="vital-grid">
      {readings.map((r) => (
        <div className="vital" key={r.label}>
          <span className="vital-label">{r.label}</span>
          <div className="vital-value">
            <strong>{r.value}</strong>
            <Badge tone={r.tone} />
          </div>
        </div>
      ))}
    </div>
  );
}
