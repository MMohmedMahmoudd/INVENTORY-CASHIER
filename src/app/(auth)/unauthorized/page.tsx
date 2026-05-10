"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]">
        <Lock className="h-8 w-8" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        You don&apos;t have permission to access this page.
      </p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
        Contact your administrator if you believe this is a mistake.
      </p>

      <Button
        className="mt-8 w-full"
        onClick={() => router.push("/dashboard")}
      >
        Back to Dashboard
      </Button>
    </div>
  );
}
