"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Shield,
  ShieldOff,
  Trash2,
  MoreHorizontal,
  Mail,
  AlertCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/lib/i18n";
import {
  inviteUser,
  updateUserRole,
  setUserActive,
  deleteUser,
} from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, getInitials } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/constants";
import type { Role } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  auth_user_id: string;
  full_name: string;
  avatar_url: string | null;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  email: string;
  last_sign_in_at: string | null;
  role?: Role;
}

// ─── Invite Dialog ────────────────────────────────────────────────────────────

function InviteDialog({
  open,
  onClose,
  roles,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  roles: Role[];
  onSuccess: () => void;
}) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !roleId) return;
    setLoading(true);
    try {
      await inviteUser(email, roleId, fullName);
      toast.success(`${t.users.toast.invited} ${email}`);
      setEmail("");
      setFullName("");
      setRoleId("");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.users.toast.inviteError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t.users.inviteDialog.title}
          </DialogTitle>
          <DialogDescription>
            {t.users.inviteDialog.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">{t.users.inviteDialog.fullName}</Label>
            <Input
              id="invite-name"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">{t.users.inviteDialog.emailLabel}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">{t.users.inviteDialog.roleLabel}</Label>
            <Select value={roleId} onValueChange={setRoleId} required>
              <SelectTrigger id="invite-role">
                <SelectValue placeholder={t.users.inviteDialog.rolePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={loading || !email || !roleId}>
              {loading ? t.users.inviteDialog.sending : t.users.inviteDialog.sendInvitation}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Role Dialog ─────────────────────────────────────────────────────────

function EditRoleDialog({
  user,
  roles,
  onClose,
  onSuccess,
}: {
  user: UserRow | null;
  roles: Role[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const [roleId, setRoleId] = useState(user?.role_id ?? "");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setRoleId(user?.role_id ?? "");
  }, [user]);

  const handleSave = async () => {
    if (!user || !roleId) return;
    setLoading(true);
    try {
      await updateUserRole(user.auth_user_id, roleId);
      toast.success(t.users.toast.roleUpdated);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.users.toast.roleError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.users.editRoleDialog.title}</DialogTitle>
          <DialogDescription>
            {t.users.editRoleDialog.descriptionPrefix}{" "}
            <span className="font-medium">{user?.full_name || user?.email}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>{t.users.editRoleDialog.roleLabel}</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger>
              <SelectValue placeholder={t.users.editRoleDialog.rolePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={loading || !roleId}>
            {loading ? t.users.editRoleDialog.saving : t.common.saveChanges}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteDialog({
  user,
  onClose,
  onSuccess,
}: {
  user: UserRow | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await deleteUser(user.auth_user_id);
      toast.success(t.users.toast.deleted);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.users.toast.deleteError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            {t.users.deleteDialog.title}
          </DialogTitle>
          <DialogDescription>
            {t.users.deleteDialog.description}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t.users.deleteDialog.deletingPrefix} <strong>{user?.full_name || user?.email}</strong>
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? t.users.deleteDialog.deleting : t.users.deleteUser}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const t = useT();

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  if (!hasPermission(PERMISSIONS.MANAGE_USERS)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          {t.users.unauthorized}
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {t.users.noPermission}
        </p>
      </div>
    );
  }

  // Fetch roles
  const { data: roles = [] } = useQuery<Role[]>({
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

  // Fetch users via server action
  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { listUsers } = await import("@/app/actions/users");
      return await listUsers();
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({
      authUserId,
      isActive,
    }: {
      authUserId: string;
      isActive: boolean;
    }) => {
      await setUserActive(authUserId, isActive);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(t.users.toast.statusUpdated);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t.users.toast.statusError);
    },
  });

  const filtered = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
            <Users className="h-6 w-6 text-blue-500" />
            {t.users.title}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t.users.description}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="me-2 h-4 w-4" />
          {t.users.inviteUser}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder={t.users.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.users.columns.user}</TableHead>
              <TableHead>{t.users.columns.role}</TableHead>
              <TableHead>{t.users.columns.status}</TableHead>
              <TableHead>{t.users.columns.lastActive}</TableHead>
              <TableHead>{t.users.columns.joined}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-[hsl(var(--muted-foreground))]"
                >
                  {search ? t.users.noMatch : t.users.noUsersFound}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatar_url ?? ""} />
                        <AvatarFallback>
                          {getInitials(user.full_name || user.email || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-[hsl(var(--foreground))]">
                          {user.full_name || "—"}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {user.role ? (
                      <Badge variant="secondary">{user.role.name}</Badge>
                    ) : (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">{t.users.noRole}</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={user.is_active ? "default" : "secondary"}
                      className={
                        user.is_active
                          ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                      }
                    >
                      {user.is_active ? t.common.active : t.common.inactive}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                    {user.last_sign_in_at
                      ? formatDate(user.last_sign_in_at)
                      : t.users.never}
                  </TableCell>

                  <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                    {formatDate(user.created_at)}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditUser(user)}>
                          {t.users.editRole}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toggleActive.mutate({
                              authUserId: user.auth_user_id,
                              isActive: !user.is_active,
                            })
                          }
                        >
                          {user.is_active ? (
                            <>
                              <ShieldOff className="me-2 h-4 w-4" />
                              {t.users.deactivate}
                            </>
                          ) : (
                            <>
                              <Shield className="me-2 h-4 w-4" />
                              {t.users.activate}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 className="me-2 h-4 w-4" />
                          {t.common.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roles={roles}
        onSuccess={() => refetch()}
      />

      <EditRoleDialog
        user={editUser}
        roles={roles}
        onClose={() => setEditUser(null)}
        onSuccess={() => refetch()}
      />

      <DeleteDialog
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
