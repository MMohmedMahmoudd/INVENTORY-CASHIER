"use client";

import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Minus,
  Download,
  Upload,
  Search,
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
  Printer,
} from "lucide-react";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency, getStockStatus, downloadBlob, csvToBlob, slugify } from "@/lib/utils";
import { generateUniqueBarcode } from "@/lib/barcode";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/page-header";
import { PrintLabelDialog } from "@/components/shared/print-label-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import type { Product, Category, InventoryTransactionType } from "@/types";

// ─── CSV Helpers ─────────────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  sku:         ["sku", "product_sku", "base_sku", "item_sku", "code", "product_code", "item_code", "ref", "reference"],
  name:        ["name", "product_name", "item_name", "title", "product_title"],
  category:    ["category", "category_name", "cat", "cat_name"],
  qty:         ["stock", "qty", "quantity", "stock_quantity", "current_stock", "on_hand", "inventory"],
  min_stock:   ["min_stock", "minimum_stock", "min_qty", "min_quantity", "reorder_point"],
  cost:        ["cost", "cost_price", "purchase_price", "buy_price", "buying_price"],
  price:       ["price", "selling_price", "sell_price", "sale_price", "retail_price", "unit_price"],
  barcode:     ["barcode", "ean", "upc"],
  unit:        ["unit", "uom"],
  description: ["description", "notes", "product_description"],
  size:        ["size", "shoe_size", "clothing_size", "variant_size", "us_size", "eu_size", "uk_size"],
  color:       ["color", "colour", "variant_color", "variant_colour", "shade"],
  style:       ["style", "variant_style", "shoe_style", "shoe_type"],
  variant_sku: ["variant_sku", "var_sku", "size_sku", "variant_code"],
  variant_bar: ["variant_barcode", "var_barcode", "variant_ean"],
};

function mapColumns(headers: string[]): Record<string, number> {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[\s-]+/g, "_"));
  const result: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    result[field] = normalized.findIndex((h) => aliases.includes(h));
  }
  return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type StockFilter = "all" | "good" | "low" | "critical" | "out";

interface AdjustForm {
  mode: "add" | "subtract";
  quantity: string;
  reason: string;
  type: InventoryTransactionType;
}

// ─── Stock Status Badge ───────────────────────────────────────────────────────

