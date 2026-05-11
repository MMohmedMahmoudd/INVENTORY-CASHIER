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
import type { Customer } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

// ─── Customer Form Dialog ─────────────────────────────────────────────────────

function CustomerDialog({
  open,
  onClose,
  customer,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSave: (values: CustomerFormValues) => void;
  isSaving: boolean;
}) {
  const isEdit = !!customer;
  const t = useT();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "", email: "" },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
        email: customer?.email ?? "",
      });
    }
  }, [open, customer, reset]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t.customers.dialog.editTitle : t.customers.dialog.addTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cust-name">{t.customers.dialog.nameLabel}</Label>
            <Input id="cust-name" placeholder={t.customers.dialog.namePlaceholder} {...register("name")} />
            {errors.name && (
              <p className="text-xs text-[hsl(var(--destructive))]">{errors.name.message}</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">{t.common.phone}</Label>
              <Input id="cust-phone" type="tel" placeholder={t.customers.dialog.phonePlaceholder} {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">{t.common.email}</Label>
              <Input id="cust-email" type="email" placeholder={t.customers.dialog.emailPlaceholder} {...register("email")} />
              {errors.email && (
                <p className="text-xs text-[hsl(var(--destructive))]">{errors.email.message}</p>
              )}
            </div>
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
  customer,
  open,
  onClose,
  onConfirm,
  isDeleting,
}: {
  customer: Customer | null;
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
          <DialogTitle>{t.customers.deleteTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t.customers.deleteMessage}{" "}
          <span className="font-semibold text-[hsl(var(--foreground))]">{customer?.name}</span>?{" "}
          {t.customers.deleteWarning}
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

export default function CustomersPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const t = useT();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ values, id }: { values: CustomerFormValues; id?: string }) => {
      const payload = {
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
      };
      if (id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editTarget ? t.customers.toast.updated : t.customers.toast.created);
      setFormOpen(false);
      setEditTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t.customers.toast.saveError);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(t.customers.toast.deleted);
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t.customers.toast.deleteError);
    },
  });

  const openAdd = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (c: Customer) => { setEditTarget(c); setFormOpen(true); };

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "name",
      header: t.customers.columns.name,
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: t.customers.columns.phone,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? (
          <a href={`tel:${v}`} className="text-sm hover:underline">
            {v}
          </a>
        ) : (
          <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
        );
      },
    },
    {
      accessorKey: "email",
      header: t.customers.columns.email,
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
      accessorKey: "created_at",
      header: t.customers.columns.joined,
      cell: ({ getValue }) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {formatDate(getValue() as string)}
        </span>
      ),
    },
    {
      id: "actions",
      header: t.customers.columns.actions,
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
        title={t.customers.title}
        description={t.customers.description}
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t.customers.addCustomer}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={customers}
        searchKey="name"
        searchPlaceholder={t.customers.searchPlaceholder}
        loading={isLoading}
        emptyMessage={t.customers.emptyMessage}
      />

      <CustomerDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        customer={editTarget}
        onSave={(values) => saveMutation.mutate({ values, id: editTarget?.id })}
        isSaving={saveMutation.isPending}
      />

      <DeleteDialog
        customer={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
