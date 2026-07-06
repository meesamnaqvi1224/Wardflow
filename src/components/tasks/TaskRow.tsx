import type { PatientStatus, Task } from "@/lib/types";
import { Badge } from "@/components/Badge";

/** Map task priority to a badge tone: urgent → red, important → amber, routine → grey. */
function priorityTone(priority: Task["priority"]): PatientStatus | "neutral" {
  if (priority === "urgent") return "urgent";
  if (priority === "important") return "warning";
  return "neutral";
}

/**
 * A single care task. "Mark complete" is wired via the optional callback in
 * Phase 5; omitted here for the read-only Phase 2 view.
 */
export function TaskRow({
  task,
  onComplete,
}: {
  task: Task;
  onComplete?: (id: string) => void;
}) {
  return (
    <div className="task-row">
      <div className="row-top">
        <div>
          <strong>{task.title}</strong>
          <div className="muted">{task.due}</div>
        </div>
        <Badge tone={priorityTone(task.priority)} label={task.priority} />
      </div>
      {onComplete && task.status !== "completed" ? (
        <div className="row-actions">
          <button className="mini-btn" onClick={() => onComplete(task.id)}>
            Mark complete
          </button>
        </div>
      ) : null}
    </div>
  );
}
