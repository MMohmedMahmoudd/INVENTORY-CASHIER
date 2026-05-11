"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  Download,
  Printer,
  QrCode,
  Search,
  CheckSquare,
  Square,
  Package,
  Loader2,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateQR = async (value: string): Promise<string> => {
  return await QRCode.toDataURL(value, {
    width: 256,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
};

const qrValue = (product: Product): string =>
  JSON.stringify({ type: "product", id: product.id, sku: product.sku });

const downloadQR = (dataUrl: string, filename: string) => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductWithQR {
  product: Product;
  qrDataUrl: string | null;
  generating: boolean;
}

// ─── QR Card ──────────────────────────────────────────────────────────────────

function QRCard({
  item,
  selected,
  onSelect,
  onDownload,
}: {
  item: ProductWithQR;
  selected: boolean;
  onSelect: (id: string) => void;
  onDownload: (item: ProductWithQR) => void;
}) {
  const t = useT();
  const { product, qrDataUrl, generating } = item;

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-xl border bg-[hsl(var(--card))] p-4 shadow-sm transition-all",
        selected
          ? "border-blue-500 ring-2 ring-blue-500/20"
          : "border-[hsl(var(--border))] hover:border-blue-300"
      )}
    >
      <button
        onClick={() => onSelect(product.id)}
        className="absolute inset-s-3 top-3 z-10 text-[hsl(var(--muted-foreground))] hover:text-blue-500"
        aria-label={selected ? t.qr.deselectAll : t.qr.selectAll}
      >
        {selected ? (
          <CheckSquare className="h-5 w-5 text-blue-500" />
        ) : (
          <Square className="h-5 w-5" />
        )}
      </button>

      <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full rounded-lg object-cover"
          />
        ) : (
          <Package className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        )}
      </div>

      <div className="w-full text-center">
        <p
          className="truncate text-sm font-semibold text-[hsl(var(--foreground))]"
          title={product.name}
        >
          {product.name}
        </p>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
          {product.sku}
        </p>
      </div>

      <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-white p-1 shadow-inner">
        {generating ? (
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        ) : qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`QR for ${product.name}`}
            className="h-full w-full"
          />
        ) : (
          <ImageOff className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        )}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full text-xs"
        disabled={!qrDataUrl}
        onClick={() => onDownload(item)}
      >
        <Download className="me-1.5 h-3.5 w-3.5" />
        {t.qr.downloadPng}
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QRGeneratorPage() {
  const supabase = createClient();
  const t = useT();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const generateForProducts = useCallback(
    async (prods: Product[]) => {
      const toGenerate = prods.filter((p) => !qrMap.has(p.id));
      if (toGenerate.length === 0) return;

      setGeneratingIds((prev) => {
        const next = new Set(prev);
        toGenerate.forEach((p) => next.add(p.id));
        return next;
      });

      await Promise.all(
        toGenerate.map(async (p) => {
          try {
            const dataUrl = await generateQR(qrValue(p));
            setQrMap((prev) => new Map(prev).set(p.id, dataUrl));
          } catch {
            // leave as missing
          } finally {
            setGeneratingIds((prev) => {
              const next = new Set(prev);
              next.delete(p.id);
              return next;
            });
          }
        })
      );
    },
    [qrMap]
  );

  useEffect(() => {
    if (filtered.length > 0) {
      generateForProducts(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length, products.length]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () =>
    setSelectedIds(new Set(filtered.map((p) => p.id)));

  const clearSelection = () => setSelectedIds(new Set());

  const allSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const handleDownload = (item: ProductWithQR) => {
    if (!item.qrDataUrl) return;
    downloadQR(item.qrDataUrl, `qr-${item.product.sku}.png`);
  };

  const handleBulkDownload = async () => {
    const selected = filtered.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) {
      toast.error(t.qr.noSelected);
      return;
    }
    toast.info(`Downloading ${selected.length} QR codes...`);
    for (const p of selected) {
      const dataUrl = qrMap.get(p.id);
      if (dataUrl) {
        downloadQR(dataUrl, `qr-${p.sku}.png`);
        await new Promise((r) => setTimeout(r, 120));
      }
    }
    toast.success(t.qr.downloadComplete);
  };

  const handlePrint = () => {
    const selected = filtered.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) {
      toast.error(t.qr.noSelected);
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes — InvenPOS</title>
        <style>
          body { margin: 0; font-family: sans-serif; }
          .grid { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }
          .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; width: 160px; text-align: center; page-break-inside: avoid; }
          .card img { width: 128px; height: 128px; }
          .name { font-size: 12px; font-weight: 600; margin: 6px 0 2px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .sku { font-size: 11px; color: #6b7280; }
          @media print { @page { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="grid">
          ${selected
            .map((p) => {
              const dataUrl = qrMap.get(p.id) ?? "";
              return `
              <div class="card">
                <img src="${dataUrl}" alt="${p.name}" />
                <div class="name">${p.name}</div>
                <div class="sku">${p.sku}</div>
              </div>`;
            })
            .join("")}
        </div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const items: ProductWithQR[] = filtered.map((p) => ({
    product: p,
    qrDataUrl: qrMap.get(p.id) ?? null,
    generating: generatingIds.has(p.id),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
            <QrCode className="h-6 w-6 text-blue-500" />
            {t.qr.generatorTitle}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {t.qr.generatorDesc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {selectedIds.size} {t.qr.selected}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={allSelected ? clearSelection : selectAll}
          >
            {allSelected ? t.qr.deselectAll : t.qr.selectAll}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDownload}
            disabled={selectedIds.size === 0}
          >
            <Download className="me-1.5 h-4 w-4" />
            {t.qr.downloadSelected}
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={selectedIds.size === 0}
          >
            <Printer className="me-1.5 h-4 w-4" />
            {t.qr.printSelected}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder={t.inventory.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Stats row */}
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        {t.qr.showing} {filtered.length} {t.qr.of} {products.length} {t.qr.products}
      </p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-4">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-32 rounded" />
              <Skeleton className="h-8 w-full rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] py-20 text-center">
          <QrCode className="mb-3 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            {search ? t.qr.noMatch : t.qr.noProducts}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <QRCard
              key={item.product.id}
              item={item}
              selected={selectedIds.has(item.product.id)}
              onSelect={toggleSelect}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
