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

const stockStatusConfig = {
  good: { label: "In Stock", variant: "success" as const },
  low: { label: "Low Stock", variant: "warning" as const },
  critical: { label: "Critical", variant: "destructive" as const },
  out: { label: "Out of Stock", variant: "destructive" as const },
} as const;

function StockBadge({ quantity, minimum }: { quantity: number; minimum: number }) {
  const status = getStockStatus(quantity, minimum);
  const config = stockStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ─── QR Dialog ───────────────────────────────────────────────────────────────

function QRDialog({ product, open, onClose }: { product: Product | null; open: boolean; onClose: () => void }) {
  if (!product) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
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
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[hsl(var(--foreground))]">
              {product?.name}
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
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

export default function ProductsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

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
      toast.success("Product deleted successfully");
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete product");
    },
  });

  // ── Columns ──
  const columns: ColumnDef<Product>[] = [
    {
      id: "image",
      header: "Image",
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
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.original.sku}</p>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      accessorFn: (row) => row.category?.name ?? "—",
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue() as string}</span>
      ),
    },
    {
      id: "supplier",
      header: "Supplier",
      accessorFn: (row) => row.supplier?.name ?? "—",
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "stock_quantity",
      header: "Stock",
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
      header: "Price",
      cell: ({ getValue }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      id: "actions",
      header: "Actions",
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
        <p className="text-[hsl(var(--destructive))]">Failed to load products.</p>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog, pricing, and stock levels."
        action={
          <Button asChild>
            <Link href="/products/add">
              <Plus className="h-4 w-4" />
              Add Product
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={products}
        searchKey="name"
        searchPlaceholder="Search products..."
        loading={isLoading}
        emptyMessage="No products found. Add your first product to get started."
        toolbar={
          <>
            {/* Category filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Stock status filter */}
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder="All Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="good">In Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
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
