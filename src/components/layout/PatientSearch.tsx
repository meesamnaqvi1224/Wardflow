"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { assignedPatients, bySeverity } from "@/lib/domain";
import type { Patient } from "@/lib/types";

function matchesQuery(patient: Patient, q: string): boolean {
  const hay = `${patient.name} ${patient.room} ${patient.diagnosis} ${patient.allergy}`.toLowerCase();
  return hay.includes(q);
}

/**
 * Top-bar patient search: name, room, or diagnosis → patient detail.
 */
export function PatientSearch() {
  const { staff, data } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const pool = useMemo(() => {
    const base =
      staff.role === "admin"
        ? data.patients
        : assignedPatients(data.patients, staff);
    return bySeverity(base);
  }, [data.patients, staff]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return pool.filter((p) => matchesQuery(p, q)).slice(0, 8);
  }, [pool, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(patientId: string) {
    setOpen(false);
    setQuery("");
    router.push(`/patients/${patientId}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter") && results.length) {
      setOpen(true);
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[active] ?? results[0];
      if (pick) go(pick.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length > 0;

  return (
    <div className="patient-search" ref={rootRef}>
      <input
        className="search"
        type="search"
        placeholder="Search patients by name, room, or diagnosis..."
        aria-label="Search patients"
        aria-expanded={showPanel}
        aria-controls="patient-search-results"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showPanel ? (
        <div
          id="patient-search-results"
          className="patient-search-results"
          role="listbox"
        >
          {results.length ? (
            results.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`patient-search-item ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(p.id)}
              >
                <strong>{p.name}</strong>
                <span className="muted">
                  Room {p.room} · {p.diagnosis}
                </span>
              </button>
            ))
          ) : (
            <div className="patient-search-empty muted">No matching patients</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
