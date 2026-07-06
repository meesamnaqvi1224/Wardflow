import type { PatientStatus } from "@/lib/types";

type BadgeTone = PatientStatus | "neutral";

/**
 * Status pill used across patient lists, banners, and rows. `urgent` gets an
 * exclamation glyph; everything else a neutral dot — matching the v1 language.
 */
export function Badge({
  tone,
  label,
}: {
  tone: BadgeTone;
  label?: string;
}) {
  const text = (label ?? tone).replace(/_/g, " ");
  return (
    <span className={`badge ${tone}`}>
      {tone === "urgent" ? "!" : "•"} {text}
    </span>
  );
}
