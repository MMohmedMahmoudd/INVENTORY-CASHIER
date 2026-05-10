"use client";

import { useAuthStore } from "@/store/auth-store";

export function usePermission(permission: string): boolean {
  return useAuthStore((s) => s.hasPermission(permission));
}

export function usePermissions(permissions: string[]): boolean {
  return useAuthStore((s) => permissions.every((p) => s.hasPermission(p)));
}

export function useAnyPermission(permissions: string[]): boolean {
  return useAuthStore((s) => permissions.some((p) => s.hasPermission(p)));
}
