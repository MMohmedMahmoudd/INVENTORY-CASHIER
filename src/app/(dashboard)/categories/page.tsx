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
import { slugify } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Category } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

// ─── Category with count ──────────────────────────────────────────────────────

interface CategoryWithCount extends Category {
  product_count: number;
}

// ─── Category Form Dialog ─────────────────────────────────────────────────────

function CategoryDialog({
  open,
  onClose,
  category,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  onSave: (values: CategoryFormValues) => void;
  isSaving: boolean;
}) {
  const isEdit = !!category;
  const t = useT();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "" },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: category?.name ?? "",
        description: category?.description ?? "",
      });
    }
  }, [open, category, reset]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t.categories.dialog.editTitle : t.categories.dialog.addTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">{t.categories.dialog.nameLabel}</Label>
            <Input id="cat-name" placeholder={t.categories.dialog.namePlaceholder} {...register("name")} />
            {errors.name && (
              <p className="text-xs text-[hsl(var(--destructive))]">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-description">{t.categories.dialog.descriptionLabel}</Label>
            <Textarea id="cat-description" rows={3} placeholder={t.common.optional} {...register("description")} />
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
  category,
  open,
  onClose,
  onConfirm,
  isDeleting,
}: {
  category: Category | null;
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
          <DialogTitle>{t.categories.deleteTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t.categories.deleteMessage}{" "}
          <span className="font-semibold text-[hsl(var(--foreground))]">{category?.name}</span>?{" "}
          {t.categories.deleteWarning}
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

export default function CategoriesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const t = useT();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery<CategoryWithCount[]>({
    queryKey: ["categories-with-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, created_at, products(count)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((c) => {
        const raw = c as unknown as Category & { products: { count: number }[] | null };
        return {
          ...raw,
          product_count: raw.products?.[0]?.count ?? 0,
        } as CategoryWithCount;
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ values, id }: { values: CategoryFormValues; id?: string }) => {
      const payload = {
        name: values.name,
        slug: slugify(values.name),
        description: values.description || null,
      };
      if (id) {
        const { error } = await supabase.from("categories").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      toast.success(editTarget ? t.categories.toast.updated : t.categories.toast.created);
      setFormOpen(false);
      setEditTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t.categories.toast.saveError);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      toast.success(t.categories.toast.deleted);
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t.categories.toast.deleteError);
    },
  });

  const openAdd = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (cat: Category) => { setEditTarget(cat); setFormOpen(true); };

  const columns: ColumnDef<CategoryWithCount>[] = [
    {
      accessorKey: "name",
      header: t.categories.columns.name,
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "slug",
      header: t.categories.columns.slug,
      cell: ({ getValue }) => (
        <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">
          {getValue() as string}
        </code>
      ),
    },
    {
      accessorKey: "description",
      header: t.categories.columns.description,
      cell: ({ getValue }) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {(getValue() as string | null) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "product_count",
      header: t.categories.columns.products,
      cell: ({ getValue }) => (
        <Badge variant="secondary">{getValue() as number}</Badge>
      ),
    },
    {
      id: "actions",
      header: t.categories.columns.actions,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEdit(row.original)}
          >
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
        title={t.categories.title}
        description={t.categories.description}
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t.categories.addCategory}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={categories}
        searchKey="name"
        searchPlaceholder={t.categories.searchPlaceholder}
        loading={isLoading}
        emptyMessage={t.categories.emptyMessage}
      />

      <CategoryDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        category={editTarget}
        onSave={(values) => saveMutation.mutate({ values, id: editTarget?.id })}
        isSaving={saveMutation.isPending}
      />

      <DeleteDialog
        category={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
