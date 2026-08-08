"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { assignedPatients } from "@/lib/domain";
import { TaskRow } from "@/components/tasks/TaskRow";
import { CreateTaskDrawer } from "@/components/tasks/CreateTaskDrawer";

export default function TasksPage() {
  const { staff, data, completeTask, createTask, actionBusy } = useSession();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const canCreate = staff.role === "doctor" || staff.role === "nurse" || staff.role === "admin";
  const canComplete = staff.role === "doctor" || staff.role === "nurse";

  const patients = useMemo(
    () => assignedPatients(data.patients, staff),
    [data.patients, staff],
  );
  const patientName = (id: string) =>
    data.patients.find((p) => p.id === id)?.name ?? id;

  const tasks = useMemo(() => {
    const list =
      filter === "open"
        ? data.tasks.filter((t) => t.status === "open")
        : data.tasks;
    const priorityRank = { urgent: 0, important: 1, routine: 2 } as const;
    return [...list].sort(
      (a, b) => priorityRank[a.priority] - priorityRank[b.priority],
    );
  }, [data.tasks, filter]);

  const openCount = data.tasks.filter((t) => t.status === "open").length;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Ward worklist</p>
          <h1>Tasks</h1>
          <p className="muted">
            {openCount} open task{openCount === 1 ? "" : "s"} across the ward.
          </p>
        </div>
        <div className="actions">
          <div className="filter-pills" role="group" aria-label="Task filter">
            <button
              type="button"
              className={`mini-btn ${filter === "open" ? "active-filter" : ""}`}
              onClick={() => setFilter("open")}
            >
              Open
            </button>
            <button
              type="button"
              className={`mini-btn ${filter === "all" ? "active-filter" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
          </div>
          {canCreate ? (
            <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
              Create task
            </button>
          ) : null}
        </div>
      </div>

      <div className="panel panel-pad">
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.id} className="list-item-block">
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                <Link href={`/patients/${task.patientId}`} className="text-link" style={{ display: "inline" }}>
                  {patientName(task.patientId)}
                </Link>
                {task.status === "completed" ? " · completed" : null}
              </div>
              <TaskRow
                task={task}
                busy={actionBusy}
                onComplete={
                  canComplete && task.status === "open"
                    ? (id) => void completeTask(id)
                    : undefined
                }
              />
            </div>
          ))
        ) : (
          <div className="empty">
            {filter === "open" ? "No open tasks." : "No tasks yet."}
          </div>
        )}
      </div>

      {createOpen ? (
        <CreateTaskDrawer
          patients={patients.length ? patients : data.patients}
          onClose={() => setCreateOpen(false)}
          onSubmit={createTask}
        />
      ) : null}
    </>
  );
}
