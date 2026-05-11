"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PERMISSIONS } from "@/lib/constants";
import type { Role, Permission } from "@/types";

// ─── Permission category grouping ────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  view_products: "Products",
  create_products: "Products",
  edit_products: "Products",
  delete_products: "Products",
  view_sales: "Sales",
  create_sales: "Sales",
  edit_sales: "Sales",
  delete_sales: "Sales",
  view_purchases: "Purchasing",
  create_purchases: "Purchasing",
  manage_inventory: "Inventory",
  manage_suppliers: "Inventory",
  manage_customers: "Sales",
  manage_categories: "Products",
  view_reports: "Reports",
  export_reports: "Reports",
  manage_users: "Administration",
  manage_roles: "Administration",
  manage_settings: "Settings",
  scan_qr_codes: "QR & Scanning",
  view_activity_logs: "Reports",
};

const CATEGORY_ORDER = [
  "Products",
  "Sales",
  "Purchasing",
  "Inventory",
  "Reports",
  "Administration",
  "Settings",
  "QR & Scanning",
];

function groupPermissions(permissions: Permission[]): Map<string, Permission[]> {
  const map = new Map<string, Permission[]>();
  CATEGORY_ORDER.forEach((cat) => map.set(cat, []));

  permissions.forEach((p) => {
    const cat = CATEGORY_MAP[p.key] ?? "Other";
    const arr = map.get(cat) ?? [];
    arr.push(p);
    map.set(cat, arr);
  });

  for (const [key, val] of map) {
    if (val.length === 0) map.delete(key);
  }
  return map;
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({
  role,
  count,
  total,
}: {
  role: Role;
  count: number;
  total: number;
}) {
  const t = useT();
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-blue-500" />
        <span className="font-semibold capitalize text-[hsl(var(--foreground))]">
          {role.name}
        </span>
      </div>
      <div className="text-2xl font-bold text-[hsl(var(--foreground))]">{count}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        {t.permissions.ofPermissions} {total} {t.permissions.permissionsText} ({pct}%)
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const t = useT();

  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());

  if (!hasPermission(PERMISSIONS.MANAGE_ROLES)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          {t.permissions.unauthorized}
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {t.permissions.noPermission}
        </p>
      </div>
    );
  }

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery<Permission[]>({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rolePermissions = [], isLoading: matrixLoading } = useQuery<
    { role_id: string; permission_id: string }[]
  >({
    queryKey: ["role-permissions-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role_id, permission_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const grantedSet = new Set(
    rolePermissions.map((rp) => `${rp.role_id}:${rp.permission_id}`)
  );

  const isGranted = useCallback(
    (roleId: string, permId: string): boolean => {
      const key = `${roleId}:${permId}`;
      if (optimistic.has(key)) return optimistic.get(key)!;
      return grantedSet.has(key);
    },
    [grantedSet, optimistic]
  );

  const toggleMutation = useMutation({
    mutationFn: async ({
      roleId,
      permId,
      grant,
    }: {
      roleId: string;
      permId: string;
      grant: boolean;
    }) => {
      if (grant) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role_id: roleId, permission_id: permId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_id", permId);
        if (error) throw error;
      }
    },
    onSuccess: (_, { roleId, permId }) => {
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(`${roleId}:${permId}`);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["role-permissions-matrix"] });
    },
    onError: (err, { roleId, permId }) => {
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(`${roleId}:${permId}`);
        return next;
      });
      toast.error(err instanceof Error ? err.message : t.permissions.toggleError);
    },
  });

  const handleToggle = (roleId: string, permId: string) => {
    const current = isGranted(roleId, permId);
    const newValue = !current;
    setOptimistic((prev) => new Map(prev).set(`${roleId}:${permId}`, newValue));
    toggleMutation.mutate({ roleId, permId, grant: newValue });
  };

  const isLoading = rolesLoading || permsLoading || matrixLoading;

  const grouped = groupPermissions(permissions);

  const roleCounts = roles.map((role) => ({
    role,
    count: permissions.filter((p) => isGranted(role.id, p.id)).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
          <Lock className="h-6 w-6 text-blue-500" />
          {t.permissions.title}
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t.permissions.description}
        </p>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roleCounts.map(({ role, count }) => (
            <SummaryCard
              key={role.id}
              role={role}
              count={count}
              total={permissions.length}
            />
          ))}
        </div>
      )}

      {/* Matrix table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="min-w-[640px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
            {/* Table header */}
            <div
              className="grid border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/40] px-4 py-3"
              style={{
                gridTemplateColumns: `1fr repeat(${roles.length}, minmax(100px, 1fr))`,
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {t.permissions.permissionColumn}
              </div>
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="text-center text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] capitalize"
                >
                  {role.name}
                </div>
              ))}
            </div>

            {/* Grouped rows */}
            {Array.from(grouped.entries()).map(([category, perms]) => (
              <div key={category}>
                <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/20] px-4 py-2">
                  <Badge variant="secondary" className="text-xs">
                    {category}
                  </Badge>
                </div>

                {perms.map((perm, idx) => (
                  <div
                    key={perm.id}
                    className={`grid items-center px-4 py-3 transition-colors hover:bg-[hsl(var(--muted))/30] ${
                      idx < perms.length - 1
                        ? "border-b border-[hsl(var(--border))]"
                        : ""
                    }`}
                    style={{
                      gridTemplateColumns: `1fr repeat(${roles.length}, minmax(100px, 1fr))`,
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium font-mono text-[hsl(var(--foreground))]">
                        {perm.key}
                      </p>
                      {perm.description && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {perm.description}
                        </p>
                      )}
                    </div>

                    {roles.map((role) => {
                      const granted = isGranted(role.id, perm.id);
                      const isAdmin = role.name.toLowerCase() === "admin";
                      return (
                        <div key={role.id} className="flex justify-center">
                          <Switch
                            checked={isAdmin ? true : granted}
                            disabled={isAdmin || toggleMutation.isPending}
                            onCheckedChange={() =>
                              handleToggle(role.id, perm.id)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {!isLoading && permissions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] py-20 text-center">
          <Lock className="mb-3 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            {t.permissions.noPermissions}
          </p>
        </div>
      )}
    </div>
  );
}
