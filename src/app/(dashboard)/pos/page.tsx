"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ScanLine,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Wallet,
  Banknote,
  Printer,
  X,
  ChevronDown,
  ChevronRight,
  Tag,
  Package,
  CheckCircle2,
  Keyboard,
  ReceiptText,
  UserPlus,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";

import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/store/cart-store";
import { useT } from "@/lib/i18n";
import { formatCurrency, formatDateTime, generateInvoiceNumber, getStockStatus, getInitials, cn } from "@/lib/utils";
import { TAX_RATE } from "@/lib/constants";
import type { Product, ProductVariant, Category, Customer, Sale, CartItem, PaymentMethod } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReceiptSale = Omit<Sale, "items"> & {
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

// ─── Variant Picker Modal ─────────────────────────────────────────────────────

interface VariantPickerModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, variant: ProductVariant) => void;
}

function VariantPickerModal({ product, open, onClose, onAdd }: VariantPickerModalProps) {
  const t = useT();
  const variants = React.useMemo(
    () => (product?.variants ?? []).filter((v) => v.is_active),
    [product]
  );

  const [selSize, setSelSize] = useState<string | null>(null);
  const [selColor, setSelColor] = useState<string | null>(null);
  const [selStyle, setSelStyle] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  // Reset selections when the modal opens or when the product changes.
  // Pattern: track last-seen session key; when it differs, update during render
  // so React batches the reset without a separate effect render cycle.
  const [prevSessionKey, setPrevSessionKey] = useState<string | null>(null);
  const sessionKey = open ? (product?.id ?? "unknown") : null;
  if (sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey);
    if (open) {
      setSelSize(null);
      setSelColor(null);
      setSelStyle(null);
      setQty(1);
    }
  }

  // Derive unique attribute lists present in variants
  const allSizes  = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))]  as string[], [variants]);
  const allColors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const allStyles = useMemo(() => [...new Set(variants.map((v) => v.style).filter(Boolean))] as string[], [variants]);

  // A variant is "reachable" if it matches all currently-selected attributes
  const matches = useCallback(
    (v: ProductVariant) =>
      (!selSize  || v.size  === selSize)  &&
      (!selColor || v.color === selColor) &&
      (!selStyle || v.style === selStyle),
    [selSize, selColor, selStyle]
  );

  // Whether a specific option is available (has stock) given the other two selections
  const sizeAvail  = (s: string)  => variants.some((v) => v.size  === s && (!selColor || v.color === selColor) && (!selStyle || v.style === selStyle) && v.stock_quantity > 0);
  const colorAvail = (c: string)  => variants.some((v) => v.color === c && (!selSize  || v.size  === selSize)  && (!selStyle || v.style === selStyle) && v.stock_quantity > 0);
  const styleAvail = (s: string)  => variants.some((v) => v.style === s && (!selSize  || v.size  === selSize)  && (!selColor || v.color === selColor) && v.stock_quantity > 0);

  const matchingVariants = variants.filter(matches);
  const exactVariant     = matchingVariants.length === 1 ? matchingVariants[0] : null;

  const selectionComplete =
    (allSizes.length  === 0 || selSize  !== null) &&
    (allColors.length === 0 || selColor !== null) &&
    (allStyles.length === 0 || selStyle !== null);

  const selectedVariant = selectionComplete ? exactVariant : null;
  const price = selectedVariant?.selling_price ?? product?.selling_price ?? 0;
  const stock = selectedVariant?.stock_quantity ?? 0;

  const handleAdd = () => {
    if (!product || !selectedVariant) return;
    onAdd(product, qty, selectedVariant);
    onClose();
  };

  const labelFor = (v: ProductVariant) =>
    [v.size, v.color, v.style].filter(Boolean).join(" · ") || v.sku;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            {product?.name ?? t.pos.selectVariant}
          </DialogTitle>
          <DialogDescription>{t.pos.chooseSizeColorStyle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Size */}
          {allSizes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t.pos.size}</p>
              <div className="flex flex-wrap gap-2">
                {allSizes.map((s) => {
                  const avail = sizeAvail(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!avail}
                      onClick={() => setSelSize((prev) => (prev === s ? null : s))}
                      className={cn(
                        "min-w-10 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all",
                        selSize === s
                          ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                          : avail
                          ? "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-blue-400"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] opacity-40 cursor-not-allowed line-through"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color */}
          {allColors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t.pos.color}</p>
              <div className="flex flex-wrap gap-2">
                {allColors.map((c) => {
                  const avail = colorAvail(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={!avail}
                      onClick={() => setSelColor((prev) => (prev === c ? null : c))}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                        selColor === c
                          ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                          : avail
                          ? "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-blue-400"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] opacity-40 cursor-not-allowed"
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Style */}
          {allStyles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t.pos.style}</p>
              <div className="flex flex-wrap gap-2">
                {allStyles.map((s) => {
                  const avail = styleAvail(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!avail}
                      onClick={() => setSelStyle((prev) => (prev === s ? null : s))}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                        selStyle === s
                          ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                          : avail
                          ? "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-blue-400"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] opacity-40 cursor-not-allowed"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* If no attributes defined, show variant cards directly */}
          {allSizes.length === 0 && allColors.length === 0 && allStyles.length === 0 && (
            <div className="space-y-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  disabled={v.stock_quantity === 0}
                  onClick={() => { setSelSize(v.size); setSelColor(v.color); setSelStyle(v.style); }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all",
                    exactVariant?.id === v.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                      : v.stock_quantity > 0
                      ? "border-[hsl(var(--border))] hover:border-blue-400"
                      : "border-[hsl(var(--border))] opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="font-medium">{labelFor(v)}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {v.stock_quantity > 0 ? `${v.stock_quantity} ${t.pos.inStock}` : t.pos.outOfStock}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected variant summary */}
          {selectedVariant && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{labelFor(selectedVariant)}</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                    SKU: {selectedVariant.sku} · {stock} {t.pos.inStock}
                  </p>
                </div>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(price)}</p>
              </div>
            </div>
          )}

          {/* Qty + Add */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1">
              <button
                type="button"
                title="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[hsl(var(--accent))]"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                title="Increase quantity"
                onClick={() => setQty((q) => Math.min(stock || 99, q + 1))}
                disabled={!selectedVariant}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[hsl(var(--accent))] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              disabled={!selectedVariant || stock === 0}
              onClick={handleAdd}
            >
              <ShoppingCart className="h-4 w-4" />
              {t.pos.addToCart}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Product skeleton card ──
function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 flex flex-col gap-2">
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center justify-between mt-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
}

// ── Product card ──
interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  isInCart: boolean;
  cartQty: number;
}

function ProductCard({ product, onAdd, isInCart, cartQty }: ProductCardProps) {
  const t = useT();
  const stockStatus = getStockStatus(product.stock_quantity, product.minimum_stock);
  const outOfStock = stockStatus === "out";

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-[hsl(var(--card))] text-left",
        "transition-all duration-150 overflow-hidden",
        outOfStock
          ? "opacity-50 cursor-not-allowed border-[hsl(var(--border))]"
          : "cursor-pointer hover:border-blue-500 hover:shadow-md hover:shadow-blue-500/10 active:scale-[0.98] border-[hsl(var(--border))]"
      )}
    >
      {/* Cart badge */}
      {isInCart && (
        <span className="absolute top-2 inset-e-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow">
          {cartQty}
        </span>
      )}

      {/* Image / placeholder */}
      <div className="relative h-24 w-full shrink-0 overflow-hidden bg-[hsl(var(--muted))]">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-8 w-8 text-[hsl(var(--muted-foreground))] opacity-40" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              {t.pos.outOfStock}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-[hsl(var(--foreground))]">
          {product.name}
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{product.sku}</p>

        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-blue-600">
            {formatCurrency(product.selling_price)}
          </span>
          <StockBadge status={stockStatus} qty={product.stock_quantity} />
        </div>
      </div>

      {/* Hover overlay: add to cart / select variant */}
      {!outOfStock && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <span className="rounded-lg bg-blue-600/90 px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
            {(product.variants ?? []).some((v) => v.is_active) ? t.pos.selectSizeColor : `+ ${t.pos.addToCart}`}
          </span>
        </div>
      )}
    </button>
  );
}

// ── Stock badge ──
function StockBadge({ status, qty }: { status: "good" | "low" | "critical" | "out"; qty: number }) {
  const t = useT();
  if (status === "out") return <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{t.pos.outShort}</Badge>;
  if (status === "critical") return <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{qty} {t.pos.stockLeft}</Badge>;
  if (status === "low") return <Badge variant="warning" className="text-[9px] px-1.5 py-0">{qty} {t.pos.stockLeft}</Badge>;
  return <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{qty}</Badge>;
}

// ── Cart line item ──
interface CartLineProps {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}

function CartLine({ item, onIncrease, onDecrease, onRemove }: CartLineProps) {
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[hsl(var(--accent))]">
      {/* Product name + variant + price per unit */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium leading-tight text-[hsl(var(--foreground))]">
          {item.product.name}
        </p>
        {item.variant && (
          <p className="truncate text-xs font-medium text-blue-500">
            {[item.variant.size, item.variant.color, item.variant.style].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {formatCurrency(item.unit_price)} / {item.product.unit}
        </p>
      </div>

      {/* Qty controls */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          title="Decrease quantity"
          onClick={onDecrease}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] transition-colors hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 dark:hover:bg-blue-950"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">
          {item.quantity}
        </span>
        <button
          title="Increase quantity"
          onClick={onIncrease}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] transition-colors hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 dark:hover:bg-blue-950"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Line total */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="w-16 text-end text-sm font-semibold tabular-nums">
          {formatCurrency(item.total)}
        </span>
        <button
          title="remove"
          onClick={onRemove}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Customer combobox ──
interface CustomerSelectorProps {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
}

function CustomerSelector({ customers, selected, onSelect }: CustomerSelectorProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      search.trim()
        ? customers.filter(
            (c) =>
              c.name.toLowerCase().includes(search.toLowerCase()) ||
              c.phone?.includes(search) ||
              c.email?.toLowerCase().includes(search.toLowerCase())
          )
        : customers.slice(0, 8),
    [customers, search]
  );

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
          "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-blue-400",
          open && "border-blue-500 ring-2 ring-blue-500/20"
        )}
      >
        {selected ? (
          <>
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {getInitials(selected.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-start font-medium">{selected.name}</span>
            <button
              title="Clear selection"
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="ms-auto rounded-full p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <User className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
            <span className="flex-1 text-start text-[hsl(var(--muted-foreground))]">{t.pos.walkInCustomer}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-xl">
          <div className="border-b border-[hsl(var(--border))] p-2">
            <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.pos.searchCustomers}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {/* Walk-in option */}
            <button
              onClick={() => { onSelect(null); setOpen(false); setSearch(""); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))]"
            >
              <UserPlus className="h-4 w-4" />
              {t.pos.walkInCustomer}
            </button>
            <Separator />

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
                {t.pos.noCustomersFound}
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); setOpen(false); setSearch(""); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[hsl(var(--accent))]",
                    selected?.id === c.id && "bg-blue-50 dark:bg-blue-950/50"
                  )}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {getInitials(c.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-start">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.phone && <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{c.phone}</p>}
                  </div>
                  {selected?.id === c.id && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Receipt Modal ──
interface ReceiptModalProps {
  sale: ReceiptSale | null;
  open: boolean;
  onClose: () => void;
}

function ReceiptModal({ sale, open, onClose }: ReceiptModalProps) {
  const t = useT();
  const handlePrint = () => {
    if (!sale) return;
    const win = window.open("", "_blank", "width=420,height=700,scrollbars=yes");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups for this site."); return; }

    const itemRows = sale.items.map((item) => `
      <tr>
        <td style="padding:3px 0;vertical-align:top">${item.product_name}</td>
        <td style="padding:3px 4px;text-align:center;vertical-align:top;white-space:nowrap">${item.quantity}</td>
        <td style="padding:3px 0;text-align:right;vertical-align:top;white-space:nowrap">${formatCurrency(item.unit_price)}</td>
        <td style="padding:3px 0 3px 8px;text-align:right;vertical-align:top;white-space:nowrap;font-weight:600">${formatCurrency(item.total)}</td>
      </tr>`).join("");

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Receipt ${sale.invoice_number}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;background:#fff;padding:16px;width:320px;margin:0 auto}
        .center{text-align:center}
        .dashed{border:none;border-top:1px dashed #555;margin:8px 0}
        .solid{border:none;border-top:2px solid #000;margin:8px 0}
        table{width:100%;border-collapse:collapse}
        .th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#444;padding-bottom:4px}
        .total-row td{font-size:14px;font-weight:700;padding-top:6px}
        .footer{text-align:center;font-size:10px;color:#555;margin-top:6px;line-height:1.6}
        @media print{@page{size:80mm auto;margin:0}body{padding:8px}}
      </style>
    </head><body>
      <div class="center" style="margin-bottom:10px">
        <div style="font-size:20px;font-weight:700;letter-spacing:.1em">InvenPOS</div>
        <div style="font-size:10px;color:#555;margin-top:2px">Point of Sale Receipt</div>
      </div>
      <hr class="solid"/>
      <table style="margin-bottom:6px">
        <tr><td style="color:#555">Invoice</td><td style="text-align:right;font-weight:600">${sale.invoice_number}</td></tr>
        <tr><td style="color:#555">Date</td><td style="text-align:right">${formatDateTime(sale.created_at)}</td></tr>
        ${sale.customer ? `<tr><td style="color:#555">Customer</td><td style="text-align:right">${sale.customer.name}</td></tr>` : ""}
        <tr><td style="color:#555">Payment</td><td style="text-align:right;font-weight:600;text-transform:uppercase">${sale.payment_method}</td></tr>
      </table>
      <hr class="dashed"/>
      <table>
        <thead>
          <tr class="th">
            <td>Item</td>
            <td style="text-align:center">Qty</td>
            <td style="text-align:right">Price</td>
            <td style="text-align:right;padding-left:8px">Total</td>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <hr class="dashed"/>
      <table style="margin-bottom:4px">
        <tr><td style="color:#555">Subtotal</td><td style="text-align:right">${formatCurrency(sale.subtotal)}</td></tr>
        <tr><td style="color:#555">Tax (${(TAX_RATE * 100).toFixed(0)}%)</td><td style="text-align:right">${formatCurrency(sale.tax)}</td></tr>
        ${sale.discount > 0 ? `<tr><td style="color:#555">Discount</td><td style="text-align:right">-${formatCurrency(sale.discount)}</td></tr>` : ""}
      </table>
      <hr class="solid"/>
      <table style="margin-bottom:8px">
        <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${formatCurrency(sale.total)}</td></tr>
      </table>
      <hr class="dashed"/>
      <div class="footer">
        <div>★ Thank you for your purchase! ★</div>
        <div>Please come again</div>
      </div>
    </body></html>`);

    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            {t.pos.paymentSuccessful}
          </DialogTitle>
          <DialogDescription>
            {sale ? `Invoice ${sale.invoice_number} has been processed.` : t.pos.processingReceipt}
          </DialogDescription>
        </DialogHeader>

        {sale && (
          <>
            {/* Receipt preview */}
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-dashed border-[hsl(var(--border))] bg-white p-5 font-mono text-[12px] text-black dark:bg-white">

              {/* Store header */}
              <div className="mb-3 text-center">
                <p className="text-lg font-bold tracking-widest">InvenPOS</p>
                <p className="text-[10px] text-gray-500">Point of Sale Receipt</p>
              </div>

              <hr className="border-dashed border-gray-400 my-2" />

              {/* Meta */}
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between"><span className="text-gray-500">Invoice</span><span className="font-semibold">{sale.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{formatDateTime(sale.created_at)}</span></div>
                {sale.customer && <div className="flex justify-between"><span className="text-gray-500">Customer</span><span>{sale.customer.name}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Payment</span><span className="font-semibold uppercase">{sale.payment_method}</span></div>
              </div>

              <hr className="border-dashed border-gray-400 my-2" />

              {/* Items */}
              <div className="text-[10px] uppercase tracking-wider text-gray-400 flex mb-1">
                <span className="flex-1">Item</span><span className="w-7 text-center">Qty</span>
                <span className="w-14 text-right">Price</span><span className="w-14 text-right">Total</span>
              </div>
              <hr className="border-gray-300 my-1" />
              {sale.items.map((item, i) => (
                <div key={i} className="flex items-start py-0.5 text-[11px]">
                  <span className="flex-1 leading-snug">{item.product_name}</span>
                  <span className="w-7 text-center">{item.quantity}</span>
                  <span className="w-14 text-right tabular-nums">{formatCurrency(item.unit_price)}</span>
                  <span className="w-14 text-right tabular-nums font-semibold">{formatCurrency(item.total)}</span>
                </div>
              ))}

              <hr className="border-dashed border-gray-400 my-2" />

              {/* Totals */}
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">{formatCurrency(sale.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tax ({(TAX_RATE * 100).toFixed(0)}%)</span><span className="tabular-nums">{formatCurrency(sale.tax)}</span></div>
                {sale.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatCurrency(sale.discount)}</span></div>}
              </div>

              <hr className="border-black my-2 border-2" />
              <div className="flex justify-between text-sm font-bold">
                <span>TOTAL</span><span className="tabular-nums">{formatCurrency(sale.total)}</span>
              </div>

              <hr className="border-dashed border-gray-400 my-3" />
              <p className="text-center text-[10px] text-gray-500">★ Thank you for your purchase! ★</p>
              <p className="text-center text-[10px] text-gray-400">Please come again</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                {t.pos.printReceipt}
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={onClose}>
                {t.pos.newSale}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Keyboard shortcuts cheatsheet ──
function ShortcutsHint() {
  const t = useT();
  const shortcuts = [
    ["F1", t.pos.shortcuts.search],
    ["F2", t.pos.shortcuts.pay],
    ["Esc", t.pos.shortcuts.clearCart],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]">
      {shortcuts.map(([key, label]) => (
        <span key={key} className="flex items-center gap-1">
          <kbd className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[hsl(var(--foreground))]">
            {key}
          </kbd>
          {label}
        </span>
      ))}
    </div>
  );
}

// ── QR / Barcode Scanner Modal ────────────────────────────────────────────────

interface QRScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanned: (text: string) => void;
}

function QRScannerModal({ open, onClose, onScanned }: QRScannerModalProps) {
  const t = useT();
  type Phase = "loading" | "selecting" | "starting" | "scanning" | "error";
  const [phase, setPhase] = useState<Phase>("loading");
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const onScannedRef = useRef(onScanned);
  // Track open in a ref so async callbacks can read latest value without deps
  const openRef = useRef(open);
  useEffect(() => { onScannedRef.current = onScanned; }, [onScanned]);
  useEffect(() => { openRef.current = open; }, [open]);

  // Null the ref BEFORE calling stop() — prevents concurrent stop() calls from racing
  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try { await scanner.stop(); scanner.clear(); } catch { /* ignore transition errors */ }
  }, []);

  // Enumerate cameras each time the modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setPhase("loading");
      setError(null);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const list = await Html5Qrcode.getCameras();
        if (cancelled) return;
        setCameras(list);
        setPhase(list.length > 0 ? "selecting" : "error");
        if (list.length === 0) setError("No camera detected on this device.");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(
          /permission|denied|notallowed/i.test(msg)
            ? "Camera access denied. Please allow camera access in your browser settings."
            : "Could not detect cameras: " + msg
        );
        setPhase("error");
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); stopScanner(); };
  }, [open, stopScanner]);

  const startCamera = useCallback(async (cameraId: string) => {
    if (scannerRef.current) return; // already running
    setPhase("starting");
    // Give React a tick to render the overlay before html5-qrcode writes to the DOM
    await new Promise<void>((r) => setTimeout(r, 150));
    // If modal closed or another scanner started during the delay, bail
    if (!openRef.current || scannerRef.current) return;

    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-scanner-el");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        cameraId,
        { fps: 12, qrbox: { width: 240, height: 240 } },
        (text) => { if (openRef.current) onScannedRef.current(text); },
        () => undefined
      );
      // Only update state if this scanner is still the active one
      if (scannerRef.current === scanner && openRef.current) setPhase("scanning");
    } catch (err) {
      if (scannerRef.current === scanner) scannerRef.current = null;
      if (!openRef.current) return; // modal was closed during start — ignore
      const msg = err instanceof Error ? err.message : String(err);
      if (/transition/i.test(msg)) return; // cleanup raced us — not a real error
      setError("Could not start camera: " + msg);
      setPhase("error");
    }
  }, []); // openRef accessed via .current — no dep needed

  const changeCamera = useCallback(async () => {
    await stopScanner();
    setPhase("selecting");
  }, [stopScanner]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-blue-500" />
            {t.pos.scanQrBarcode}
          </DialogTitle>
          <DialogDescription>
            {phase === "scanning" ? t.pos.pointCamera : t.pos.selectCamera}
          </DialogDescription>
        </DialogHeader>

        {/* The #qr-scanner-el div must always be in the DOM for html5-qrcode.
            Non-scanning phases are covered by an absolutely-positioned overlay. */}
        <div className="relative min-h-70 overflow-hidden rounded-xl bg-black">
          <div id="qr-scanner-el" className="w-full" />

          {phase !== "scanning" && (
            <div className="absolute inset-0 flex flex-col rounded-xl bg-[hsl(var(--card))]">

              {/* Loading cameras */}
              {phase === "loading" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{t.pos.detectingCameras}</p>
                </div>
              )}

              {/* Camera starting */}
              {phase === "starting" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-black rounded-xl">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                  <p className="text-sm text-white/60">{t.pos.startingCamera}</p>
                </div>
              )}

              {/* Camera / device selection */}
              {phase === "selecting" && (
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {cameras.length} camera{cameras.length !== 1 ? "s" : ""} detected
                  </p>
                  <div className="flex flex-col gap-2">
                    {cameras.map((cam, i) => (
                      <button
                        key={cam.id}
                        onClick={() => startCamera(cam.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-start",
                          "transition-colors hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                          <ScanLine className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {cam.label || `Camera ${i + 1}`}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">{t.pos.clickToStart}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-[11px] text-[hsl(var(--muted-foreground))]">
                    {t.pos.phoneWebcamTip}
                  </p>
                </div>
              )}

              {/* Error */}
              {phase === "error" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* While scanning: "Change Camera" button floats over the feed */}
          {phase === "scanning" && (
            <button
              onClick={changeCamera}
              className="absolute inset-e-2 bottom-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/80"
            >
              {t.pos.changeCamera}
            </button>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={onClose}>
          {t.common.cancel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main POS Page ─────────────────────────────────────────────────────────────

export default function POSPage() {
  const t = useT();

  // ── PAYMENT_METHODS defined inside component to pick up translations ──
  const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: "cash", label: t.pos.paymentMethods.cash, icon: <Banknote className="h-4 w-4" /> },
    { value: "card", label: t.pos.paymentMethods.card, icon: <CreditCard className="h-4 w-4" /> },
    { value: "wallet", label: t.pos.paymentMethods.wallet, icon: <Wallet className="h-4 w-4" /> },
  ];

  // ── Cart store ──
  const items = useCartStore((s) => s.items);
  const customer = useCartStore((s) => s.customer);
  const subtotal = useCartStore((s) => s.subtotal);
  const tax = useCartStore((s) => s.tax);
  const discount = useCartStore((s) => s.discount);
  const total = useCartStore((s) => s.total);
  const paymentMethod = useCartStore((s) => s.payment_method);

  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const setDiscount = useCartStore((s) => s.setDiscount);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);
  const clearCart = useCartStore((s) => s.clearCart);

  // ── Local UI state ──
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [discountInput, setDiscountInput] = useState<string>("");
  const [receiptSale, setReceiptSale] = useState<ReceiptSale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // ── Data fetching ──
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(id, name, slug, description, created_at)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      // Fetch variants separately so a missing table never breaks the product list
      const { data: variantsData } = await supabase
        .from("product_variants")
        .select("*")
        .eq("is_active", true);

      const variantsByProduct = (variantsData ?? []).reduce<Record<string, import("@/types").ProductVariant[]>>(
        (acc, v) => { (acc[v.product_id] ??= []).push(v); return acc; },
        {}
      );

      return ((data ?? []) as Product[]).map((p) => ({
        ...p,
        variants: variantsByProduct[p.id] ?? [],
      }));
    },
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["pos-categories"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    staleTime: 60_000,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
    staleTime: 60_000,
  });

  // ── Filtered products ──
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category_id === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q) ||
          (p.qr_code ?? "").toLowerCase().includes(q) ||
          (p.variants ?? []).some(
            (v) =>
              v.sku.toLowerCase().includes(q) ||
              (v.barcode ?? "").toLowerCase().includes(q) ||
              (v.size ?? "").toLowerCase().includes(q) ||
              (v.color ?? "").toLowerCase().includes(q) ||
              (v.style ?? "").toLowerCase().includes(q)
          )
      );
    }
    return list;
  }, [products, selectedCategory, search]);

  // ── Cart lookup helpers ──
  const cartMap = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i.product.id, i.quantity));
    return m;
  }, [items]);

  // ── Process payment mutation ──
  const processSale = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error("Cart is empty");
      const supabase = createClient();
      const invoiceNumber = generateInvoiceNumber();

      // Insert sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          invoice_number: invoiceNumber,
          customer_id: customer?.id ?? null,
          subtotal,
          tax,
          discount,
          total,
          payment_method: paymentMethod,
          payment_status: "paid",
        })
        .select("*, customer:customers(*)")
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      const { error: itemsError } = await supabase.from("sale_items").insert(
        items.map((item) => ({
          sale_id: sale.id,
          product_id: item.product.id,
          variant_id: item.variant?.id ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        }))
      );
      if (itemsError) throw itemsError;

      // Build receipt payload (with product names inlined)
      const receiptItems = items.map((item) => ({
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }));

      return { ...sale, items: receiptItems } as ReceiptSale;
    },
    onSuccess: (sale) => {
      // Invalidate products to reflect stock changes
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      clearCart();
      setDiscountInput("");
      toast.success(`Sale ${sale.invoice_number} completed!`);
      setReceiptSale(sale);
      setReceiptOpen(true);
    },
    onError: (err: Error) => {
      toast.error(t.pos.paymentFailed + err.message);
    },
  });

  // ── Keyboard shortcuts ──
  const handleProcessPayment = useCallback(() => {
    if (items.length > 0 && !processSale.isPending) {
      processSale.mutate();
    }
  }, [items.length, processSale]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when inside an input/textarea/select (except our shortcuts)
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        handleProcessPayment();
        return;
      }
      if (e.key === "Escape" && !isInput) {
        e.preventDefault();
        if (items.length > 0) setClearConfirmOpen(true);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, handleProcessPayment]);

  // ── Open variant picker or add directly ──
  const handleProductAdd = useCallback((product: Product) => {
    const activeVariants = (product.variants ?? []).filter((v) => v.is_active);
    if (activeVariants.length > 0) {
      setVariantPickerProduct(product);
    } else {
      addItem(product);
      toast.success(`${product.name}`);
    }
  }, [addItem]);

  // ── QR scan handler ──
  const handleScan = useCallback((text: string) => {
    setScannerOpen(false);

    let product: Product | undefined;
    let matchedVariant: ProductVariant | undefined;

    // Our QR format: PRODUCT:{id}:{sku}
    if (text.startsWith("PRODUCT:")) {
      const productId = text.split(":")[1];
      product = products.find((p) => p.id === productId);
    }
    // Check variant barcode / SKU first (shoe box barcode)
    if (!product) {
      for (const p of products) {
        const v = (p.variants ?? []).find((v) => v.barcode === text || v.sku === text);
        if (v) { product = p; matchedVariant = v; break; }
      }
    }
    // Product-level barcode / SKU fallback
    if (!product) product = products.find((p) => p.barcode === text);
    if (!product) product = products.find((p) => p.sku === text);

    if (!product) { toast.error(t.pos.noProductForCode); return; }

    if (matchedVariant) {
      if (matchedVariant.stock_quantity === 0) { toast.error(`${product.name} — ${t.pos.outOfStock}`); return; }
      addItem(product, 1, matchedVariant);
      const label = [matchedVariant.size, matchedVariant.color, matchedVariant.style].filter(Boolean).join(" / ");
      toast.success(`${product.name}${label ? ` (${label})` : ""}`);
      return;
    }

    // Product with variants but no specific variant matched → open picker
    const activeVariants = (product.variants ?? []).filter((v) => v.is_active);
    if (activeVariants.length > 0) {
      setVariantPickerProduct(product);
      return;
    }

    if (getStockStatus(product.stock_quantity, product.minimum_stock) === "out") {
      toast.error(`${product.name} — ${t.pos.outOfStock}`);
      return;
    }
    addItem(product);
    toast.success(`${product.name}`);
  }, [products, addItem, t]);

  // ── Discount sync ──
  const handleDiscountBlur = () => {
    const val = parseFloat(discountInput);
    setDiscount(isNaN(val) || val < 0 ? 0 : val);
  };

  // ── Receipt close ──
  const handleReceiptClose = () => {
    setReceiptOpen(false);
    setReceiptSale(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Page wrapper — full viewport height minus header (64px) ── */}
      <div className="flex h-[calc(100vh-64px)] gap-0 overflow-hidden -m-4 sm:-m-6">

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* LEFT PANEL — Product catalog (60%)                                  */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="flex w-[60%] flex-col border-e border-[hsl(var(--border))] bg-[hsl(var(--background))]">

          {/* ── Top bar: search + scan ── */}
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
            <div className="relative flex-1">
              <Search className="absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.pos.searchPlaceholder}
                className="ps-9 pe-4 h-10 bg-[hsl(var(--background))] focus-visible:ring-blue-500"
              />
              {search && (
                <button
                  title="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute inset-e-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              title={t.pos.scanBarcode}
              className="h-10 w-10 shrink-0"
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="h-4 w-4" />
            </Button>
          </div>

          {/* ── Category filter chips ── */}
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5">
            <button
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              {t.pos.all}
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                selectedCategory === "all" ? "bg-white/20" : "bg-[hsl(var(--background))]"
              )}>
                {products.length}
              </span>
            </button>
            {categories.map((cat) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    selectedCategory === cat.id
                      ? "bg-blue-600 text-white shadow"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                  )}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {cat.name}
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                    selectedCategory === cat.id ? "bg-white/20" : "bg-[hsl(var(--background))]"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Product grid ── */}
          <div className="flex-1 overflow-y-auto p-4">
            {productsLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Package className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30" />
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">{t.pos.noProductsFound}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {search ? `${t.pos.noResultsFor} "${search}"` : t.pos.noProductsInCategory}
                  </p>
                </div>
                {search && (
                  <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                    {t.pos.clearSearch}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={handleProductAdd}
                    isInCart={cartMap.has(product.id)}
                    cartQty={cartMap.get(product.id) ?? 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Status bar ── */}
          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {filteredProducts.length} {t.qr.products}
            </p>
            <ShortcutsHint />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* RIGHT PANEL — Cart (40%)                                             */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="flex w-[40%] flex-col bg-[hsl(var(--card))]">

          {/* ── Cart header ── */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">
                {t.pos.cart}
              </h2>
              {items.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                  {items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            {items.length > 0 && (
              <button
                onClick={() => setClearConfirmOpen(true)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
              >
                <Trash2 className="h-3 w-3" />
                {t.pos.clear}
              </button>
            )}
          </div>

          {/* ── Customer selector ── */}
          <div className="border-b border-[hsl(var(--border))] px-4 py-3">
            <CustomerSelector
              customers={customers}
              selected={customer}
              onSelect={setCustomer}
            />
          </div>

          {/* ── Cart items list ── */}
          <div className="flex-1 overflow-hidden">
            {items.length === 0 ? (
              /* Empty state */
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--muted))]">
                  <ShoppingCart className="h-8 w-8 text-[hsl(var(--muted-foreground))] opacity-50" />
                </div>
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">{t.pos.cartEmpty}</p>
                  <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                    {t.pos.clickToAdd}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Keyboard className="h-3.5 w-3.5" />
                  {t.pos.pressF1} <kbd className="mx-1 rounded bg-[hsl(var(--background))] px-1.5 py-0.5 font-mono font-semibold text-[hsl(var(--foreground))]">F1</kbd> {t.pos.toSearch}
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="px-2 py-2">
                  {items.map((item) => {
                    const vid = item.variant?.id;
                    return (
                      <CartLine
                        key={`${item.product.id}:${vid ?? ""}`}
                        item={item}
                        onIncrease={() => updateQuantity(item.product.id, item.quantity + 1, vid)}
                        onDecrease={() => updateQuantity(item.product.id, item.quantity - 1, vid)}
                        onRemove={() => removeItem(item.product.id, vid)}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* ── Order summary ── */}
          <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 space-y-2.5">

            {/* Subtotal */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">{t.pos.subtotal}</span>
              <span className="tabular-nums font-medium">{formatCurrency(subtotal)}</span>
            </div>

            {/* Tax */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">
                {t.pos.tax} ({(TAX_RATE * 100).toFixed(0)}%)
              </span>
              <span className="tabular-nums font-medium">{formatCurrency(tax)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">{t.pos.discount}</span>
              <div className="flex items-center gap-1">
                <span className="text-[hsl(var(--muted-foreground))]">-$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  onBlur={handleDiscountBlur}
                  placeholder="0.00"
                  className={cn(
                    "w-20 rounded-md border bg-[hsl(var(--background))] px-2 py-1 text-end text-sm tabular-nums outline-none",
                    "border-[hsl(var(--border))] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                    "placeholder:text-[hsl(var(--muted-foreground))]"
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[hsl(var(--foreground))]">{t.pos.total}</span>
              <span className="text-xl font-extrabold tabular-nums text-blue-600">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* ── Payment method selector ── */}
          <div className="border-t border-[hsl(var(--border))] px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {t.pos.paymentMethod}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.value}
                  onClick={() => setPaymentMethod(pm.value)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg border py-2.5 text-xs font-semibold transition-all",
                    paymentMethod === pm.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/20 dark:bg-blue-950/50 dark:text-blue-400"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))]/30 hover:text-[hsl(var(--foreground))]"
                  )}
                >
                  {pm.icon}
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Process payment button ── */}
          <div className="border-t border-[hsl(var(--border))] p-4">
            <Button
              className={cn(
                "h-14 w-full rounded-xl text-base font-bold transition-all",
                items.length > 0
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-700/40"
                  : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
              )}
              disabled={items.length === 0 || processSale.isPending}
              onClick={() => processSale.mutate()}
            >
              {processSale.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.pos.processing}
                </>
              ) : (
                <>
                  <ReceiptText className="h-5 w-5" />
                  {t.pos.processPayment}
                  <span className="ms-auto rounded-md bg-white/20 px-2 py-0.5 text-xs font-medium">
                    F2
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Variant picker modal ── */}
      <VariantPickerModal
        product={variantPickerProduct}
        open={variantPickerProduct !== null}
        onClose={() => setVariantPickerProduct(null)}
        onAdd={(product, quantity, variant) => {
          addItem(product, quantity, variant);
          const label = [variant.size, variant.color, variant.style].filter(Boolean).join(" / ");
          toast.success(`${product.name}${label ? ` (${label})` : ""}`);
        }}
      />

      {/* ── QR / Barcode scanner modal ── */}
      <QRScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScan}
      />

      {/* ── Receipt modal ── */}
      <ReceiptModal
        sale={receiptSale}
        open={receiptOpen}
        onClose={handleReceiptClose}
      />

      {/* ── Clear cart confirmation ── */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--destructive))]">
              <AlertCircle className="h-5 w-5" />
              {t.pos.clearCartTitle}
            </DialogTitle>
            <DialogDescription>
              {t.pos.clearCartDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setClearConfirmOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                clearCart();
                setDiscountInput("");
                setClearConfirmOpen(false);
                toast.info(t.pos.cartCleared);
              }}
            >
              {t.pos.clearCart}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
