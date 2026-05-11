"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Key,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS } from "@/lib/constants";
import type { Role, Permission } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleWithCounts extends Role {
  permissionCount: number;
  permissions: Permission[];
}

const PROTECTED_ROLES = ["admin", "manager"];

// ─── Role Form Dialog ─────────────────────────────────────────────────────────

function RoleFormDialog({
  role,
  open,
  onClose,
  onSuccess,
}: {
  role?: RoleWithCounts | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createClient();
  const t = useT();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (role) {
        const { error } = await supabase
          .from("roles")
          .update({ name: name.trim(), description: description.trim() || null })
          .eq("id", role.id);
        if (error) throw error;
        toast.success(t.roles.toast.updated);
      } else {
        const { error } = await supabase
          .from("roles")
          .insert({ name: name.trim(), description: description.trim() || null });
        if (error) throw error;
        toast.success(t.roles.toast.created);
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.roles.toast.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {role ? t.roles.formDialog.editTitle : t.roles.formDialog.createTitle}
          </DialogTitle>
          <DialogDescription>
            {role ? t.roles.formDialog.editDesc : t.roles.formDialog.createDesc}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">{t.roles.formDialog.roleName}</Label>
            <Input
              id="role-name"
              placeholder={t.roles.formDialog.roleNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-desc">{t.roles.formDialog.descriptionLabel}</Label>
            <Textarea
              id="role-desc"
              placeholder={t.roles.formDialog.descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? t.roles.formDialog.saving : role ? t.common.saveChanges : t.roles.createRole}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteRoleDialog({
  role,
  onClose,
  onSuccess,
}: {
  role: RoleWithCounts | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createClient();
  const t = useT();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!role) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("roles").delete().eq("id", role.id);
      if (error) throw error;
      toast.success(`"${role.name}" ${t.common.delete}`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.roles.toast.deleteError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!role} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            {t.roles.deleteDialog.title}
          </DialogTitle>
          <DialogDescription>
            {t.roles.deleteDialog.description}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t.roles.deleteDialog.deletingPrefix} <strong>{role?.name}</strong>
          {role && role.permissionCount > 0 && (
            <> ({role.permissionCount} {t.roles.deleteDialog.permissionsWillBeRemoved})</>
          )}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? t.roles.deleteDialog.deleting : t.roles.deleteDialog.deleteRole}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────────────

function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: RoleWithCounts;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const isProtected = PROTECTED_ROLES.includes(role.name.toLowerCase());

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold capitalize text-[hsl(var(--foreground))]">
                {role.name}
              </h3>
              {isProtected && (
                <Badge variant="secondary" className="text-xs">{t.roles.system}</Badge>
              )}
            </div>
            {role.description && (
              <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                {role.description}
              </p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="me-2 h-4 w-4" />
              {t.common.edit}
            </DropdownMenuItem>
            {!isProtected && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={onDelete}
                >
                  <Trash2 className="me-2 h-4 w-4" />
                  {t.common.delete}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Key className="h-3.5 w-3.5" />
        <span>{role.permissionCount} {t.roles.permissionsGranted}</span>
      </div>

      {role.permissions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {role.permissions.slice(0, 6).map((p) => (
            <Badge
              key={p.id}
              variant="secondary"
              className="text-xs font-mono"
            >
              {p.key}
            </Badge>
          ))}
          {role.permissions.length > 6 && (
            <Badge variant="secondary" className="text-xs">
              +{role.permissions.length - 6}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const t = useT();

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleWithCounts | null>(null);
  const [deleteRole, setDeleteRole] = useState<RoleWithCounts | null>(null);

  if (!hasPermission(PERMISSIONS.MANAGE_ROLES)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          {t.roles.unauthorized}
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {t.roles.noPermission}
        </p>
      </div>
    );
  }

  const { data: roles = [], isLoading, refetch } = useQuery<RoleWithCounts[]>({
    queryKey: ["roles-with-perms"],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("*")
        .order("name");
      if (rolesError) throw rolesError;

      const { data: rolePerms, error: rpe } = await supabase
        .from("role_permissions")
        .select("role_id, permission:permissions(*)");
      if (rpe) throw rpe;

      const permMap = new Map<string, Permission[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rolePerms ?? []).forEach((rp: any) => {
        if (!rp.permission) return;
        const arr = permMap.get(rp.role_id) ?? [];
        arr.push(rp.permission);
        permMap.set(rp.role_id, arr);
      });

      return (rolesData ?? []).map((r) => ({
        ...r,
        permissions: permMap.get(r.id) ?? [],
        permissionCount: permMap.get(r.id)?.length ?? 0,
      }));
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
            <Key className="h-6 w-6 text-blue-500" />
            {t.roles.title}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t.roles.description}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t.roles.createRole}
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[hsl(var(--border))] p-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="mt-4 h-3 w-32" />
              <div className="mt-3 flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] py-20 text-center">
          <Key className="mb-3 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">{t.roles.noRolesYet}</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => setCreateOpen(true)}
          >
            {t.roles.createFirstRole}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={() => setEditRole(role)}
              onDelete={() => setDeleteRole(role)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <RoleFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["roles-with-perms"] })}
      />

      <RoleFormDialog
        role={editRole}
        open={!!editRole}
        onClose={() => setEditRole(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["roles-with-perms"] })}
      />

      <DeleteRoleDialog
        role={deleteRole}
        onClose={() => setDeleteRole(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["roles-with-perms"] })}
      />
    </div>
  );
}
