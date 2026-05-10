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
          <DialogTitle>{isEdit ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name *</Label>
            <Input id="cat-name" placeholder="e.g. Electronics" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-[hsl(var(--destructive))]">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-description">Description</Label>
            <Textarea id="cat-description" rows={3} placeholder="Optional..." {...register("description")} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create"}
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
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[hsl(var(--foreground))]">{category?.name}</span>?
          Products in this category will be unassigned.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
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

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);

  // ── Fetch categories with product count ──
  const { data: categories = [], isLoading } = useQuery<CategoryWithCount[]>({
    queryKey: ["categories-with-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, created_at, products(count)")
        .order("name");
      if (error) throw error;
      // Supabase returns aggregated count as [{count: n}] on joined tables
      return (data ?? []).map((c) => {
        const raw = c as unknown as Category & { products: { count: number }[] | null };
        return {
          ...raw,
          product_count: raw.products?.[0]?.count ?? 0,
        } as CategoryWithCount;
      });
    },
  });

  // ── Save mutation (create + update) ──
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
      toast.success(editTarget ? "Category updated" : "Category created");
      setFormOpen(false);
      setEditTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save category");
    },
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-count"] });
      toast.success("Category deleted");
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete category");
    },
  });

  const openAdd = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setFormOpen(true);
  };

  // ── Columns ──
  const columns: ColumnDef<CategoryWithCount>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "slug",
      header: "Slug",
      cell: ({ getValue }) => (
        <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">
          {getValue() as string}
        </code>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ getValue }) => (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {(getValue() as string | null) ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "product_count",
      header: "Products",
      cell: ({ getValue }) => (
        <Badge variant="secondary">{getValue() as number}</Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
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
        title="Categories"
        description="Organise your products into categories."
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={categories}
        searchKey="name"
        searchPlaceholder="Search categories..."
        loading={isLoading}
        emptyMessage="No categories yet. Create one to get started."
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
