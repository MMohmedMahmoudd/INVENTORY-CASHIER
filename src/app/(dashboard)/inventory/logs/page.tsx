"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { InventoryTransaction, InventoryTransactionType, Product } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const TYPE_CONFIG: Record<
  InventoryTransactionType,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }
> = {
  purchase: { label: "Purchase", variant: "success" },
  sale: { label: "Sale", variant: "default" },
  adjustment: { label: "Adjustment", variant: "warning" },
  return: { label: "Return", variant: "secondary" },
  transfer: { label: "Transfer", variant: "outline" },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 8 }).map((__, j) => (
            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryLogsPage() {
  const supabase = createClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | InventoryTransactionType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Products for filter dropdown ──────────────────────────────────────────

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async (): Promise<Pick<Product, "id" | "name" | "sku">[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Product, "id" | "name" | "sku">[];
    },
  });

  // ── Transactions ──────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-logs", page, productFilter, typeFilter, dateFrom, dateTo, search],
    queryFn: async () => {
      let query = supabase
        .from("inventory_transactions")
        .select(
          `
          *,
          product:products(id, name, sku),
          user:user_profiles!created_by(id, full_name)
          `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (productFilter !== "all") query = query.eq("product_id", productFilter);
      if (typeFilter !== "all") query = query.eq("type", typeFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: (rows ?? []) as InventoryTransaction[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Filter by product name/sku client-side for search
  const filtered = search
    ? rows.filter(
        (r) =>
          r.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.product?.sku?.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const resetPage = () => setPage(1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory Logs"
        description="Full audit trail of all stock movements."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            className="pl-8"
            placeholder="Search product..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          />
        </div>

        <Select
          value={productFilter}
          onValueChange={(v) => { setProductFilter(v); resetPage(); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => { setTypeFilter(v as typeof typeFilter); resetPage(); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="sale">Sale</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
            <SelectItem value="return">Return</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-36"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
          title="From date"
        />
        <Input
          type="date"
          className="w-36"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
          title="To date"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty Change</TableHead>
              <TableHead className="text-right">Previous</TableHead>
              <TableHead className="text-right">New Stock</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Created By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[hsl(var(--muted-foreground))]">No transactions found</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => {
                const cfg = TYPE_CONFIG[tx.type] ?? { label: tx.type, variant: "outline" as const };
                const isPositive = tx.quantity > 0;
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(tx.created_at)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{tx.product?.name ?? "—"}</p>
                      <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                        {tx.product?.sku}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          isPositive ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"
                        }
                      >
                        {isPositive ? "+" : ""}{tx.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                      {tx.previous_stock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {tx.new_stock}
                    </TableCell>
                    <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                      {tx.reference_type ?? "—"}
                      {tx.reference_id ? (
                        <span className="ml-1 font-mono">#{tx.reference_id.slice(0, 8)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(tx as InventoryTransaction & { user?: { full_name?: string } }).user?.full_name ?? "System"}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-[hsl(var(--foreground))]">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
