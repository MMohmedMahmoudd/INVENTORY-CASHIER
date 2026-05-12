"use client";

import * as React from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { generateUniqueBarcode } from "@/lib/barcode";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types";

function isNumericBarcode(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function generateBarcodeDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    width: 2,
    height: 60,
    displayValue: true,
    text: value,
    fontOptions: "bold",
    fontSize: 14,
    textMargin: 4,
    margin: 6,
    background: "#ffffff",
    lineColor: "#000000",
  });
  return canvas.toDataURL("image/png");
}

function buildPrintHTML(
  product: Product,
  barcodeDataUrl: string,
  copies: number
): string {
  const escapedName = product.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const price = formatCurrency(product.selling_price);

  const label = `
    <div class="label">
      <p class="prod-name">${escapedName}</p>
      <img class="bc-img" src="${barcodeDataUrl}" alt="barcode" />
      <p class="price">${price}</p>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 57mm 40mm; margin: 1mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; color: #000; }
  .label {
    width: 55mm;
    height: 38mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.8mm;
    overflow: hidden;
    page-break-after: always;
  }
  .prod-name {
    font-size: 8pt;
    font-weight: bold;
    text-align: center;
    max-width: 53mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.2pt;
  }
  .bc-img { width: 52mm; height: auto; }
  .bc-value {
    font-size: 7pt;
    font-family: 'Courier New', monospace;
    letter-spacing: 1pt;
    text-align: center;
    color: #111;
  }
  .price { font-size: 8.5pt; font-weight: bold; text-align: center; color: #000; }
</style>
</head>
<body>
${label.repeat(copies)}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

// Tracks auto-generated barcodes keyed by product id so stale values aren't shown
interface AutoBarcode { productId: string; barcode: string; }

export function PrintLabelDialog({ product, open, onClose }: Props) {
  const [copies, setCopies] = React.useState(1);
  const [autoBarcode, setAutoBarcode] = React.useState<AutoBarcode | null>(null);

  // When the dialog opens for a product with a non-numeric barcode,
  // generate a numeric one async and persist it to the DB.
  React.useEffect(() => {
    if (!open || !product) return;
    const raw = (product.barcode ?? "").trim();
    if (isNumericBarcode(raw)) return; // already numeric, nothing to do

    const supabase = createClient();
    let cancelled = false;
    generateUniqueBarcode(supabase).then((code) => {
      if (cancelled) return;
      setAutoBarcode({ productId: product.id, barcode: code });
      // Persist silently — next open will find a numeric barcode in the DB
      supabase.from("products").update({ barcode: code }).eq("id", product.id);
    });
    return () => { cancelled = true; };
  }, [open, product]);

  // Effective barcode: numeric DB value, or freshly generated one
  const effectiveBarcode = React.useMemo(() => {
    if (!product) return "";
    const raw = (product.barcode ?? "").trim();
    if (isNumericBarcode(raw)) return raw;
    // Use auto-generated only if it belongs to this product
    if (autoBarcode?.productId === product.id) return autoBarcode.barcode;
    return ""; // still generating — show skeleton
  }, [product, autoBarcode]);

  const barcodeDataUrl = React.useMemo(() => {
    if (!effectiveBarcode || typeof document === "undefined") return "";
    try { return generateBarcodeDataUrl(effectiveBarcode); } catch { return ""; }
  }, [effectiveBarcode]);

  const handlePrint = () => {
    if (!product || !barcodeDataUrl || !effectiveBarcode) return;
    const html = buildPrintHTML(product, barcodeDataUrl, copies);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print Barcode Label
          </DialogTitle>
          <DialogDescription className="truncate">{product.name}</DialogDescription>
        </DialogHeader>

        {/* ── Label preview ── */}
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-[hsl(var(--border))] bg-white px-5 py-4">

          {/* 1 – Product Name */}
          <p className="max-w-55 truncate text-[11px] font-bold tracking-wide text-black">
            {product.name}
          </p>

          {/* 2 – Barcode bars */}
          {barcodeDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={barcodeDataUrl} alt="barcode" className="h-14 w-auto" />
          ) : (
            <div className="h-14 w-48 animate-pulse rounded bg-gray-200" />
          )}

          {/* 3 – Price */}
          <p className="text-[12px] font-bold text-black">
            {formatCurrency(product.selling_price)}
          </p>

          <p className="mt-1 text-[9px] text-gray-400">57 × 40 mm · CODE128</p>
        </div>

        {/* Copies */}
        <div className="flex items-center gap-3">
          <Label htmlFor="label-copies" className="shrink-0 text-sm">
            Copies
          </Label>
          <Input
            id="label-copies"
            type="number"
            min={1}
            max={100}
            value={copies}
            onChange={(e) =>
              setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))
            }
            className="w-20"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={!barcodeDataUrl}>
            <Printer className="me-2 h-4 w-4" />
            Print{copies > 1 ? ` (${copies})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
