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

  // Badge only for work that still needs attention — never render a red "0".
  const openTasks = data.tasks.filter((t) => t.status === "open").length;
  const activeAlerts = data.alerts.filter((a) => a.status === "active").length;

  const workspace: NavItem[] = [
    { href: "/", label: "Ward dashboard" },
    { href: "/patients", label: "My patients" },
    {
      href: "/tasks",
      label: "Tasks",
      count: openTasks > 0 ? openTasks : undefined,
    },
    {
      href: "/alerts",
      label: "Alerts",
      count: activeAlerts > 0 ? activeAlerts : undefined,
    },
    { href: "/medications", label: "Medications" },
    { href: "/profile", label: "My profile" },
    { href: "/settings", label: "Settings" },
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
      {typeof count === "number" && count > 0 ? (
        <span className="nav-count" aria-label={`${count} pending`}>
          {count}
        </span>
      ) : null}
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
      <Link href="/profile" className="sidebar-foot sidebar-foot-link" onClick={onNavigate}>
        <small>Medical Ward A · Day Shift</small>
        <strong>{staff.name}</strong>
        <span className="sidebar-foot-action">View profile</span>
      </Link>
    </aside>
  );
}
