"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Download,
  Eye,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime, downloadBlob, csvToBlob } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent } from "@/components/ui/card";
import type { Sale, PaymentMethod, PaymentStatus, SaleItem } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const PAYMENT_BADGE: Record<PaymentMethod, { label: string; variant: "default" | "secondary" | "success" | "outline" }> = {
  cash: { label: "Cash", variant: "success" },
  card: { label: "Card", variant: "default" },
  wallet: { label: "Wallet", variant: "secondary" },
};

const STATUS_BADGE: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" }> = {
  paid: { label: "Paid", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  refunded: { label: "Refunded", variant: "destructive" },
};

// ─── Skeletons ────────────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 9 }).map((__, j) => (
            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Sale Detail Dialog ───────────────────────────────────────────────────────

function SaleDetailDialog({
  sale,
  onClose,
}: {
  sale: Sale | null;
  onClose: () => void;
}) {
  if (!sale) return null;

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sale Details — {sale.invoice_number}</DialogTitle>
          <DialogDescription>
            {formatDateTime(sale.created_at)}
            {sale.customer && ` · ${sale.customer.name}`}
            {sale.cashier && ` · Cashier: ${sale.cashier.full_name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-lg border border-[hsl(var(--border))]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sale.items ?? []).map((item: SaleItem) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.product?.name ?? "Unknown Product"}
                    {item.product?.sku && (
                      <span className="ml-1 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                        ({item.product.sku})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(item.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 space-y-1.5 rounded-lg bg-[hsl(var(--muted))] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Subtotal</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span>-{formatCurrency(sale.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Tax</span>
            <span>{formatCurrency(sale.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-[hsl(var(--border))] pt-2 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
          <div className="flex justify-between pt-1 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Payment</span>
            <span className="capitalize">{sale.payment_method}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const supabase = createClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentMethod>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const resetPage = () => setPage(1);

  // ── Query ─────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["sales", page, search, paymentFilter, statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(
          `
          *,
          customer:customers(id, name),
          cashier:user_profiles!cashier_id(id, full_name),
          items:sale_items(
            *,
            product:products(id, name, sku)
          )
          `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (search) query = query.ilike("invoice_number", `%${search}%`);
      if (paymentFilter !== "all") query = query.eq("payment_method", paymentFilter);
      if (statusFilter !== "all") query = query.eq("payment_status", statusFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: (rows ?? []) as Sale[], total: count ?? 0 };
    },
  });

  // ── Summary stats ─────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["sales-stats", dateFrom, dateTo, paymentFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("total, payment_method, payment_status");

      if (paymentFilter !== "all") query = query.eq("payment_method", paymentFilter);
      if (statusFilter !== "all") query = query.eq("payment_status", statusFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data: rows, error } = await query;
      if (error) throw error;
      const paidRows = (rows ?? []).filter((r) => r.payment_status === "paid");
      return {
        totalRevenue: paidRows.reduce((s, r) => s + r.total, 0),
        totalOrders: rows?.length ?? 0,
        avgOrder: paidRows.length > 0 ? paidRows.reduce((s, r) => s + r.total, 0) / paidRows.length : 0,
      };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const headers = ["Invoice #", "Customer", "Cashier", "Items", "Total", "Payment", "Status", "Date"];
    const csvRows = rows.map((s) => [
      s.invoice_number,
      s.customer?.name ?? "Walk-in",
      s.cashier?.full_name ?? "—",
      String(s.items?.length ?? 0),
      String(s.total),
      s.payment_method,
      s.payment_status,
      s.created_at,
    ]);
    downloadBlob(csvToBlob([headers, ...csvRows]), `sales-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success("CSV exported");
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sales History" description="View and manage all completed sales.">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <TrendingUp className="h-4 w-4" />
                  Total Revenue
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(stats?.totalRevenue ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <ShoppingCart className="h-4 w-4" />
                  Total Orders
                </div>
                <p className="mt-2 text-2xl font-bold">{stats?.totalOrders ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <TrendingUp className="h-4 w-4" />
                  Avg. Order Value
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(stats?.avgOrder ?? 0)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            className="pl-8"
            placeholder="Search invoice #..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          />
        </div>

        <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v as typeof paymentFilter); resetPage(); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="wallet">Wallet</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); resetPage(); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
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
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[hsl(var(--muted-foreground))]">No sales found</p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((sale) => {
                const payBadge = PAYMENT_BADGE[sale.payment_method];
                const statBadge = STATUS_BADGE[sale.payment_status];
                return (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {sale.invoice_number}
                    </TableCell>
                    <TableCell>{sale.customer?.name ?? "Walk-in"}</TableCell>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">
                      {sale.cashier?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sale.items?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(sale.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={payBadge.variant}>{payBadge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statBadge.variant}>{statBadge.label}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(sale.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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

      <SaleDetailDialog sale={selectedSale} onClose={() => setSelectedSale(null)} />
    </div>
  );
}
