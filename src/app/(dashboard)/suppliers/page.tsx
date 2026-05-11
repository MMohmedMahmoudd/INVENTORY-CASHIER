"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Supplier } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";

// ─── Schema ───────────────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

// ─── Supplier Form Dialog ─────────────────────────────────────────────────────

function SupplierDialog({
  open,
  onClose,
  supplier,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onSave: (values: SupplierFormValues) => void;
  isSaving: boolean;
}) {
  const isEdit = !!supplier;
  const t = useT();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", email: "", phone: "", address: "" },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: supplier?.name ?? "",
        email: supplier?.email ?? "",
        phone: supplier?.phone ?? "",
        address: supplier?.address ?? "",
      });
    }
  }, [open, supplier, reset]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t.suppliers.dialog.editTitle : t.suppliers.dialog.addTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sup-name">{t.suppliers.dialog.nameLabel}</Label>
            <Input id="sup-name" placeholder={t.suppliers.dialog.namePlaceholder} {...register("name")} />
            {errors.name && (
              <p className="text-xs text-[hsl(var(--destructive))]">{errors.name.message}</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sup-email">{t.suppliers.dialog.emailLabel}</Label>
              <Input id="sup-email" type="email" placeholder="email@example.com" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-[hsl(var(--destructive))]">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">{t.suppliers.dialog.phoneLabel}</Label>
              <Input id="sup-phone" type="tel" placeholder="+1 555 000 0000" {...register("phone")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-address">{t.suppliers.dialog.addressLabel}</Label>
            <Textarea id="sup-address" rows={2} placeholder={t.suppliers.dialog.addressPlaceholder} {...register("address")} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t.common.saving : isEdit ? t.common.saveChanges : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  supplier,
  open,
  onClose,
  onConfirm,
  isDeleting,
}: {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.suppliers.deleteTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t.suppliers.deleteMessage}{" "}
          <span className="font-semibold text-[hsl(var(--foreground))]">{supplier?.name}</span>?{" "}
          {t.suppliers.deleteWarning}
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? t.common.deleting : t.common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const t = useT();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, email, phone, address, created_at")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ values, id }: { values: SupplierFormValues; id?: string }) => {
      const payload = {
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
      };
      if (id) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editTarget ? t.suppliers.toast.updated : t.suppliers.toast.created);
      setFormOpen(false);
      setEditTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t.suppliers.toast.saveError);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(t.suppliers.toast.deleted);
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t.suppliers.toast.deleteError);
    },
  });

  const openAdd = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (s: Supplier) => { setEditTarget(s); setFormOpen(true); };

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "name",
      header: t.suppliers.columns.name,
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "email",
      header: t.suppliers.columns.email,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? (
          <a href={`mailto:${v}`} className="text-sm text-[hsl(var(--primary))] hover:underline">
            {v}
          </a>
        ) : (
          <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
        );
      },
    },
    {
      accessorKey: "phone",
      header: t.suppliers.columns.phone,
      cell: ({ getValue }) => (
        <span className="text-sm">{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "address",
      header: t.suppliers.columns.address,
      cell: ({ getValue }) => (
        <span className="max-w-[200px] truncate text-sm text-[hsl(var(--muted-foreground))]">
          {(getValue() as string | null) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: t.suppliers.columns.added,
      cell: ({ getValue }) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {formatDate(getValue() as string)}
        </span>
      ),
    },
    {
      id: "actions",
      header: t.suppliers.columns.actions,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
            onClick={() => setDeleteTarget(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.suppliers.title}
        description={t.suppliers.description}
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t.suppliers.addSupplier}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={suppliers}
        searchKey="name"
        searchPlaceholder={t.suppliers.searchPlaceholder}
        loading={isLoading}
        emptyMessage={t.suppliers.emptyMessage}
      />

      <SupplierDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        supplier={editTarget}
        onSave={(values) => saveMutation.mutate({ values, id: editTarget?.id })}
        isSaving={saveMutation.isPending}
      />

      <DeleteDialog
        supplier={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