function StockBadge({ status }: { status: ReturnType<typeof getStockStatus> }) {
  const t = useT();
  const map = {
    good:     { label: t.inventory.inStock,    variant: "success" as const,      icon: CheckCircle2 },
    low:      { label: t.inventory.lowStock,   variant: "warning" as const,      icon: AlertTriangle },
    critical: { label: t.inventory.critical,   variant: "destructive" as const,  icon: AlertTriangle },
    out:      { label: t.inventory.outOfStock, variant: "destructive" as const,  icon: XCircle },
  };
  const { label, variant, icon: Icon } = map[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// ─── Stock Level Bar ──────────────────────────────────────────────────────────

function StockBar({ quantity, minimum }: { quantity: number; minimum: number }) {
  const status = getStockStatus(quantity, minimum);
  const max = Math.max(minimum * 3, quantity, 1);
  const pct = Math.min((quantity / max) * 100, 100);
  const colors = {
    good: "bg-emerald-500",
    low: "bg-amber-500",
    critical: "bg-orange-500",
    out: "bg-red-500",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <div
          className={`h-full rounded-full transition-all ${colors[status]}`}
          // eslint-disable-next-line react/forbid-dom-props
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums">{quantity}</span>
    </div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-5 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const t = useT();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  const [printTarget, setPrintTarget] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState<AdjustForm>({
    mode: "add",
    quantity: "",
    reason: "",
    type: "adjustment",
  });

  const csvInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["inventory", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("is_active", true)
        .order("stock_quantity", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Filters ───────────────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      categoryFilter === "all" || p.category_id === categoryFilter;
    const status = getStockStatus(p.stock_quantity, p.minimum_stock);
    const matchStock = stockFilter === "all" || status === stockFilter;
    return matchSearch && matchCategory && matchStock;
  });

  // ── Stock Adjust Mutation ─────────────────────────────────────────────────────

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjustProduct) throw new Error("No product selected");
      const qty = parseInt(adjustForm.quantity, 10);
      if (isNaN(qty) || qty <= 0) throw new Error("Invalid quantity");

      const delta = adjustForm.mode === "add" ? qty : -qty;
      const newStock = adjustProduct.stock_quantity + delta;
      if (newStock < 0) throw new Error("Stock cannot go below 0");

      const { error: txError } = await supabase
        .from("inventory_transactions")
        .insert({
          product_id: adjustProduct.id,
          type: adjustForm.type,
          quantity: delta,
          previous_stock: adjustProduct.stock_quantity,
          new_stock: newStock,
          reference_type: "manual",
          reference_id: null,
        });
      if (txError) throw txError;

      const { error: prodError } = await supabase
        .from("products")
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq("id", adjustProduct.id);
      if (prodError) throw prodError;
    },
    onSuccess: () => {
      toast.success(t.inventory.toast.adjusted);
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAdjustProduct(null);
      setAdjustForm({ mode: "add", quantity: "", reason: "", type: "adjustment" });
    },
    onError: (err: Error) => {
      toast.error(err.message || t.inventory.toast.adjustError);
    },
  });

  // ── CSV Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const headers = [
      t.inventory.columns.sku, t.inventory.columns.product, t.inventory.columns.category,
      t.inventory.columns.stockLevel, t.inventory.columns.minStock,
      t.inventory.columns.status, t.inventory.columns.price,
    ];
    const rows = filtered.map((p) => [
      p.sku,
      p.name,
      p.category?.name ?? "",
      String(p.stock_quantity),
      String(p.minimum_stock),
      getStockStatus(p.stock_quantity, p.minimum_stock),
      String(p.selling_price),
    ]);
    downloadBlob(csvToBlob([headers, ...rows]), `inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(t.inventory.toast.csvExported);
  }, [filtered, t]);

  // ── CSV Import ────────────────────────────────────────────────────────────────

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const allLines = (await file.text()).trim().split(/\r?\n/);
        if (allLines.length < 2) { toast.error("CSV has no data rows"); return; }

        const col = mapColumns(parseCSVRow(allLines[0]));
        if (col.sku === -1) {
          toast.error("CSV must have a SKU column (sku, base_sku, code, …)");
          return;
        }

        const { data: allCategories } = await supabase.from("categories").select("id, name");
        const categoryMap = new Map((allCategories ?? []).map((c) => [c.name.toLowerCase(), c.id]));

        let created = 0, updated = 0, failed = 0;
        const now = new Date().toISOString();

        const strVal = (cols: string[], idx: number) =>
          idx !== -1 ? cols[idx]?.trim() || undefined : undefined;
        const numVal = (cols: string[], idx: number, parser: (s: string) => number) => {
          const s = strVal(cols, idx);
          if (!s) return undefined;
          const v = parser(s);
          return isNaN(v) ? undefined : v;
        };
        const resolveCategory = (cols: string[]) => {
          const s = strVal(cols, col.category);
          return s ? categoryMap.get(s.toLowerCase()) : undefined;
        };

        const generateQR = async (productId: string, sku: string) => {
          const qrValue = `PRODUCT:${productId}:${sku}`;
          const qrDataUrl = await QRCode.toDataURL(qrValue, { width: 300, margin: 2 });
          const qrBlob = await fetch(qrDataUrl).then((r) => r.blob());
          const qrPath = `products/qr-${productId}.png`;
          await supabase.storage.from("product-images").upload(qrPath, qrBlob, { upsert: true });
          const { data: qrUrlData } = supabase.storage.from("product-images").getPublicUrl(qrPath);
          await supabase.from("products").update({ qr_code: qrUrlData.publicUrl }).eq("id", productId);
          await supabase.from("product_qr_codes").insert({
            product_id: productId, qr_value: qrValue, qr_image_url: qrUrlData.publicUrl,
          });
        };

        const isVariantImport = col.size !== -1 || col.color !== -1 || col.style !== -1;
        const usedBarcodes = new Set<string>();

        if (isVariantImport) {
          const groups = new Map<string, string[][]>();
          for (const line of allLines.slice(1)) {
            if (!line.trim()) continue;
            const cols = parseCSVRow(line);
            const sku = cols[col.sku]?.trim();
            if (!sku) { failed++; continue; }
            if (!groups.has(sku)) groups.set(sku, []);
            groups.get(sku)!.push(cols);
          }

          for (const [baseSku, rows] of groups) {
            const firstRow = rows[0];
            const name = strVal(firstRow, col.name);
            if (!name) { failed += rows.length; continue; }

            const { data: existingProd } = await supabase
              .from("products").select("id").eq("sku", baseSku).single();

            let productId: string;

            if (existingProd) {
              productId = existingProd.id;
              const patch: Record<string, unknown> = { name, updated_at: now };
              const cost  = numVal(firstRow, col.cost,  parseFloat); if (cost  !== undefined) patch.cost_price   = cost;
              const price = numVal(firstRow, col.price, parseFloat); if (price !== undefined) patch.selling_price = price;
              const min   = numVal(firstRow, col.min_stock, (s) => parseInt(s, 10)); if (min !== undefined) patch.minimum_stock = min;
              const cat   = resolveCategory(firstRow);               if (cat)                 patch.category_id  = cat;
              await supabase.from("products").update(patch).eq("id", productId);
            } else {
              const cat     = resolveCategory(firstRow);
              const cost    = numVal(firstRow, col.cost,      parseFloat) ?? 0;
              const price   = numVal(firstRow, col.price,     parseFloat) ?? 0;
              const minStk  = numVal(firstRow, col.min_stock, (s) => parseInt(s, 10)) ?? 2;
              const desc    = strVal(firstRow, col.description);
              const newProd: Record<string, unknown> = {
                name,
                slug: `${slugify(name)}-${Math.random().toString(36).substring(2, 6)}`,
                sku: baseSku,
                barcode: strVal(firstRow, col.barcode) || await generateUniqueBarcode(supabase, usedBarcodes),
                stock_quantity: 0,
                minimum_stock: minStk,
                cost_price: cost,
                selling_price: price,
                unit: strVal(firstRow, col.unit) ?? "pair",
                is_active: true,
              };
              if (desc) newProd.description = desc;
              if (cat)  newProd.category_id  = cat;

              const { data: createdProd, error } = await supabase
                .from("products").insert(newProd).select("id, sku").single();
              if (error || !createdProd) { failed += rows.length; continue; }
              productId = createdProd.id;
              try { await generateQR(productId, baseSku); } catch { /* non-fatal */ }
              created++;
            }

            for (const varCols of rows) {
              const size  = strVal(varCols, col.size)  ?? null;
              const color = strVal(varCols, col.color) ?? null;
              const style = strVal(varCols, col.style) ?? null;

              const rawVarSku = strVal(varCols, col.variant_sku);
              const variantSku = rawVarSku ||
                `${baseSku}-${[size, color].filter(Boolean).join("-")}`.toUpperCase();

              const variantBar  = strVal(varCols, col.variant_bar) ?? null;
              const varStock    = numVal(varCols, col.qty,  (s) => parseInt(s, 10)) ?? 0;
              const varCost     = numVal(varCols, col.cost,  parseFloat) ?? null;
              const varPrice    = numVal(varCols, col.price, parseFloat) ?? null;

              const { data: existingVar } = await supabase
                .from("product_variants").select("id").eq("sku", variantSku).single();

              if (existingVar) {
                await supabase.from("product_variants").update({
                  size, color, style,
                  stock_quantity: varStock,
                  cost_price: varCost,
                  selling_price: varPrice,
                }).eq("id", existingVar.id);
                updated++;
              } else {
                const { error } = await supabase.from("product_variants").insert({
                  product_id: productId,
                  size, color, style,
                  sku: variantSku,
                  barcode: variantBar,
                  stock_quantity: varStock,
                  cost_price: varCost,
                  selling_price: varPrice,
                  is_active: true,
                });
                if (error) failed++;
                else created++;
              }
            }
          }

        } else {
          for (const line of allLines.slice(1)) {
            if (!line.trim()) continue;
            const cols = parseCSVRow(line);
            const sku = cols[col.sku]?.trim();
            if (!sku) { failed++; continue; }

            const { data: prod } = await supabase
              .from("products").select("id, stock_quantity").eq("sku", sku).single();

            const cat = resolveCategory(cols);

            if (prod) {
              const patch: Record<string, unknown> = { updated_at: now };
              const name  = strVal(cols, col.name);           if (name)              patch.name          = name;
              const cost  = numVal(cols, col.cost, parseFloat); if (cost !== undefined)  patch.cost_price   = cost;
              const price = numVal(cols, col.price, parseFloat);if (price !== undefined) patch.selling_price = price;
              const min   = numVal(cols, col.min_stock, (s) => parseInt(s, 10));
                                                               if (min !== undefined)   patch.minimum_stock = min;
              const unit  = strVal(cols, col.unit);            if (unit)               patch.unit          = unit;
              const bar   = strVal(cols, col.barcode);         if (bar)                patch.barcode       = bar;
              const desc  = strVal(cols, col.description);     if (desc)               patch.description   = desc;
              if (cat) patch.category_id = cat;

              const newQty = numVal(cols, col.qty, (s) => parseInt(s, 10));
              if (newQty !== undefined && newQty >= 0) {
                patch.stock_quantity = newQty;
                await supabase.from("inventory_transactions").insert({
                  product_id: prod.id, type: "adjustment",
                  quantity: newQty - prod.stock_quantity,
                  previous_stock: prod.stock_quantity, new_stock: newQty,
                  reference_type: "csv_import",
                });
              }
              const { error } = await supabase.from("products").update(patch).eq("id", prod.id);
              if (error) { failed++; continue; }
              updated++;
            } else {
              const name = strVal(cols, col.name);
              if (!name) { failed++; continue; }
              const initQty = numVal(cols, col.qty, (s) => parseInt(s, 10)) ?? 0;
              const newProd: Record<string, unknown> = {
                name,
                slug: `${slugify(name)}-${Math.random().toString(36).substring(2, 6)}`,
                sku,
                stock_quantity: initQty,
                minimum_stock: numVal(cols, col.min_stock, (s) => parseInt(s, 10)) ?? 5,
                cost_price:    numVal(cols, col.cost,  parseFloat) ?? 0,
                selling_price: numVal(cols, col.price, parseFloat) ?? 0,
                unit:          strVal(cols, col.unit) ?? "piece",
                is_active:     true,
              };
              const bar  = strVal(cols, col.barcode);
              newProd.barcode = bar || await generateUniqueBarcode(supabase, usedBarcodes);
              const desc = strVal(cols, col.description); if (desc) newProd.description = desc;
              if (cat) newProd.category_id = cat;

              const { data: created_prod, error } = await supabase
                .from("products").insert(newProd).select("id, sku").single();
              if (error || !created_prod) { failed++; continue; }

              try { await generateQR(created_prod.id, created_prod.sku); } catch { /* non-fatal */ }

              if (initQty > 0) {
                await supabase.from("inventory_transactions").insert({
                  product_id: created_prod.id, type: "adjustment",
                  quantity: initQty, previous_stock: 0, new_stock: initQty,
                  reference_type: "csv_import",
                });
              }
              created++;
            }
          }
        }

        const mode = isVariantImport ? " (variant mode)" : "";
        const parts = [
          updated > 0 && `${updated} updated`,
          created > 0 && `${created} created`,
          failed  > 0 && `${failed} skipped`,
        ].filter(Boolean).join(", ");
        toast.success(`Import complete${mode}: ${parts}`);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    },
    [supabase, queryClient]
  );

  // ─────────────────────────────────────────────────────────────────────────────

  const stockLabels = {
    good:     t.inventory.inStock,
    low:      t.inventory.lowStock,
    critical: t.inventory.critical,
    out:      t.inventory.outOfStock,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.inventory.title} description={t.inventory.description}>
        <Button
          variant="outline"
          size="sm"
          disabled={isImporting}
          onClick={() => csvInputRef.current?.click()}
        >
          {isImporting
            ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{t.inventory.importing}</>
            : <><Upload className="me-2 h-4 w-4" />{t.inventory.importCsv}</>
          }
        </Button>
        <input
          title="import"
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImport}
        />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="me-2 h-4 w-4" />
          {t.inventory.exportCsv}
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute inset-s-2.5 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            className="ps-8"
            placeholder={t.inventory.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t.inventory.allCategories} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.inventory.allCategories}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t.inventory.stockStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.inventory.allStatuses}</SelectItem>
            <SelectItem value="good">{t.inventory.inStock}</SelectItem>
            <SelectItem value="low">{t.inventory.lowStock}</SelectItem>
            <SelectItem value="critical">{t.inventory.critical}</SelectItem>
            <SelectItem value="out">{t.inventory.outOfStock}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["good", "low", "critical", "out"] as const).map((s) => {
          const count = products.filter(
            (p) => getStockStatus(p.stock_quantity, p.minimum_stock) === s
          ).length;
          const colors = {
            good: "text-emerald-600",
            low: "text-amber-600",
            critical: "text-orange-600",
            out: "text-red-600",
          };
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStockFilter(stockFilter === s ? "all" : s)}
              className={`rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-start transition-colors hover:bg-[hsl(var(--accent))] ${stockFilter === s ? "ring-2 ring-[hsl(var(--ring))]" : ""}`}
            >
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{stockLabels[s]}</p>
              <p className={`mt-1 text-2xl font-bold ${colors[s]}`}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.inventory.columns.sku}</TableHead>
              <TableHead>{t.inventory.columns.product}</TableHead>
              <TableHead>{t.inventory.columns.category}</TableHead>
              <TableHead>{t.inventory.columns.stockLevel}</TableHead>
              <TableHead>{t.inventory.columns.minStock}</TableHead>
              <TableHead>{t.inventory.columns.status}</TableHead>
              <TableHead>{t.inventory.columns.price}</TableHead>
              <TableHead className="text-end">{t.inventory.columns.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-[hsl(var(--muted-foreground))]">{t.inventory.noProducts}</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((product) => {
                const status = getStockStatus(product.stock_quantity, product.minimum_stock);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                      {product.sku}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge variant="secondary">{product.category.name}</Badge>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StockBar
                        quantity={product.stock_quantity}
                        minimum={product.minimum_stock}
                      />
                    </TableCell>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">
                      {product.minimum_stock}
                    </TableCell>
                    <TableCell>
                      <StockBadge status={status} />
                    </TableCell>
                    <TableCell>{formatCurrency(product.selling_price)}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Print Barcode Label"
                          onClick={() => setPrintTarget(product)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAdjustProduct(product);
                            setAdjustForm({ mode: "add", quantity: "", reason: "", type: "adjustment" });
                          }}
                        >
                          {t.inventory.adjust}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Print label */}
      <PrintLabelDialog
        product={printTarget}
        open={!!printTarget}
        onClose={() => setPrintTarget(null)}
      />

      {/* Adjust Dialog */}
      <Dialog open={!!adjustProduct} onOpenChange={(o) => !o && setAdjustProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.inventory.adjustTitle}</DialogTitle>
            <DialogDescription>
              {adjustProduct?.name} — {t.inventory.currentStock} {adjustProduct?.stock_quantity}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex rounded-lg border border-[hsl(var(--border))] p-1 gap-1">
              {(["add", "subtract"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAdjustForm((f) => ({ ...f, mode: m }))}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    adjustForm.mode === m
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "hover:bg-[hsl(var(--accent))]"
                  }`}
                >
                  {m === "add" ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {m === "add" ? t.inventory.addStock : t.inventory.removeStock}
                </button>
              ))}
            </div>

            <div className="grid gap-2">
              <Label>{t.inventory.quantity}</Label>
              <Input
                type="number"
                min="1"
                placeholder={t.inventory.enterQuantity}
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              {adjustProduct && adjustForm.quantity && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t.inventory.newStock}{" "}
                  <span className="font-semibold">
                    {Math.max(
                      0,
                      adjustProduct.stock_quantity +
                        (adjustForm.mode === "add" ? 1 : -1) *
                          (parseInt(adjustForm.quantity) || 0)
                    )}
                  </span>
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>{t.inventory.transactionType}</Label>
              <Select
                value={adjustForm.type}
                onValueChange={(v) =>
                  setAdjustForm((f) => ({ ...f, type: v as InventoryTransactionType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">{t.inventory.transactionTypes.adjustment}</SelectItem>
                  <SelectItem value="purchase">{t.inventory.transactionTypes.purchase}</SelectItem>
                  <SelectItem value="return">{t.inventory.transactionTypes.return}</SelectItem>
                  <SelectItem value="transfer">{t.inventory.transactionTypes.transfer}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{t.inventory.reason}</Label>
              <Textarea
                placeholder={t.inventory.reasonPlaceholder}
                rows={2}
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustProduct(null)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => adjustMutation.mutate()}
              disabled={!adjustForm.quantity || adjustMutation.isPending}
            >
              {adjustMutation.isPending ? t.common.saving : t.inventory.confirmAdjustment}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
