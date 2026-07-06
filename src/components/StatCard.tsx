/** A single dashboard metric: label, big value, and a supporting note. */
export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <small className="muted">{note}</small>
    </div>
  );
}
