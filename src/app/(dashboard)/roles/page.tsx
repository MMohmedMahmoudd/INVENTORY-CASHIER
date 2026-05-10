"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
        toast.success("Role updated");
      } else {
        const { error } = await supabase
          .from("roles")
          .insert({ name: name.trim(), description: description.trim() || null });
        if (error) throw error;
        toast.success("Role created");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
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
            {role ? "Edit Role" : "Create Role"}
          </DialogTitle>
          <DialogDescription>
            {role
              ? "Update the role's name and description."
              : "Create a new role that can be assigned to users."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Role Name *</Label>
            <Input
              id="role-name"
              placeholder="e.g. Cashier, Warehouse Manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Description</Label>
            <Textarea
              id="role-desc"
              placeholder="What does this role do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : role ? "Save Changes" : "Create Role"}
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
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!role) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("roles").delete().eq("id", role.id);
      if (error) throw error;
      toast.success(`Role "${role.name}" deleted`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
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
            Delete Role
          </DialogTitle>
          <DialogDescription>
            This will permanently delete the role. Users assigned to this role
            will lose their role assignment.
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Deleting: <strong>{role?.name}</strong>
          {role && role.permissionCount > 0 && (
            <> ({role.permissionCount} permissions will be removed)</>
          )}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Delete Role"}
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
                <Badge variant="secondary" className="text-xs">System</Badge>
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
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {!isProtected && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Permission count */}
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Key className="h-3.5 w-3.5" />
        <span>{role.permissionCount} permissions granted</span>
      </div>

      {/* Permission badges */}
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
              +{role.permissions.length - 6} more
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

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleWithCounts | null>(null);
  const [deleteRole, setDeleteRole] = useState<RoleWithCounts | null>(null);

  if (!hasPermission(PERMISSIONS.MANAGE_ROLES)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          Unauthorized
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          You don&apos;t have permission to manage roles.
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
            Roles
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Define access roles that can be assigned to users
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
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
          <p className="text-[hsl(var(--muted-foreground))]">No roles yet</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => setCreateOpen(true)}
          >
            Create your first role
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
