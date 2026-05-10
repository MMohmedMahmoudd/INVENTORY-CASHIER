"use client";

import React, { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useUIStore } from "@/store/ui-store";
import { NAV_ITEMS } from "@/lib/constants";

// ─── Icon map ─────────────────────────────────────────────────────────────────

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

// ─── Flatten nav items into a searchable list ─────────────────────────────────

interface NavEntry {
  title: string;
  href: string;
  icon: string;
  group: string;
}

function flattenNavItems(): NavEntry[] {
  const entries: NavEntry[] = [];

  for (const item of NAV_ITEMS) {
    if ("href" in item && item.href) {
      entries.push({
        title: item.title,
        href: item.href,
        icon: item.icon,
        group: "Navigation",
      });
    } else if ("children" in item && item.children) {
      for (const child of item.children) {
        entries.push({
          title: child.title,
          href: child.href,
          icon: child.icon,
          group: item.title,
        });
      }
    }
  }

  return entries;
}

const NAV_ENTRIES = flattenNavItems();

// ─── Group entries by their group name ───────────────────────────────────────

function groupEntries(entries: NavEntry[]): Map<string, NavEntry[]> {
  const map = new Map<string, NavEntry[]>();
  for (const entry of entries) {
    if (!map.has(entry.group)) map.set(entry.group, []);
    map.get(entry.group)!.push(entry);
  }
  return map;
}

const GROUPED_ENTRIES = groupEntries(NAV_ENTRIES);

// ─── Recent actions (static for now, could be persisted) ─────────────────────

const RECENT_ACTIONS = [
  { title: "POS / Cashier", href: "/pos", icon: "Monitor", shortcut: "P" },
  { title: "Products", href: "/products", icon: "ShoppingBag", shortcut: "R" },
  { title: "Sales History", href: "/sales", icon: "Receipt", shortcut: "S" },
];

// ─── Command Palette ──────────────────────────────────────────────────────────

export function CommandPalette() {
  const commandOpen = useUIStore((s) => s.commandOpen);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const router = useRouter();

  // Register Cmd+K / Ctrl+K shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    },
    [commandOpen, setCommandOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const navigate = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search pages, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent actions */}
        <CommandGroup heading="Recent">
          {RECENT_ACTIONS.map((action) => (
            <CommandItem
              key={action.href}
              value={action.title}
              onSelect={() => navigate(action.href)}
            >
              <NavIcon name={action.icon} className="mr-2 h-4 w-4 shrink-0" />
              {action.title}
              {action.shortcut && (
                <CommandShortcut>⌘{action.shortcut}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation groups */}
        {Array.from(GROUPED_ENTRIES.entries()).map(([group, entries]) => (
          <CommandGroup key={group} heading={group}>
            {entries.map((entry) => (
              <CommandItem
                key={entry.href}
                value={`${entry.title} ${group}`}
                onSelect={() => navigate(entry.href)}
              >
                <NavIcon name={entry.icon} className="mr-2 h-4 w-4 shrink-0" />
                {entry.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
