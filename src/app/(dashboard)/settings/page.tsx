"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Store,
  Monitor,
  Package,
  Receipt,
  Save,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS, UNITS } from "@/lib/constants";
import type { Json } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneralSettings {
  store_name: string;
  currency: string;
  timezone: string;
  language: string;
}

interface POSSettings {
  tax_rate: number;
  max_discount_percent: number;
  receipt_footer: string;
}

interface InventorySettings {
  low_stock_alert: number;
  default_unit: string;
}

interface ReceiptSettings {
  show_logo: boolean;
  show_barcode: boolean;
  footer_text: string;
}

type AllSettings = {
  general: GeneralSettings;
  pos: POSSettings;
  inventory: InventorySettings;
  receipt: ReceiptSettings;
};

const DEFAULTS: AllSettings = {
  general: {
    store_name: "InvenPOS Store",
    currency: "USD",
    timezone: "America/New_York",
    language: "en",
  },
  pos: {
    tax_rate: 10,
    max_discount_percent: 20,
    receipt_footer: "Thank you for your purchase!",
  },
  inventory: {
    low_stock_alert: 5,
    default_unit: "piece",
  },
  receipt: {
    show_logo: true,
    show_barcode: true,
    footer_text: "Thank you for shopping with us!",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSettings(rows: { key: string; value: Json }[]): AllSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    general: {
      ...(DEFAULTS.general),
      ...((map.get("general") as Partial<GeneralSettings>) ?? {}),
    },
    pos: {
      ...(DEFAULTS.pos),
      ...((map.get("pos") as Partial<POSSettings>) ?? {}),
    },
    inventory: {
      ...(DEFAULTS.inventory),
      ...((map.get("inventory") as Partial<InventorySettings>) ?? {}),
    },
    receipt: {
      ...(DEFAULTS.receipt),
      ...((map.get("receipt") as Partial<ReceiptSettings>) ?? {}),
    },
  };
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{title}</h3>
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm space-y-5">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
      <Label htmlFor={htmlFor} className="min-w-[180px] text-sm text-[hsl(var(--muted-foreground))]">
        {label}
      </Label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [settings, setSettings] = useState<AllSettings>(DEFAULTS);

  if (!hasPermission(PERMISSIONS.MANAGE_SETTINGS)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          Unauthorized
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          You don&apos;t have permission to manage settings.
        </p>
      </div>
    );
  }

  // Fetch settings
  const { isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value");
      if (error) throw error;
      const parsed = parseSettings(data ?? []);
      setSettings(parsed);
      return parsed;
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (tab: keyof AllSettings) => {
      const { error } = await supabase
        .from("settings")
        .upsert({ key: tab, value: settings[tab] as unknown as Json }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: (_, tab) => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success(`${tab.charAt(0).toUpperCase() + tab.slice(1)} settings saved`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    },
  });

  const updateGeneral = (patch: Partial<GeneralSettings>) =>
    setSettings((s) => ({ ...s, general: { ...s.general, ...patch } }));

  const updatePOS = (patch: Partial<POSSettings>) =>
    setSettings((s) => ({ ...s, pos: { ...s.pos, ...patch } }));

  const updateInventory = (patch: Partial<InventorySettings>) =>
    setSettings((s) => ({ ...s, inventory: { ...s.inventory, ...patch } }));

  const updateReceipt = (patch: Partial<ReceiptSettings>) =>
    setSettings((s) => ({ ...s, receipt: { ...s.receipt, ...patch } }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
          <Settings className="h-6 w-6 text-blue-500" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Configure your store preferences and system defaults
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="general" className="flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="pos" className="flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            POS
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="receipt" className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Receipt
          </TabsTrigger>
        </TabsList>

        {/* ── General ── */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <SettingSection title="Store Information">
            <Field label="Store Name" htmlFor="store-name">
              <Input
                id="store-name"
                value={settings.general.store_name}
                onChange={(e) => updateGeneral({ store_name: e.target.value })}
                disabled={isLoading}
              />
            </Field>

            <Field label="Currency" htmlFor="currency">
              <Select
                value={settings.general.currency}
                onValueChange={(v) => updateGeneral({ currency: v })}
                disabled={isLoading}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="GBP">GBP — British Pound</SelectItem>
                  <SelectItem value="EGP">EGP — Egyptian Pound</SelectItem>
                  <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                  <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                  <SelectItem value="JPY">JPY — Japanese Yen</SelectItem>
                  <SelectItem value="CAD">CAD — Canadian Dollar</SelectItem>
                  <SelectItem value="AUD">AUD — Australian Dollar</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Timezone" htmlFor="timezone">
              <Select
                value={settings.general.timezone}
                onValueChange={(v) => updateGeneral({ timezone: v })}
                disabled={isLoading}
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                  <SelectItem value="Africa/Cairo">Cairo (EET)</SelectItem>
                  <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                  <SelectItem value="Asia/Riyadh">Riyadh (AST)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Language" htmlFor="language">
              <Select
                value={settings.general.language}
                onValueChange={(v) => updateGeneral({ language: v })}
                disabled={isLoading}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </SettingSection>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate("general")}
              disabled={saveMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save General Settings"}
            </Button>
          </div>
        </TabsContent>

        {/* ── POS ── */}
        <TabsContent value="pos" className="mt-6 space-y-6">
          <SettingSection title="Tax & Discounts">
            <Field label="Tax Rate (%)" htmlFor="tax-rate">
              <Input
                id="tax-rate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settings.pos.tax_rate}
                onChange={(e) =>
                  updatePOS({ tax_rate: parseFloat(e.target.value) || 0 })
                }
                disabled={isLoading}
              />
            </Field>

            <Field label="Max Discount (%)" htmlFor="max-discount">
              <Input
                id="max-discount"
                type="number"
                min={0}
                max={100}
                step={1}
                value={settings.pos.max_discount_percent}
                onChange={(e) =>
                  updatePOS({
                    max_discount_percent: parseFloat(e.target.value) || 0,
                  })
                }
                disabled={isLoading}
              />
            </Field>
          </SettingSection>

          <SettingSection title="Receipt">
            <Field label="Receipt Footer" htmlFor="receipt-footer">
              <Textarea
                id="receipt-footer"
                rows={3}
                value={settings.pos.receipt_footer}
                onChange={(e) =>
                  updatePOS({ receipt_footer: e.target.value })
                }
                disabled={isLoading}
                placeholder="Message shown at the bottom of receipts"
              />
            </Field>
          </SettingSection>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate("pos")}
              disabled={saveMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save POS Settings"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Inventory ── */}
        <TabsContent value="inventory" className="mt-6 space-y-6">
          <SettingSection title="Stock Alerts">
            <Field label="Low Stock Alert Threshold" htmlFor="low-stock">
              <Input
                id="low-stock"
                type="number"
                min={1}
                value={settings.inventory.low_stock_alert}
                onChange={(e) =>
                  updateInventory({
                    low_stock_alert: parseInt(e.target.value) || 1,
                  })
                }
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Show alert when stock falls to or below this quantity
              </p>
            </Field>
          </SettingSection>

          <SettingSection title="Defaults">
            <Field label="Default Unit" htmlFor="default-unit">
              <Select
                value={settings.inventory.default_unit}
                onValueChange={(v) => updateInventory({ default_unit: v })}
                disabled={isLoading}
              >
                <SelectTrigger id="default-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </SettingSection>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate("inventory")}
              disabled={saveMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save Inventory Settings"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Receipt ── */}
        <TabsContent value="receipt" className="mt-6 space-y-6">
          <SettingSection title="Receipt Display Options">
            <Field label="Show Logo">
              <div className="flex items-center gap-3">
                <Switch
                  id="show-logo"
                  checked={settings.receipt.show_logo}
                  onCheckedChange={(v) => updateReceipt({ show_logo: v })}
                  disabled={isLoading}
                />
                <Label htmlFor="show-logo" className="text-sm font-normal text-[hsl(var(--foreground))]">
                  {settings.receipt.show_logo
                    ? "Logo visible on receipt"
                    : "Logo hidden"}
                </Label>
              </div>
            </Field>

            <Field label="Show Barcode">
              <div className="flex items-center gap-3">
                <Switch
                  id="show-barcode"
                  checked={settings.receipt.show_barcode}
                  onCheckedChange={(v) => updateReceipt({ show_barcode: v })}
                  disabled={isLoading}
                />
                <Label htmlFor="show-barcode" className="text-sm font-normal text-[hsl(var(--foreground))]">
                  {settings.receipt.show_barcode
                    ? "Barcode visible on receipt"
                    : "Barcode hidden"}
                </Label>
              </div>
            </Field>

            <Field label="Footer Text" htmlFor="footer-text">
              <Textarea
                id="footer-text"
                rows={3}
                value={settings.receipt.footer_text}
                onChange={(e) =>
                  updateReceipt({ footer_text: e.target.value })
                }
                disabled={isLoading}
                placeholder="Footer message printed on receipts"
              />
            </Field>
          </SettingSection>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate("receipt")}
              disabled={saveMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save Receipt Settings"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
