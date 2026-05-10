import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary action element (button/link) placed on the right */
  action?: React.ReactNode;
  /** Alias for action — supports legacy children-based usage */
  children?: React.ReactNode;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PageHeader({ title, description, action, children, className }: PageHeaderProps) {
  const rightSlot = action ?? children;
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}
      </div>
      {rightSlot && (
        <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
