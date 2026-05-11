"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, QrCode, Package } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency, getStockStatus } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Product, Category } from "@/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";

// ─── Stock Status Badge ───────────────────────────────────────────────────────

function StockBadge({ quantity, minimum }: { quantity: number; minimum: number }) {
  const t = useT();
  const status = getStockStatus(quantity, minimum);
  const config = {
    good: { label: t.products.filters.inStock, variant: "success" as const },
    low: { label: t.products.filters.lowStock, variant: "warning" as const },
    critical: { label: t.products.filters.critical, variant: "destructive" as const },
    out: { label: t.products.filters.outOfStock, variant: "destructive" as const },
  }[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ─── QR Dialog ───────────────────────────────────────────────────────────────

function QRDialog({ product, open, onClose }: { product: Product | null; open: boolean; onClose: () => void }) {
  const t = useT();
  if (!product) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader>
          <DialogTitle>{t.products.dialogs.qrTitle}</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {product.qr_code ? (
            <Image
              src={product.qr_code}
              alt={`QR code for ${product.name}`}
              width={200}
              height={200}
              className="rounded-lg border border-[hsl(var(--border))]"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
              <QrCode className="h-12 w-12 opacity-30" />
              <span className="sr-only">No QR code yet</span>
            </div>
          )}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">SKU: {product.sku}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  product,
  open,
  onClose,
  onConfirm,
  isDeleting,
}: {
  product: Product | null;
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
          <DialogTitle>{t.products.dialogs.deleteTitle}</DialogTitle>
          <DialogDescription>
            {t.products.dialogs.deleteDescription}{" "}
            <span className="font-semibold text-[hsl(var(--foreground))]">
              {product?.name}
            </span>
            ? {t.products.dialogs.deleteWarning}
          </DialogDescription>
        </DialogHeader>
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

export default function ProductsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const t = useT();

  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [stockFilter, setStockFilter] = React.useState<string>("all");
  const [deleteTarget, setDeleteTarget] = React.useState<Product | null>(null);
  const [qrTarget, setQrTarget] = React.useState<Product | null>(null);

  // ── Fetch categories for filter ──
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Pick<Category, "id" | "name" | "slug">[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Category, "id" | "name" | "slug">[];
    },
  });

  // ── Fetch products ──
  const {
    data: products = [],
    isLoading,
    isError,
  } = useQuery<Product[]>({
    queryKey: ["products", categoryFilter, stockFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          `id, name, slug, sku, barcode, qr_code, category_id, supplier_id,
           image_url, description, cost_price, selling_price,
           stock_quantity, minimum_stock, unit, is_active,
           created_at, updated_at,
           category:categories(id, name, slug, description, created_at),
           supplier:suppliers(id, name, email, phone, address, created_at)`
        )
        .order("created_at", { ascending: false });

      if (categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as Product[];

      if (stockFilter === "all") return rows;
      return rows.filter((p) => getStockStatus(p.stock_quantity, p.minimum_stock) === stockFilter);
    },
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t.products.toast.deleted);
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t.products.toast.deleteError);
    },
  });

  const columns: ColumnDef<Product>[] = [
    {
      id: "image",
      header: t.products.columns.image,
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return p.image_url ? (
          <Image
            src={p.image_url}
            alt={p.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
            <Package className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: t.products.columns.name,
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.original.sku}</p>
        </div>
      ),
    },
    {
      id: "category",
      header: t.products.columns.category,
      accessorFn: (row) => row.category?.name ?? "—",
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue() as string}</span>
      ),
    },
    {
      id: "supplier",
      header: t.products.columns.supplier,
      accessorFn: (row) => row.supplier?.name ?? "—",
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "stock_quantity",
      header: t.products.columns.stock,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium tabular-nums">
            {row.original.stock_quantity} {row.original.unit}
          </span>
          <StockBadge
            quantity={row.original.stock_quantity}
            minimum={row.original.minimum_stock}
          />
        </div>
      ),
    },
    {
      accessorKey: "selling_price",
      header: t.products.columns.price,
      cell: ({ getValue }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: t.products.columns.status,
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="success">{t.common.active}</Badge>
        ) : (
          <Badge variant="secondary">{t.common.inactive}</Badge>
        ),
    },
    {
      id: "actions",
      header: t.products.columns.actions,
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setQrTarget(p)}
              title="View QR Code"
            >
              <QrCode className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Edit">
              <Link href={`/products/${p.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
              onClick={() => setDeleteTarget(p)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <p className="text-[hsl(var(--destructive))]">{t.products.failedToLoad}</p>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })}>
          {t.common.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.products.title}
        description={t.products.description}
        action={
          <Button asChild>
            <Link href="/products/add">
              <Plus className="h-4 w-4" />
              {t.products.addProduct}
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={products}
        searchKey="name"
        searchPlaceholder={t.products.searchPlaceholder}
        loading={isLoading}
        emptyMessage={t.products.emptyMessage}
        toolbar={
          <>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue placeholder={t.products.filters.allCategories} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.products.filters.allCategories}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder={t.products.filters.allStock} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.products.filters.allStock}</SelectItem>
                <SelectItem value="good">{t.products.filters.inStock}</SelectItem>
                <SelectItem value="low">{t.products.filters.lowStock}</SelectItem>
                <SelectItem value="critical">{t.products.filters.critical}</SelectItem>
                <SelectItem value="out">{t.products.filters.outOfStock}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* QR dialog */}
      <QRDialog
        product={qrTarget}
        open={!!qrTarget}
        onClose={() => setQrTarget(null)}
      />

      {/* Delete confirmation */}
      <DeleteDialog
        product={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
