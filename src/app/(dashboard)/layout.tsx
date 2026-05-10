"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { useUIStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// ─── Sidebar widths ───────────────────────────────────────────────────────────

const SIDEBAR_EXPANDED = 256; // px
const SIDEBAR_COLLAPSED = 72;  // px

// ─── Dashboard layout ─────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleCollapsed = useUIStore((s) => s.toggleCollapsed);

  // Auth guard — the middleware handles the redirect server-side, but this
  // covers the client-side case (e.g. after a store clear).
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // Render nothing while auth is resolving to avoid flash
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden shrink-0 overflow-hidden lg:block"
        style={{ width: sidebarWidth }}
      >
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleCollapsed} />
      </motion.aside>

      {/* ── Mobile sidebar (Sheet/Drawer) ── */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            collapsed={false}
            onToggle={() => setSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key="page-content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="h-full"
            >
              <div className="mx-auto max-w-screen-2xl p-4 sm:p-6">
                {children}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Command palette ── */}
      <CommandPalette />
    </div>
  );
}
