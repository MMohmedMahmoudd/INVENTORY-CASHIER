"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

// ─── Notification badge ───────────────────────────────────────────────────────

function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <button
      type="button"
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
    </button>
  );
}

// ─── User dropdown ────────────────────────────────────────────────────────────

function UserDropdown() {
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const router = useRouter();
  const supabase = createClient();
  const t = useT();

  const displayName = user?.profile?.full_name ?? user?.email ?? "User";
  const email = user?.email ?? "";
  const roleName = user?.role?.name ?? "Staff";
  const avatarUrl = user?.profile?.avatar_url ?? undefined;
  const initials = getInitials(displayName);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearUser();
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[hsl(var(--accent))]">
          <Avatar className="h-7 w-7">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-blue-600 text-[10px] font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 text-start sm:block">
            <p className="max-w-30 truncate text-sm font-medium leading-none">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs capitalize text-[hsl(var(--muted-foreground))]">
              {roleName}
            </p>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-[hsl(var(--muted-foreground))]">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <User className="me-2 h-4 w-4" />
            {t.header.profile}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="me-2 h-4 w-4" />
            {t.header.settings}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))]"
        >
          <LogOut className="me-2 h-4 w-4" />
          {t.header.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  title?: string;
  notificationCount?: number;
}

export function Header({ title, notificationCount = 0 }: HeaderProps) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleCollapsed = useUIStore((s) => s.toggleCollapsed);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const t = useT();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapsed}
        className="hidden shrink-0 lg:flex"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="shrink-0 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {title && (
        <h1 className="hidden truncate text-lg font-semibold sm:block">{title}</h1>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
            "px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))]",
            "transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
            "hidden sm:flex"
          )}
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5" />
          <span>{t.header.search}</span>
          <kbd className="ms-4 hidden rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium leading-none lg:inline-block">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] sm:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        <NotificationBell count={notificationCount} />
        <ThemeToggle />
        <UserDropdown />
      </div>
    </header>
  );
}
