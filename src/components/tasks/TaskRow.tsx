import type { PatientStatus, Task } from "@/lib/types";
import { Badge } from "@/components/Badge";

/** Map task priority to a badge tone: urgent → red, important → amber, routine → grey. */
function priorityTone(priority: Task["priority"]): PatientStatus | "neutral" {
  if (priority === "urgent") return "urgent";
  if (priority === "important") return "warning";
  return "neutral";
}

export function TaskRow({
  task,
  onComplete,
  busy = false,
}: {
  task: Task;
  onComplete?: (id: string) => void;
  busy?: boolean;
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
          <button
            type="button"
            className="mini-btn"
            disabled={busy}
            onClick={() => onComplete(task.id)}
          >
            {busy ? "Saving…" : "Mark complete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
