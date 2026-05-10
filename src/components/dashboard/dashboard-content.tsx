"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Package, AlertTriangle, Users, ArrowUpRight,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, getStockStatus } from "@/lib/utils";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  loading?: boolean;
}

function StatCard({ title, value, change, icon, loading }: StatCardProps) {
  if (loading) return <Skeleton className="h-32 rounded-xl" />;
  const positive = (change ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border border-[hsl(var(--border))]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
              {change !== undefined && (
                <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${positive ? "text-emerald-500" : "text-red-500"}`}>
                  {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {positive ? "+" : ""}{change.toFixed(1)}% from yesterday
                </div>
              )}
            </div>
            <div className="rounded-xl bg-[hsl(var(--primary))]/10 p-3 text-[hsl(var(--primary))]">
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DashboardContent() {
  const supabase = createClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const yesterday = subDays(today, 1);

      const [todaySales, yesterdaySales, products, lowStock, customers] = await Promise.all([
        supabase.from("sales").select("total").eq("payment_status", "paid").gte("created_at", format(today, "yyyy-MM-dd")),
        supabase.from("sales").select("total").eq("payment_status", "paid").gte("created_at", format(yesterday, "yyyy-MM-dd")).lt("created_at", format(today, "yyyy-MM-dd")),
        supabase.from("products").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("products").select("id", { count: "exact" }).lte("stock_quantity", supabase.rpc as unknown as number).eq("is_active", true),
        supabase.from("customers").select("id", { count: "exact" }),
      ]);

      const todayRevenue = todaySales.data?.reduce((s, r) => s + r.total, 0) ?? 0;
      const yesterdayRevenue = yesterdaySales.data?.reduce((s, r) => s + r.total, 0) ?? 0;
      const revenueChange = yesterdayRevenue === 0 ? 100 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;

      const todayOrders = todaySales.data?.length ?? 0;
      const yesterdayOrders = yesterdaySales.data?.length ?? 0;
      const ordersChange = yesterdayOrders === 0 ? 100 : ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;

      // Fetch low stock separately
      const { count: lowStockCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .lte("stock_quantity", 5)
        .eq("is_active", true);

      return {
        todayRevenue,
        todayOrders,
        totalProducts: products.count ?? 0,
        lowStockCount: lowStockCount ?? 0,
        totalCustomers: customers.count ?? 0,
        revenueChange,
        ordersChange,
      };
    },
    refetchInterval: 30000,
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["dashboard-revenue-chart"],
    queryFn: async () => {
      const days = 7;
      const result = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, "yyyy-MM-dd");
        const nextDate = format(subDays(new Date(), i - 1), "yyyy-MM-dd");
        const { data } = await supabase
          .from("sales")
          .select("total")
          .eq("payment_status", "paid")
          .gte("created_at", dateStr)
          .lt("created_at", i === 0 ? format(new Date(), "yyyy-MM-dd'T'23:59:59") : nextDate);
        result.push({
          date: format(date, "MMM dd"),
          revenue: data?.reduce((s, r) => s + Number(r.total), 0) ?? 0,
          orders: data?.length ?? 0,
        });
      }
      return result;
    },
  });

  const { data: topProducts, isLoading: topLoading } = useQuery({
    queryKey: ["dashboard-top-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_items")
        .select("product_id, quantity, total, product:products(name)")
        .order("quantity", { ascending: false })
        .limit(50);

      const grouped: Record<string, { name: string; quantity: number; revenue: number }> = {};
      data?.forEach((item) => {
        if (!grouped[item.product_id]) {
          grouped[item.product_id] = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: ((item.product as any)?.name as string | undefined) ?? "Unknown",
            quantity: 0,
            revenue: 0,
          };
        }
        grouped[item.product_id].quantity += item.quantity;
        grouped[item.product_id].revenue += Number(item.total);
      });

      return Object.entries(grouped)
        .map(([, v]) => v)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, stock_quantity, minimum_stock, category:categories(name)")
        .lte("stock_quantity", 10)
        .eq("is_active", true)
        .order("stock_quantity")
        .limit(5);
      return data ?? [];
    },
  });

  const { data: recentSales } = useQuery({
    queryKey: ["dashboard-recent-sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("*, customer:customers(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const paymentData = [
    { name: "Cash", value: 55 },
    { name: "Card", value: 30 },
    { name: "Wallet", value: 15 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Welcome back! Here&apos;s what&apos;s happening today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats?.todayRevenue ?? 0)}
          change={stats?.revenueChange}
          icon={<DollarSign className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatCard
          title="Today's Orders"
          value={String(stats?.todayOrders ?? 0)}
          change={stats?.ordersChange}
          icon={<ShoppingCart className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatCard
          title="Total Products"
          value={String(stats?.totalProducts ?? 0)}
          icon={<Package className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatCard
          title="Low Stock Alerts"
          value={String(stats?.lowStockCount ?? 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
          loading={statsLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Area Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Revenue (Last 7 Days)</CardTitle>
            <CardDescription className="text-xs">Daily revenue trend</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-[240px]" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Payment Methods</CardTitle>
            <CardDescription className="text-xs">Distribution breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={4}>
                  {paymentData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`, "Share"]} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top Products */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topLoading
              ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)
              : topProducts?.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-xs font-bold text-[hsl(var(--primary))]">{i + 1}</span>
                    <span className="truncate text-sm font-medium">{p.name}</span>
                  </div>
                  <span className="ml-2 shrink-0 text-sm font-semibold">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            {!topLoading && !topProducts?.length && (
              <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">No sales data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStockProducts?.map((p) => {
              const status = getStockStatus(p.stock_quantity, p.minimum_stock);
              return (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.sku}</p>
                  </div>
                  <Badge
                    variant={status === "out" ? "destructive" : status === "critical" ? "destructive" : "warning" as "warning"}
                    className="ml-2 shrink-0 text-xs"
                  >
                    {p.stock_quantity} left
                  </Badge>
                </div>
              );
            })}
            {!lowStockProducts?.length && (
              <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">All stocks are healthy</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSales?.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sale.invoice_number}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {(sale.customer as { name: string } | null)?.name ?? "Walk-in"} · {formatDate(sale.created_at)}
                  </p>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-600">
                  <ArrowUpRight className="h-3 w-3" />
                  {formatCurrency(sale.total)}
                </div>
              </div>
            ))}
            {!recentSales?.length && (
              <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">No sales today</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Orders (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            <Skeleton className="h-[180px]" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
