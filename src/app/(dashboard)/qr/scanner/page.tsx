"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Scan,
  Package,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Keyboard,
  Camera,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/store/cart-store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, getStockStatus } from "@/lib/utils";
import type { Product } from "@/types";

// ─── Stock status badge ───────────────────────────────────────────────────────

function StockBadge({ product }: { product: Product }) {
  const t = useT();
  const status = getStockStatus(product.stock_quantity, product.minimum_stock);
  const map = {
    good: { label: t.inventory.inStock, className: "bg-green-100 text-green-700 border-green-200" },
    low: { label: t.inventory.lowStock, className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    critical: { label: t.inventory.critical, className: "bg-orange-100 text-orange-700 border-orange-200" },
    out: { label: t.inventory.outOfStock, className: "bg-red-100 text-red-700 border-red-200" },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart: (product: Product) => void;
}) {
  const t = useT();
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Image */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <Package className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-[hsl(var(--foreground))]">
                {product.name}
              </h3>
              <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                SKU: {product.sku}
              </p>
            </div>
            <StockBadge product={product} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <div>
              <span className="text-[hsl(var(--muted-foreground))]">{t.qr.price}</span>
              <p className="font-semibold text-[hsl(var(--foreground))]">
                {formatCurrency(product.selling_price)}
              </p>
            </div>
            <div>
              <span className="text-[hsl(var(--muted-foreground))]">{t.qr.stock}</span>
              <p className="font-semibold text-[hsl(var(--foreground))]">
                {product.stock_quantity} {product.unit}
              </p>
            </div>
            {product.category && (
              <div>
                <span className="text-[hsl(var(--muted-foreground))]">{t.qr.category}</span>
                <p className="font-semibold text-[hsl(var(--foreground))]">
                  {product.category.name}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Button
              size="sm"
              onClick={() => onAddToCart(product)}
              disabled={product.stock_quantity === 0}
              className="w-full sm:w-auto"
            >
              <ShoppingCart className="me-2 h-4 w-4" />
              {t.qr.addToCartGotoPOS}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QRScannerPage() {
  const router = useRouter();
  const supabase = createClient();
  const addItem = useCartStore((s) => s.addItem);
  const t = useT();

  const [manualInput, setManualInput] = useState("");
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerInitialized = useRef(false);

  // ── Fetch product by ID ──
  const fetchById = async (id: string): Promise<Product | null> => {
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(*), supplier:suppliers(*)")
      .eq("id", id)
      .single();
    return data ?? null;
  };

  // ── Fetch product by SKU ──
  const fetchBySku = async (sku: string): Promise<Product | null> => {
    const { data } = await supabase
      .from("products")
      .select("*, category:categories(*), supplier:suppliers(*)")
      .or(`sku.eq.${sku},barcode.eq.${sku}`)
      .single();
    return data ?? null;
  };

  // ── Handle scan result ──
  const handleScan = async (value: string) => {
    if (loading) return;
    setLoading(true);
    setScanError(null);
    setScanSuccess(false);
    setScannedProduct(null);

    try {
      let product: Product | null = null;

      try {
        const parsed = JSON.parse(value);
        if (parsed?.type === "product" && parsed?.id) {
          product = await fetchById(parsed.id);
        } else if (parsed?.sku) {
          product = await fetchBySku(parsed.sku);
        }
      } catch {
        // Not JSON — treat as barcode/SKU
        product = await fetchBySku(value.trim());
      }

      if (product) {
        setScannedProduct(product);
        setScanSuccess(true);
        toast.success(`${product.name}`);
      } else {
        setScanError(t.qr.productNotFound);
        toast.error(t.qr.productNotFound);
      }
    } catch {
      setScanError(t.qr.lookupFailed);
      toast.error(t.qr.lookupFailed);
    } finally {
      setLoading(false);
    }
  };

  // ── Add to POS ──
  const handleAddToCart = (product: Product) => {
    addItem(product, 1);
    toast.success(`${product.name}`);
    router.push("/pos");
  };

  // ── Manual lookup ──
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualInput.trim();
    if (!val) return;
    handleScan(val);
    setManualInput("");
  };

  // ── Initialize scanner ──
  useEffect(() => {
    if (scannerInitialized.current) return;
    scannerInitialized.current = true;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render(
          (decodedText) => {
            handleScan(decodedText);
            scanner.clear().catch(() => {});
          },
          (error) => {
            console.warn("QR scan error:", error);
          }
        );

        scannerRef.current = scanner;
        setScannerReady(true);
      } catch (err) {
        console.error("Scanner init failed:", err);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewScan = () => {
    setScannedProduct(null);
    setScanError(null);
    setScanSuccess(false);

    // Re-initialize scanner
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    scannerInitialized.current = false;

    setTimeout(() => {
      if (scannerInitialized.current) return;
      scannerInitialized.current = true;
      try {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scanner.render(
          (decodedText) => {
            handleScan(decodedText);
            scanner.clear().catch(() => {});
          },
          (error) => console.warn(error)
        );
        scannerRef.current = scanner;
      } catch (err) {
        console.error(err);
      }
    }, 300);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
          <Scan className="h-6 w-6 text-blue-500" />
          {t.qr.scannerTitle}
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t.qr.scannerDesc}
        </p>
      </div>

      {/* Camera scanner */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Camera className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h2 className="font-medium text-[hsl(var(--foreground))]">{t.qr.cameraScanner}</h2>
        </div>

        {/* Scanner container — html5-qrcode injects into this div */}
        <div
          id="qr-reader"
          className="overflow-hidden rounded-lg"
          style={{ width: "100%" }}
        />

        {!scannerReady && (
          <p className="mt-2 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {t.qr.initializingCamera}
          </p>
        )}
      </div>

      {/* Manual input */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h2 className="font-medium text-[hsl(var(--foreground))]">{t.qr.manualEntry}</h2>
        </div>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="manual-input" className="sr-only">
              {t.qr.skuOrBarcode}
            </Label>
            <Input
              id="manual-input"
              placeholder={t.qr.enterSkuPlaceholder}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={loading || !manualInput.trim()}>
            {loading ? t.qr.lookingUp : t.qr.lookUp}
          </Button>
        </form>
      </div>

      {/* Status feedback */}
      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-blue-500" />
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {t.qr.lookingUpProduct}
          </span>
        </div>
      )}

      {scanError && !loading && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{t.qr.scanFailed}</p>
            <p className="mt-0.5 text-sm">{scanError}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              onClick={handleNewScan}
            >
              {t.qr.scanAgain}
            </Button>
          </div>
        </div>
      )}

      {scanSuccess && scannedProduct && !loading && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{t.qr.productFound}</span>
            <Badge className="ms-auto bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
              {t.qr.scanSuccessful}
            </Badge>
          </div>

          <ProductCard product={scannedProduct} onAddToCart={handleAddToCart} />

          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={handleNewScan}
          >
            {t.qr.scanAnother}
          </Button>
        </div>
      )}
    </div>
  );
}
