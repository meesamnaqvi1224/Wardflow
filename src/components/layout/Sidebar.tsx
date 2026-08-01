"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";

interface NavItem {
  href: string;
  label: string;
  count?: number;
}

/**
 * Primary ward navigation. Administration is admin-only (Phase 4 roles).
 */
export function Sidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { staff, data } = useSession();

  const openTasks = data.tasks.filter((t) => t.status === "open").length;
  const activeAlerts = data.alerts.filter((a) => a.status === "active").length;

  const workspace: NavItem[] = [
    { href: "/", label: "Ward dashboard" },
    { href: "/patients", label: "My patients" },
    { href: "/tasks", label: "Tasks", count: openTasks },
    { href: "/alerts", label: "Alerts", count: activeAlerts },
    { href: "/medications", label: "Medications" },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const renderItem = ({ href, label, count }: NavItem) => (
    <Link
      key={href}
      href={href}
      className={`nav-item ${isActive(href) ? "active" : ""}`}
      onClick={onNavigate}
      aria-current={isActive(href) ? "page" : undefined}
    >
      {label}
      {count !== undefined ? <span className="nav-count">{count}</span> : null}
    </Link>
  );

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        Ward<span>Flow</span>
      </div>
      <div className="nav-label">Workspace</div>
      {workspace.map(renderItem)}
      {staff.role === "admin" ? (
        <>
          <div className="nav-label">Manage</div>
          {renderItem({ href: "/administration", label: "Administration" })}
        </>
      ) : null}
      <div className="sidebar-foot">
        <small>Medical Ward A · Day Shift</small>
        <strong>{staff.name}</strong>
      </div>
    </aside>
  );
}
