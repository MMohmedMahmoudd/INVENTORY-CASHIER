import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useUIStore } from "@/store/ui-store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency?: string): string {
  const curr = currency ?? (useUIStore.getState().currency ?? "USD");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateSKU(name: string): string {
  const prefix = name.slice(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${random}`;
}

export function generateBarcode(): string {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return ts + rand;
}

export function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${year}${month}${day}-${random}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function calculateTax(subtotal: number, taxRate = 0.1): number {
  return subtotal * taxRate;
}

export function calculateDiscount(subtotal: number, discountPercent: number): number {
  return subtotal * (discountPercent / 100);
}

export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvToBlob(rows: string[][]): Blob {
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function getStockStatus(quantity: number, minimum: number): "good" | "low" | "critical" | "out" {
  if (quantity === 0) return "out";
  if (quantity <= minimum * 0.5) return "critical";
  if (quantity <= minimum) return "low";
  return "good";
}
