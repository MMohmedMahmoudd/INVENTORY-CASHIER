"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Tag,
  Truck,
  Warehouse,
  FileText,
  Monitor,
  Receipt,
  Users,
  PackageOpen,
  PackagePlus,
  QrCode,
  Scan,
  BarChart3,
  PieChart,
  Activity,
  Shield,
  UserCog,
  Key,
  Lock,
  Settings,
  ShoppingCart,
  Box,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { NAV_ITEMS, APP_NAME } from "@/lib/constants";
import { useAuthStore } from "@/store/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ─── Icon map ────────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Tag,
  Truck,
  Warehouse,
  FileText,
  Monitor,
  Receipt,
  Users,
  PackageOpen,
  PackagePlus,
  QrCode,
  Scan,
  BarChart3,
  PieChart,
  Activity,
  Shield,
  UserCog,
  Key,
  Lock,
  Settings,
  ShoppingCart,
};

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] ?? Box;
  return <Icon className={className} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ─── Nav item (leaf) ─────────────────────────────────────────────────────────

interface NavLeafProps {
  title: string;
  href: string;
  icon: string;
  collapsed: boolean;
}

function NavLeaf({ title, href, icon, collapsed }: NavLeafProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-300 hover:bg-slate-800 hover:text-white",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? title : undefined}
    >
      <NavIcon name={icon} className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{title}</span>}
    </Link>
  );
}

// ─── Nav group (collapsible) ─────────────────────────────────────────────────

interface NavChild {
  title: string;
  href: string;
  icon: string;
  permission: string;
}

interface NavGroupProps {
  title: string;
  icon: string;
  children: readonly NavChild[];
  collapsed: boolean;
}

function NavGroup({ title, icon, children, collapsed }: NavGroupProps) {
  const pathname = usePathname();
  const isChildActive = children.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );
  const [open, setOpen] = useState(isChildActive);

  if (collapsed) {
    // In collapsed mode show each child as icon-only with tooltip via title attr
    return (
      <div className="space-y-0.5">
        {children.map((child) => (
          <NavLeaf
            key={child.href}
            title={child.title}
            href={child.href}
            icon={child.icon}
            collapsed
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
          isChildActive
            ? "text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
        )}
      >
        <NavIcon name={icon} className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
          {children.map((child) => (
            <NavLeaf
              key={child.href}
              title={child.title}
              href={child.href}
              icon={child.icon}
              collapsed={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ collapsed, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const displayName = user?.profile?.full_name ?? user?.email ?? "User";
  const roleName = user?.role?.name ?? "Staff";
  const avatarUrl = user?.profile?.avatar_url ?? undefined;
  const initials = getInitials(displayName);

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* ── Logo + toggle ── */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-slate-700/60 px-4",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Box className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">
              {APP_NAME}
            </span>
          </Link>
        )}

        {collapsed && (
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"
          >
            <Box className="h-4 w-4 text-white" />
          </Link>
        )}

        <button
          onClick={onToggle}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white",
            collapsed && "mt-0"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            // Permission check at group level
            if (item.permission && !hasPermission(item.permission)) return null;

            if ("children" in item && item.children) {
              return (
                <NavGroup
                  key={item.title}
                  title={item.title}
                  icon={item.icon}
                  children={item.children}
                  collapsed={collapsed}
                />
              );
            }

            if ("href" in item && item.href) {
              return (
                <NavLeaf
                  key={item.href}
                  title={item.title}
                  href={item.href}
                  icon={item.icon}
                  collapsed={collapsed}
                />
              );
            }

            return null;
          })}
        </div>
      </nav>

      {/* ── User profile ── */}
      <div
        className={cn(
          "shrink-0 border-t border-slate-700/60 p-3",
          collapsed ? "flex justify-center" : "flex items-center gap-3"
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-blue-700 text-xs font-medium text-white">
            {initials}
          </AvatarFallback>
        </Avatar>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="truncate text-xs capitalize text-slate-400">{roleName}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return <SidebarContent collapsed={collapsed} onToggle={onToggle} />;
}
