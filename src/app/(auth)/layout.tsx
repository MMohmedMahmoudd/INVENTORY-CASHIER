import React from "react";
import { Box } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, hsl(221 83% 53% / 0.08) 0%, hsl(0 0% 100% / 0) 50%, hsl(280 65% 60% / 0.06) 100%)",
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
          <Box className="h-6 w-6 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          Enterprise Inventory &amp; POS Management
        </span>
      </div>

      {/* Card wrapper */}
      <div className="w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl shadow-black/5 sm:p-8">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-[hsl(var(--muted-foreground))]">
        &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </p>
    </div>
  );
}
