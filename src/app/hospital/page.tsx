"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import {
  THRESHOLD_GROUPS,
  defaultFor,
  formToThresholds,
  thresholdFieldId,
  thresholdsToForm,
  type ThresholdForm,
} from "@/lib/thresholds";

function timezoneOptions(current: string): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const list = intl.supportedValuesOf?.("timeZone") ?? [];
  const set = new Set<string>(["UTC", ...list]);
  if (current) set.add(current);
  return [...set].sort();
}

/**
 * Hospital settings for admins: name, timezone, alert thresholds and wards.
 * Everything saves through database functions that re-check the admin role.
 */
export default function HospitalSettingsPage() {
  const { staff, hospital, wards, actionBusy, updateHospital, createWard, renameWard } =
    useSession();
  const router = useRouter();
  const allowed = staff.role === "admin";

  const [name, setName] = useState(hospital?.name ?? "");
  const [timezone, setTimezone] = useState(hospital?.settings.timezone ?? "UTC");
  const [thresholds, setThresholds] = useState<ThresholdForm>(() =>
    thresholdsToForm(hospital?.settings.alertThresholds),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [newWard, setNewWard] = useState("");
  const [wardError, setWardError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  // Re-seed the form when the server copy changes (after a save or refresh).
  useEffect(() => {
    if (!hospital) return;
    setName(hospital.name);
    setTimezone(hospital.settings.timezone ?? "UTC");
    setThresholds(thresholdsToForm(hospital.settings.alertThresholds));
  }, [hospital]);

  const zones = useMemo(() => timezoneOptions(timezone), [timezone]);

  if (!allowed || !hospital) {
    return <div className="clinical-callout">Hospital settings are restricted to admins.</div>;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (name.trim().length < 2) {
      setError("Hospital name must be at least 2 characters.");
      return;
    }
    const parsed = formToThresholds(thresholds);
    if (parsed.error !== null) {
      setError(parsed.error);
      return;
    }
    const result = await updateHospital({
      name: name.trim(),
      settings: { timezone, alertThresholds: parsed.value },
    });
    if (result.error) setError(result.error);
    else setSaved(true);
  }

  async function handleAddWard(e: FormEvent) {
    e.preventDefault();
    setWardError(null);
    const result = await createWard(newWard.trim());
    if (result.error) setWardError(result.error);
    else setNewWard("");
  }

  async function handleRename() {
    if (!editing) return;
    setWardError(null);
    const result = await renameWard(editing.id, editing.name.trim());
    if (result.error) setWardError(result.error);
    else setEditing(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Manage</p>
          <h1>Hospital settings</h1>
          <p className="muted">
            Name, time zone and the vital-sign limits that raise alerts for {hospital.name}.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)}>
        <div className="panel panel-pad">
          <h2>Hospital</h2>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="hospital-name">Hospital name</label>
              <input
                id="hospital-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="hospital-tz">Time zone</label>
              <select
                id="hospital-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="panel panel-pad" style={{ marginTop: 18 }}>
          <h2>Alert thresholds</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            A reading beyond a <strong>warning</strong> limit raises a warning alert; beyond an{" "}
            <strong>urgent</strong> limit, an urgent one. Leave a box empty to use the standard
            value shown in grey.
          </p>
          {THRESHOLD_GROUPS.map((g) => (
            <div key={g.group} style={{ marginBottom: 14 }}>
              <h3 style={{ marginBottom: 6 }}>
                {g.title} <span className="muted">({g.unit})</span>
              </h3>
              <div className="form-grid">
                {g.fields.map((f) => {
                  const id = thresholdFieldId(g.group, f.key);
                  return (
                    <div className="field" key={id}>
                      <label htmlFor={`th-${id}`}>{f.label}</label>
                      <input
                        id={`th-${id}`}
                        inputMode="decimal"
                        value={thresholds[id] ?? ""}
                        placeholder={String(defaultFor(g.group, f.key))}
                        onChange={(e) =>
                          setThresholds((t) => ({ ...t, [id]: e.target.value }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="mini-btn"
            onClick={() => setThresholds(thresholdsToForm(undefined))}
          >
            Reset all to standard values
          </button>
        </div>

        {error ? (
          <div className="login-error" role="alert" style={{ marginTop: 14 }}>
            {error}
          </div>
        ) : null}
        {saved && !error ? (
          <div className="clinical-callout" style={{ marginTop: 14 }}>
            Settings saved. New vitals readings use these limits straight away.
          </div>
        ) : null}
        <div className="drawer-actions" style={{ borderTop: "none", paddingTop: 12 }}>
          <button type="submit" className="btn primary" disabled={actionBusy}>
            {actionBusy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <section className="section">
        <div className="section-head">
          <h2>Wards</h2>
          <span className="muted">{wards.length} total</span>
        </div>
        <div className="panel panel-pad">
          {wards.map((w) => (
            <div key={w.id} className="list-item-block">
              {editing?.id === w.id ? (
                <div className="actions">
                  <input
                    aria-label={`Rename ${w.name}`}
                    value={editing.name}
                    maxLength={80}
                    onChange={(e) => setEditing({ id: w.id, name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={actionBusy || !editing.name.trim()}
                    onClick={() => void handleRename()}
                  >
                    Save
                  </button>
                  <button type="button" className="mini-btn" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="row-top">
                  <strong>{w.name}</strong>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setEditing({ id: w.id, name: w.name })}
                  >
                    Rename
                  </button>
                </div>
              )}
            </div>
          ))}
          {wardError ? (
            <div className="login-error" role="alert" style={{ marginTop: 10 }}>
              {wardError}
            </div>
          ) : null}
          <form className="actions" style={{ marginTop: 14 }} onSubmit={(e) => void handleAddWard(e)}>
            <input
              aria-label="New ward name"
              placeholder="New ward name"
              value={newWard}
              maxLength={80}
              onChange={(e) => setNewWard(e.target.value)}
            />
            <button
              type="submit"
              className="btn"
              disabled={actionBusy || !newWard.trim()}
            >
              Add ward
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
