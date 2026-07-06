/**
 * Honest placeholder for module pages whose full workflows land in Phase 6.
 * Keeps the navigation complete and reviewable without pretending the feature
 * exists yet.
 */
export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  phase,
}: {
  eyebrow: string;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
      </div>
      <div className="panel panel-pad">
        <div className="clinical-callout">
          This module gets its dedicated ward-wide view and live actions in {phase}. The underlying
          data model and reusable rows are already in place.
        </div>
      </div>
    </>
  );
}
