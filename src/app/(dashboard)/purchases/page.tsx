"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Eye,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Purchase, PurchaseStatus, Supplier, Product } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_CONFIG: Record<PurchaseStatus, { label: string; variant: "warning" | "success" | "destructive" }> = {
  pending: { label: "Pending", variant: "warning" },
  received: { label: "Received", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseLineItem {
  product_id: string;
  quantity: number;
  cost_price: number;
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── View Purchase Dialog ─────────────────────────────────────────────────────

function ViewPurchaseDialog({
  purchase,
  onClose,
}: {
  purchase: Purchase | null;
  onClose: () => void;
}) {
  if (!purchase) return null;
  return (
    <Dialog open={!!purchase} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Purchase Details</DialogTitle>
          <DialogDescription>
            {purchase.supplier?.name ?? "Unknown Supplier"} · {formatDateTime(purchase.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[hsl(var(--border))]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(purchase.items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(item.cost_price)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between rounded-lg bg-[hsl(var(--muted))] px-4 py-3 font-semibold">
          <span>Total</span>
          <span>{formatCurrency(purchase.total)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Purchase Dialog ──────────────────────────────────────────────────────

function NewPurchaseDialog({
  open,
  onClose,
  suppliers,
  products,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Pick<Product, "id" | "name" | "sku" | "cost_price">[];
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<PurchaseLineItem[]>([
    { product_id: "", quantity: 1, cost_price: 0 },
  ]);

  const total = items.reduce((s, i) => s + i.quantity * i.cost_price, 0);

  const addItem = () =>
    setItems((prev) => [...prev, { product_id: "", quantity: 1, cost_price: 0 }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, patch: Partial<PurchaseLineItem>) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

  const onProductSelect = (idx: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateItem(idx, { product_id: productId, cost_price: product?.cost_price ?? 0 });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Please select a supplier");
      const validItems = items.filter((i) => i.product_id && i.quantity > 0);
      if (validItems.length === 0) throw new Error("Add at least one valid item");

      // Create purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          supplier_id: supplierId,
          total,
          status: "pending",
        })
        .select()
        .single();
      if (purchaseError) throw purchaseError;

      // Create purchase items
      const { error: itemsError } = await supabase.from("purchase_items").insert(
        validItems.map((item) => ({
          purchase_id: purchase.id,
          product_id: item.product_id,
          quantity: item.quantity,
          cost_price: item.cost_price,
          total: item.quantity * item.cost_price,
        }))
      );
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Purchase created successfully");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      onClose();
      setSupplierId("");
      setItems([{ product_id: "", quantity: 1, cost_price: 0 }]);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create purchase"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
          <DialogDescription>Create a new purchase order for stock replenishment.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> Add Item
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-end">
                <div>
                  {idx === 0 && <Label className="text-xs mb-1 block">Product</Label>}
                  <Select value={item.product_id} onValueChange={(v) => onProductSelect(idx, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {idx === 0 && <Label className="text-xs mb-1 block">Qty</Label>}
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  {idx === 0 && <Label className="text-xs mb-1 block">Unit Cost</Label>}
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.cost_price}
                    onChange={(e) => updateItem(idx, { cost_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-[hsl(var(--destructive))]"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))] px-4 py-3">
            <span className="text-sm font-medium">Total</span>
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseStatus>("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);

  const resetPage = () => setPage(1);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async (): Promise<Pick<Product, "id" | "name" | "sku" | "cost_price">[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, cost_price")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Product, "id" | "name" | "sku" | "cost_price">[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["purchases", page, statusFilter, supplierFilter],
    queryFn: async () => {
      let query = supabase
        .from("purchases")
        .select(
          `
          *,
          supplier:suppliers(id, name),
          items:purchase_items(*, product:products(id, name, sku)),
          created_by_user:user_profiles!created_by(id, full_name)
          `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (supplierFilter !== "all") query = query.eq("supplier_id", supplierFilter);

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: (rows ?? []) as Purchase[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: PurchaseStatus;
    }) => {
      const { error } = await supabase
        .from("purchases")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(
        status === "received"
          ? "Purchase marked as received. Stock will be updated."
          : "Purchase cancelled."
      );
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update status"),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Purchases" description="Manage purchase orders and stock replenishment.">
        <Button size="sm" onClick={() => setNewPurchaseOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Purchase
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); resetPage(); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); resetPage(); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[hsl(var(--muted-foreground))]">No purchases found</p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((purchase) => {
                const cfg = STATUS_CONFIG[purchase.status];
                const isPending = purchase.status === "pending";
                const createdBy = (purchase as Purchase & { created_by_user?: { full_name: string } }).created_by_user;
                return (
                  <TableRow key={purchase.id}>
                    <TableCell className="whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(purchase.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {purchase.supplier?.name ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {purchase.items?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(purchase.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                      {createdBy?.full_name ?? "System"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewPurchase(purchase)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isPending && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-700"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: purchase.id, status: "received" })
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Receive
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[hsl(var(--destructive))]"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: purchase.id, status: "cancelled" })
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[hsl(var(--muted-foreground))]">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-[hsl(var(--foreground))]">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <NewPurchaseDialog
        open={newPurchaseOpen}
        onClose={() => setNewPurchaseOpen(false)}
        suppliers={suppliers}
        products={products}
      />
      <ViewPurchaseDialog purchase={viewPurchase} onClose={() => setViewPurchase(null)} />
    </div>
  );
}
