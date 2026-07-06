import type { Patient, TimelineEvent } from "@/lib/types";

/**
 * Chronological activity feed. The dot colour reflects the event type so
 * urgent/warning events stand out. Optionally shows the patient name when the
 * feed spans multiple patients (ward-wide view).
 */
export function Timeline({
  events,
  patients,
  emptyLabel = "No activity yet.",
}: {
  events: TimelineEvent[];
  patients?: Patient[];
  emptyLabel?: string;
}) {
  if (events.length === 0) {
    return <div className="empty">{emptyLabel}</div>;
  }

  const nameFor = (patientId: string) =>
    patients?.find((p) => p.id === patientId)?.name;

  const dotTone = (type: TimelineEvent["type"]) =>
    type === "urgent" ? "urgent" : type === "warning" ? "warning" : "";

  return (
    <>
      {events.map((e) => {
        const name = nameFor(e.patientId);
        return (
          <div className="feed-item" key={e.id}>
            <span className={`feed-dot ${dotTone(e.type)}`} />
            <div>
              <p>{e.summary}</p>
              <small>
                {name ? `${name} · ` : ""}
                {e.at}
              </small>
            </div>
          </div>
        );
      })}
    </>
  );
}
