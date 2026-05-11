"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { formatCurrency, formatDate, getStockStatus, downloadBlob, csvToBlob } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyStats {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

interface PaymentBreakdown {
  method: string;
  amount: number;
  count: number;
}

interface StockLevel {
  name: string;
  stock: number;
  minimum: number;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const defaults = getDefaultDates();

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-4 w-28 mb-2" />
        <Skeleton className="h-8 w-36" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 shadow-md text-sm">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-[hsl(var(--muted-foreground))]">
          {p.name}:{" "}
          <span className="font-medium text-[hsl(var(--foreground))]">
            {p.name.toLowerCase().includes("revenue") || p.name.toLowerCase().includes("amount")
              ? formatCurrency(p.value)
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const supabase = createClient();
  const t = useT();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [activeTab, setActiveTab] = useState("overview");

  const dateRange = { from: dateFrom, to: dateTo };

  // ── Overview: daily sales ─────────────────────────────────────────────────

  const { data: dailyStats = [], isLoading: dailyLoading } = useQuery<DailyStats[]>({
    queryKey: ["reports-daily", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("created_at, total, payment_status")
        .eq("payment_status", "paid")
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at");
      if (error) throw error;

      const map = new Map<string, DailyStats>();
      for (const row of data ?? []) {
        const d = row.created_at.slice(0, 10);
        const existing = map.get(d) ?? { date: d, revenue: 0, orders: 0 };
        map.set(d, {
          ...existing,
          revenue: existing.revenue + row.total,
          orders: existing.orders + 1,
        });
      }
      // Fill gaps
      const result: DailyStats[] = [];
      const cursor = new Date(dateFrom);
      const end = new Date(dateTo);
      while (cursor <= end) {
        const d = cursor.toISOString().slice(0, 10);
        result.push(map.get(d) ?? { date: d, revenue: 0, orders: 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      return result;
    },
  });

  // ── Summary KPIs ──────────────────────────────────────────────────────────

  const totalRevenue = dailyStats.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = dailyStats.reduce((s, d) => s + d.orders, 0);
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // ── Top products ──────────────────────────────────────────────────────────

  const { data: topProducts = [], isLoading: topLoading } = useQuery<TopProduct[]>({
    queryKey: ["reports-top-products", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          `
          quantity,
          total,
          product:products(name),
          sale:sales!inner(payment_status, created_at)
          `
        )
        .eq("sale.payment_status", "paid")
        .gte("sale.created_at", dateFrom)
        .lte("sale.created_at", dateTo + "T23:59:59");
      if (error) throw error;

      const map = new Map<string, TopProduct>();
      for (const row of data ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = ((row.product as any)?.name as string | undefined) ?? "Unknown";
        const existing = map.get(name) ?? { product_name: name, total_quantity: 0, total_revenue: 0 };
        map.set(name, {
          ...existing,
          total_quantity: existing.total_quantity + row.quantity,
          total_revenue: existing.total_revenue + row.total,
        });
      }
      return Array.from(map.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);
    },
  });

  // ── Payment method breakdown ──────────────────────────────────────────────

  const { data: paymentBreakdown = [], isLoading: paymentLoading } = useQuery<PaymentBreakdown[]>({
    queryKey: ["reports-payment", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("payment_method, total")
        .eq("payment_status", "paid")
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59");
      if (error) throw error;

      const map = new Map<string, PaymentBreakdown>();
      for (const row of data ?? []) {
        const existing = map.get(row.payment_method) ?? {
          method: row.payment_method,
          amount: 0,
          count: 0,
        };
        map.set(row.payment_method, {
          ...existing,
          amount: existing.amount + row.total,
          count: existing.count + 1,
        });
      }
      return Array.from(map.values());
    },
  });

  // ── Inventory: stock levels ───────────────────────────────────────────────

  const { data: stockData = [], isLoading: stockLoading } = useQuery<StockLevel[]>({
    queryKey: ["reports-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("name, stock_quantity, minimum_stock")
        .eq("is_active", true)
        .order("stock_quantity", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        name: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
        stock: p.stock_quantity,
        minimum: p.minimum_stock,
      }));
    },
  });

  const lowStockProducts = stockData.filter((p) => p.stock <= p.minimum);

  // ── Export ────────────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    const headers = ["Date", "Revenue", "Orders"];
    const rows = dailyStats.map((d) => [d.date, String(d.revenue), String(d.orders)]);
    downloadBlob(csvToBlob([headers, ...rows]), `revenue-report-${dateFrom}-${dateTo}.csv`);
    toast.success(t.reports.csvExported);
  }, [dailyStats, dateFrom, dateTo, t]);

  const exportPDF = useCallback(async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(t.reports.title, 14, 22);
      doc.setFontSize(11);
      doc.text(`${t.reports.period} ${formatDate(dateFrom)} – ${formatDate(dateTo)}`, 14, 32);
      doc.text(`${t.reports.totalRevenue}: ${formatCurrency(totalRevenue)}`, 14, 42);
      doc.text(`${t.reports.totalOrders}: ${totalOrders}`, 14, 50);
      doc.text(`${t.reports.avgOrderValue}: ${formatCurrency(avgOrder)}`, 14, 58);

      let y = 72;
      doc.setFontSize(13);
      doc.text(t.reports.topProductsByRevenue, 14, y);
      y += 8;
      doc.setFontSize(10);
      topProducts.slice(0, 10).forEach((p, i) => {
        doc.text(
          `${i + 1}. ${p.product_name} — ${formatCurrency(p.total_revenue)} (${p.total_quantity} units)`,
          14,
          y
        );
        y += 7;
      });

      doc.save(`report-${dateFrom}-${dateTo}.pdf`);
      toast.success(t.reports.pdfExported);
    } catch {
      toast.error(t.reports.pdfFailed);
    }
  }, [totalRevenue, totalOrders, avgOrder, topProducts, dateFrom, dateTo, t]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.reports.title} description={t.reports.description}>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="me-2 h-4 w-4" />
          {t.reports.exportCsv}
        </Button>
        <Button variant="outline" size="sm" onClick={exportPDF}>
          <Download className="me-2 h-4 w-4" />
          {t.reports.exportPdf}
        </Button>
      </PageHeader>

      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{t.reports.period}</span>
        <Input
          type="date"
          className="w-36"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <span className="text-[hsl(var(--muted-foreground))]">{t.common.to.toLowerCase()}</span>
        <Input
          type="date"
          className="w-36"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{t.reports.overview}</TabsTrigger>
          <TabsTrigger value="sales">{t.reports.sales}</TabsTrigger>
          <TabsTrigger value="inventory">{t.reports.inventory}</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ────────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="mt-4 flex flex-col gap-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {dailyLoading ? (
                Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
              ) : (
                <>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                        <TrendingUp className="h-4 w-4" />{t.reports.totalRevenue}
                      </div>
                      <p className="mt-2 text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                        <ShoppingCart className="h-4 w-4" />{t.reports.totalOrders}
                      </div>
                      <p className="mt-2 text-2xl font-bold">{totalOrders}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                        <TrendingUp className="h-4 w-4" />{t.reports.avgOrderValue}
                      </div>
                      <p className="mt-2 text-2xl font-bold">{formatCurrency(avgOrder)}</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Revenue Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t.reports.revenueOverTime}</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyLoading ? (
                  <ChartSkeleton />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => formatDate(v, { month: "short", day: "numeric" })}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip content={<CurrencyTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        name={t.reports.revenue}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Orders Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t.reports.ordersOverTime}</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyLoading ? (
                  <ChartSkeleton />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => formatDate(v, { month: "short", day: "numeric" })}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<CurrencyTooltip />} />
                      <Legend />
                      <Bar dataKey="orders" name={t.reports.orders} fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Sales Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="sales">
          <div className="mt-4 flex flex-col gap-6">
            {/* Top Products Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t.reports.topProductsByRevenue}</CardTitle>
              </CardHeader>
              <CardContent>
                {topLoading ? (
                  <ChartSkeleton height={350} />
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      layout="vertical"
                      data={topProducts}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        dataKey="product_name"
                        type="category"
                        width={120}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip content={<CurrencyTooltip />} />
                      <Bar dataKey="total_revenue" name={t.reports.revenue} fill="#3b82f6" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Payment Method Pie */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t.reports.paymentMethodBreakdown}</CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentLoading ? (
                    <ChartSkeleton height={260} />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          dataKey="amount"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ method, percent }) =>
                            `${method} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                        >
                          {paymentBreakdown.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.reports.paymentCounts}</CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentLoading ? (
                    <ChartSkeleton height={260} />
                  ) : (
                    <div className="mt-2 space-y-3">
                      {paymentBreakdown.map((p, i) => {
                        const totalAmt = paymentBreakdown.reduce((s, x) => s + x.amount, 0);
                        const pct = totalAmt > 0 ? (p.amount / totalAmt) * 100 : 0;
                        return (
                          <div key={p.method} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="capitalize font-medium">{p.method}</span>
                              <span className="text-[hsl(var(--muted-foreground))]">
                                {formatCurrency(p.amount)} ({p.count} {t.reports.orders})
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {paymentBreakdown.length === 0 && (
                        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                          {t.reports.noDataForPeriod}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Inventory Tab ────────────────────────────────────────────────── */}
        <TabsContent value="inventory">
          <div className="mt-4 flex flex-col gap-6">
            {/* Stock Levels Bar */}
            <Card>
              <CardHeader>
                <CardTitle>{t.reports.stockLevels}</CardTitle>
              </CardHeader>
              <CardContent>
                {stockLoading ? (
                  <ChartSkeleton height={350} />
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      layout="vertical"
                      data={stockData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="stock" name={t.reports.currentStock} fill="#3b82f6" radius={[0, 3, 3, 0]} />
                      <Bar dataKey="minimum" name={t.reports.minRequired} fill="#f59e0b" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Low Stock List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t.reports.lowStockAlert} ({lowStockProducts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stockLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : lowStockProducts.length === 0 ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-emerald-600">
                    <Package className="h-4 w-4" />
                    {t.reports.allStocksHealthy}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lowStockProducts.map((p) => {
                      const status = getStockStatus(p.stock, p.minimum);
                      const badgeVariant =
                        status === "out"
                          ? "destructive"
                          : status === "critical"
                          ? "destructive"
                          : "warning";
                      return (
                        <div
                          key={p.name}
                          className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-4 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                            <span className="font-medium text-sm">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-[hsl(var(--muted-foreground))]">
                              {p.stock} / {p.minimum} min
                            </span>
                            <Badge variant={badgeVariant} className="capitalize">{status}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
