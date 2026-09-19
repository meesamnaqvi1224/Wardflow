import type { AlertThresholds } from "./types";

/**
 * Alert threshold form helpers. DEFAULT_THRESHOLDS mirrors
 * default_hospital_settings() in supabase/v2/02_onboarding.sql; the database is
 * the source of truth (it falls back to its own defaults for any value a
 * hospital leaves unset), so this copy only feeds placeholders and validation.
 */

export const DEFAULT_THRESHOLDS = {
  oxygen: { urgentBelow: 90, warningBelow: 95 },
  heartRate: { urgentLow: 40, warningLow: 50, warningHigh: 100, urgentHigh: 130 },
  temperature: { warningAbove: 38, urgentAbove: 39.5 },
  respiratory: { urgentLow: 8, warningLow: 10, warningHigh: 22, urgentHigh: 30 },
} as const;

type Group = keyof typeof DEFAULT_THRESHOLDS;

export interface ThresholdGroup {
  group: Group;
  title: string;
  unit: string;
  fields: { key: string; label: string }[];
}

export const THRESHOLD_GROUPS: ThresholdGroup[] = [
  {
    group: "oxygen",
    title: "Oxygen saturation",
    unit: "%",
    fields: [
      { key: "urgentBelow", label: "Urgent below" },
      { key: "warningBelow", label: "Warning below" },
    ],
  },
  {
    group: "heartRate",
    title: "Heart rate",
    unit: "bpm",
    fields: [
      { key: "urgentLow", label: "Urgent below" },
      { key: "warningLow", label: "Warning below" },
      { key: "warningHigh", label: "Warning above" },
      { key: "urgentHigh", label: "Urgent above" },
    ],
  },
  {
    group: "temperature",
    title: "Temperature",
    unit: "°C",
    fields: [
      { key: "warningAbove", label: "Warning above" },
      { key: "urgentAbove", label: "Urgent above" },
    ],
  },
  {
    group: "respiratory",
    title: "Respiratory rate",
    unit: "/min",
    fields: [
      { key: "urgentLow", label: "Urgent below" },
      { key: "warningLow", label: "Warning below" },
      { key: "warningHigh", label: "Warning above" },
      { key: "urgentHigh", label: "Urgent above" },
    ],
  },
];

export type ThresholdForm = Record<string, string>;

export type EffectiveThresholds = {
  [G in Group]: Record<string, number>;
};

/** Hospital overrides merged over the defaults: what the server actually applies. */
export function effectiveThresholds(saved: AlertThresholds | undefined): EffectiveThresholds {
  const out = {} as EffectiveThresholds;
  for (const g of THRESHOLD_GROUPS) {
    const savedGroup = (saved?.[g.group] ?? {}) as Record<string, number | undefined>;
    out[g.group] = {};
    for (const f of g.fields) {
      const v = savedGroup[f.key];
      out[g.group][f.key] = typeof v === "number" ? v : defaultFor(g.group, f.key);
    }
  }
  return out;
}

const fieldId = (group: string, key: string) => `${group}.${key}`;

export function defaultFor(group: Group, key: string): number {
  return (DEFAULT_THRESHOLDS[group] as Record<string, number>)[key];
}

/** Saved thresholds -> form strings ("" means "use the default"). */
export function thresholdsToForm(saved: AlertThresholds | undefined): ThresholdForm {
  const form: ThresholdForm = {};
  for (const g of THRESHOLD_GROUPS) {
    const savedGroup = (saved?.[g.group] ?? {}) as Record<string, number | undefined>;
    for (const f of g.fields) {
      const v = savedGroup[f.key];
      form[fieldId(g.group, f.key)] = typeof v === "number" ? String(v) : "";
    }
  }
  return form;
}

/**
 * Form strings -> thresholds containing only the values the user filled in,
 * or an error. Ordering is checked against the effective values (filled value
 * or default), because the server applies the same fallback.
 */
export function formToThresholds(
  form: ThresholdForm,
): { value: AlertThresholds; error: null } | { value: null; error: string } {
  const out: Record<string, Record<string, number>> = {};
  const effective: Record<string, Record<string, number>> = {};

  for (const g of THRESHOLD_GROUPS) {
    effective[g.group] = {};
    for (const f of g.fields) {
      const raw = (form[fieldId(g.group, f.key)] ?? "").trim();
      if (raw === "") {
        effective[g.group][f.key] = defaultFor(g.group, f.key);
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { value: null, error: `${g.title} ${f.label.toLowerCase()}: enter a number, or leave blank for the default.` };
      }
      (out[g.group] ??= {})[f.key] = n;
      effective[g.group][f.key] = n;
    }
  }

  const e = effective;
  const bad = (msg: string) => ({ value: null, error: msg }) as const;
  if (!(e.oxygen.urgentBelow <= e.oxygen.warningBelow)) {
    return bad("Oxygen: the urgent threshold must not be above the warning threshold.");
  }
  if (!(e.heartRate.urgentLow <= e.heartRate.warningLow && e.heartRate.warningLow <= e.heartRate.warningHigh && e.heartRate.warningHigh <= e.heartRate.urgentHigh)) {
    return bad("Heart rate: thresholds must run urgent below ≤ warning below ≤ warning above ≤ urgent above.");
  }
  if (!(e.temperature.warningAbove <= e.temperature.urgentAbove)) {
    return bad("Temperature: the warning threshold must not be above the urgent threshold.");
  }
  if (!(e.respiratory.urgentLow <= e.respiratory.warningLow && e.respiratory.warningLow <= e.respiratory.warningHigh && e.respiratory.warningHigh <= e.respiratory.urgentHigh)) {
    return bad("Respiratory rate: thresholds must run urgent below ≤ warning below ≤ warning above ≤ urgent above.");
  }
  return { value: out as AlertThresholds, error: null };
}

export { fieldId as thresholdFieldId };
