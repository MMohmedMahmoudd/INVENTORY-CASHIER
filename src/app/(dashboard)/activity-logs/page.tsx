"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Activity, ChevronLeft, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";
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
import type { ActivityLog, UserProfile, Json } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const ACTION_COLORS: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  create: "success",
  update: "warning",
  delete: "destructive",
  login: "default",
  logout: "secondary",
  view: "outline",
  export: "outline",
  import: "default",
};

const ENTITY_COLORS: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  product: "default",
  sale: "success",
  purchase: "warning",
  inventory_transaction: "secondary",
  user: "outline",
  category: "outline",
  supplier: "outline",
  customer: "outline",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActionVariant(action: string) {
  const key = action.split("_")[0]?.toLowerCase() ?? action;
  return ACTION_COLORS[key] ?? "outline";
}

function getEntityVariant(entity: string) {
  return ENTITY_COLORS[entity] ?? "outline";
}

function formatAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEntityType(entityType: string) {
  return entityType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MetadataDisplay({ metadata }: { metadata: Json }) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  }

  const entries = Object.entries(metadata as Record<string, Json>).slice(0, 4);
  if (entries.length === 0) return <span className="text-[hsl(var(--muted-foreground))]">—</span>;

  return (
    <div className="space-y-0.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1.5 text-xs">
          <span className="shrink-0 font-medium capitalize text-[hsl(var(--muted-foreground))]">
            {key.replace(/_/g, " ")}:
          </span>
          <span className="truncate max-w-[200px]">
            {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivityLogsPage() {
  const supabase = createClient();
  const t = useT();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const resetPage = () => setPage(1);

  // ── Users for filter ───────────────────────────────────────────────────────

  const { data: users = [] } = useQuery({
    queryKey: ["user-profiles"],
    queryFn: async (): Promise<Pick<UserProfile, "id" | "full_name">[]> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Pick<UserProfile, "id" | "full_name">[];
    },
  });

  // ── Logs ───────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", page, userFilter, actionFilter, entityFilter, dateFrom, dateTo, search],
    queryFn: async () => {
      let query = supabase
        .from("activity_logs")
        .select(
          `
          *,
          user:user_profiles!user_id(id, full_name)
          `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (userFilter !== "all") query = query.eq("user_id", userFilter);
      if (actionFilter !== "all") query = query.ilike("action", `${actionFilter}%`);
      if (entityFilter !== "all") query = query.eq("entity_type", entityFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
      if (search) query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%`);

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: (rows ?? []) as ActivityLog[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.activityLogs.title}
        description={t.activityLogs.description}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute inset-s-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            className="ps-8"
            placeholder={t.activityLogs.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          />
        </div>

        <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); resetPage(); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t.activityLogs.allUsers} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.activityLogs.allUsers}</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); resetPage(); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t.activityLogs.actionType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.activityLogs.allActions}</SelectItem>
            <SelectItem value="create">{t.activityLogs.create}</SelectItem>
            <SelectItem value="update">{t.activityLogs.update}</SelectItem>
            <SelectItem value="delete">{t.activityLogs.delete}</SelectItem>
            <SelectItem value="login">{t.activityLogs.login}</SelectItem>
            <SelectItem value="logout">{t.activityLogs.logout}</SelectItem>
            <SelectItem value="export">{t.activityLogs.export}</SelectItem>
            <SelectItem value="import">{t.activityLogs.import}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); resetPage(); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t.activityLogs.entityType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.activityLogs.allEntities}</SelectItem>
            <SelectItem value="product">{t.activityLogs.product}</SelectItem>
            <SelectItem value="sale">{t.activityLogs.sale}</SelectItem>
            <SelectItem value="purchase">{t.activityLogs.purchase}</SelectItem>
            <SelectItem value="inventory_transaction">{t.activityLogs.inventory}</SelectItem>
            <SelectItem value="user">{t.activityLogs.user}</SelectItem>
            <SelectItem value="category">{t.activityLogs.category}</SelectItem>
            <SelectItem value="supplier">{t.activityLogs.supplier}</SelectItem>
            <SelectItem value="customer">{t.activityLogs.customer}</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-36"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
          title={t.activityLogs.fromDate}
        />
        <Input
          type="date"
          className="w-36"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
          title={t.activityLogs.toDate}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">{t.activityLogs.columns.time}</TableHead>
              <TableHead>{t.activityLogs.columns.user}</TableHead>
              <TableHead>{t.activityLogs.columns.action}</TableHead>
              <TableHead>{t.activityLogs.columns.entityType}</TableHead>
              <TableHead>{t.activityLogs.columns.entityId}</TableHead>
              <TableHead>{t.activityLogs.columns.details}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Activity className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[hsl(var(--muted-foreground))]">{t.activityLogs.noActivity}</p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((log) => {
                const userProfile = (log as ActivityLog & { user?: { full_name: string } }).user;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {userProfile?.full_name ?? t.activityLogs.system}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionVariant(log.action)}>
                        {formatAction(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getEntityVariant(log.entity_type)}>
                        {formatEntityType(log.entity_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.entity_id ? (
                        <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                          {log.entity_id.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <MetadataDisplay metadata={log.metadata} />
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
