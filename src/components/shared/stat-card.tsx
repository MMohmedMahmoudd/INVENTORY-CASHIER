"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  /** Percentage change (e.g. 12.5 for +12.5%) */
  change?: number;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

// ─── Animated number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: string | number }) {
  const [displayed, setDisplayed] = React.useState<string | number>(
    typeof value === "number" ? 0 : value
  );

  React.useEffect(() => {
    if (typeof value !== "number") {
      setDisplayed(value);
      return;
    }
    const target = value;
    const duration = 700;
    const steps = 40;
    const stepTime = duration / steps;
    let current = 0;
    const increment = target / steps;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplayed(target);
        clearInterval(timer);
      } else {
        setDisplayed(Math.floor(current));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayed}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatCard({ title, value, change, icon, trend = "neutral", className }: StatCardProps) {
  const trendConfig = {
    up: {
      Icon: TrendingUp,
      textClass: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      prefix: "+",
    },
    down: {
      Icon: TrendingDown,
      textClass: "text-red-500 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
      prefix: "",
    },
    neutral: {
      Icon: Minus,
      textClass: "text-[hsl(var(--muted-foreground))]",
      bg: "bg-[hsl(var(--muted))]",
      prefix: "",
    },
  }[trend];

  return (
    <Card className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</p>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      </div>

      <div>
        <p className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
          <AnimatedNumber value={value} />
        </p>
        {change !== undefined && (
          <div className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", trendConfig.bg, trendConfig.textClass)}>
            <trendConfig.Icon className="h-3 w-3" />
            <span>
              {trendConfig.prefix}{Math.abs(change).toFixed(1)}% vs last period
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
