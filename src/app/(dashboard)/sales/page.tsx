"use client";

import React, { useState, useCallback, useMemo } from "react";
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
import { useT } from "@/lib/i18n";
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
  const t = useT();
  if (!sale) return null;

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.sales.saleDetailsPrefix} {sale.invoice_number}</DialogTitle>
          <DialogDescription>
            {formatDateTime(sale.created_at)}
            {sale.customer && ` · ${sale.customer.name}`}
            {sale.cashier && ` · ${t.sales.cashierLabel} ${sale.cashier.full_name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-lg border border-[hsl(var(--border))]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.products.columns.name}</TableHead>
                <TableHead className="text-end">{t.products.filters.allStock}</TableHead>
                <TableHead className="text-end">{t.inventory.columns.price}</TableHead>
                <TableHead className="text-end">{t.common.total}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sale.items ?? []).map((item: SaleItem) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.product?.name ?? "Unknown Product"}
                    {item.product?.sku && (
                      <span className="ms-1 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                        ({item.product.sku})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums font-medium">
                    {formatCurrency(item.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 space-y-1.5 rounded-lg bg-[hsl(var(--muted))] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">{t.sales.subtotal}</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>{t.sales.discount}</span>
              <span>-{formatCurrency(sale.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">{t.sales.tax}</span>
            <span>{formatCurrency(sale.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-[hsl(var(--border))] pt-2 font-semibold">
            <span>{t.sales.total}</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
          <div className="flex justify-between pt-1 text-xs text-[hsl(var(--muted-foreground))]">
            <span>{t.sales.payment}</span>
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
  const t = useT();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentMethod>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const resetPage = () => setPage(1);

  const PAYMENT_BADGE: Record<PaymentMethod, { label: string; variant: "default" | "secondary" | "success" | "outline" }> = {
    cash: { label: t.sales.paymentCash, variant: "success" },
    card: { label: t.sales.paymentCard, variant: "default" },
    wallet: { label: t.sales.paymentWallet, variant: "secondary" },
  };

  const STATUS_BADGE: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" }> = {
    paid: { label: t.sales.statusPaid, variant: "success" },
    pending: { label: t.sales.statusPending, variant: "warning" },
    refunded: { label: t.sales.statusRefunded, variant: "destructive" },
  };

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

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const headers = [
      t.sales.tableInvoice, t.sales.tableCustomer, t.sales.tableCashier,
      t.sales.tableItems, t.sales.tableTotal, t.sales.tablePayment,
      t.sales.tableStatus, t.sales.tableDate,
    ];
    const csvRows = rows.map((s) => [
      s.invoice_number,
      s.customer?.name ?? t.sales.walkin,
      s.cashier?.full_name ?? "—",
      String(s.items?.length ?? 0),
      String(s.total),
      s.payment_method,
      s.payment_status,
      s.created_at,
    ]);
    downloadBlob(csvToBlob([headers, ...csvRows]), `sales-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(t.sales.csvExported);
  }, [rows, t]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.sales.title} description={t.sales.description}>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="me-2 h-4 w-4" />
          {t.sales.exportCsv}
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
                  {t.sales.statsRevenue}
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(stats?.totalRevenue ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <ShoppingCart className="h-4 w-4" />
                  {t.sales.statsOrders}
                </div>
                <p className="mt-2 text-2xl font-bold">{stats?.totalOrders ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <TrendingUp className="h-4 w-4" />
                  {t.sales.statsAvg}
                </div>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(stats?.avgOrder ?? 0)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-45">
          <Search className="absolute inset-s-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            className="ps-8"
            placeholder={t.sales.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          />
        </div>

        <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v as typeof paymentFilter); resetPage(); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t.sales.allPayments} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.sales.allPayments}</SelectItem>
            <SelectItem value="cash">{t.sales.paymentCash}</SelectItem>
            <SelectItem value="card">{t.sales.paymentCard}</SelectItem>
            <SelectItem value="wallet">{t.sales.paymentWallet}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); resetPage(); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t.sales.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.sales.allStatuses}</SelectItem>
            <SelectItem value="paid">{t.sales.statusPaid}</SelectItem>
            <SelectItem value="pending">{t.sales.statusPending}</SelectItem>
            <SelectItem value="refunded">{t.sales.statusRefunded}</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-36"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
          title={t.common.from}
        />
        <Input
          type="date"
          className="w-36"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
          title={t.common.to}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.sales.tableInvoice}</TableHead>
              <TableHead>{t.sales.tableCustomer}</TableHead>
              <TableHead>{t.sales.tableCashier}</TableHead>
              <TableHead className="text-end">{t.sales.tableItems}</TableHead>
              <TableHead className="text-end">{t.sales.tableTotal}</TableHead>
              <TableHead>{t.sales.tablePayment}</TableHead>
              <TableHead>{t.sales.tableStatus}</TableHead>
              <TableHead>{t.sales.tableDate}</TableHead>
              <TableHead className="text-end">{t.sales.tableActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[hsl(var(--muted-foreground))]">{t.sales.noSalesFound}</p>
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
                    <TableCell>{sale.customer?.name ?? t.sales.walkin}</TableCell>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">
                      {sale.cashier?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {sale.items?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-end tabular-nums font-medium">
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
                    <TableCell className="text-end">
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
            {t.common.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.common.of} {total}
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
