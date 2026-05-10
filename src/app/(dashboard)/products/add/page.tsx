"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/client";
import { slugify, generateSKU } from "@/lib/utils";
import type { Category, Supplier } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";

// ─── Variant row type ─────────────────────────────────────────────────────────

interface VariantRow {
  size: string;
  color: string;
  style: string;
  sku: string;
  barcode: string;
  stock: string;
  cost: string;
  selling: string;
}

const emptyVariant = (): VariantRow => ({
  size: "", color: "", style: "", sku: "", barcode: "", stock: "0", cost: "", selling: "",
});

// ─── Schema ───────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  category_id: z.string().optional(),
  supplier_id: z.string().optional(),
  description: z.string().optional(),
  cost_price: z.coerce.number().min(0, "Must be 0 or more"),
  selling_price: z.coerce.number().min(0, "Must be 0 or more"),
  stock_quantity: z.coerce.number().int().min(0, "Must be 0 or more"),
  minimum_stock: z.coerce.number().int().min(0, "Must be 0 or more"),
  unit: z.string().min(1, "Unit is required"),
  is_active: z.boolean().default(true),
});

type ProductFormValues = z.infer<typeof productSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddProductPage() {
  const router = useRouter();
  const supabase = createClient();
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [hasVariants, setHasVariants] = React.useState(false);
  const [variantRows, setVariantRows] = React.useState<VariantRow[]>([emptyVariant()]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: "",
      sku: "",
      cost_price: 0,
      selling_price: 0,
      stock_quantity: 0,
      minimum_stock: 5,
      unit: "pcs",
      is_active: true,
    },
  });

  const watchedName = watch("name");

  // Auto-generate SKU when name changes
  React.useEffect(() => {
    if (watchedName) {
      setValue("sku", generateSKU(watchedName));
    }
  }, [watchedName, setValue]);

  // ── Fetch categories & suppliers ──
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, slug, description, created_at").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name, email, phone, address, created_at").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Image handling ──
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Submit mutation ──
  const mutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      let imageUrl: string | null = null;

      // Upload image if provided
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `products/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, imageFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const slug = slugify(values.name);

      // Insert product
      const { data: product, error: insertError } = await supabase
        .from("products")
        .insert({
          name: values.name,
          slug,
          sku: values.sku,
          category_id: values.category_id || null,
          supplier_id: values.supplier_id || null,
          description: values.description || null,
          cost_price: values.cost_price,
          selling_price: values.selling_price,
          stock_quantity: values.stock_quantity,
          minimum_stock: values.minimum_stock,
          unit: values.unit,
          is_active: values.is_active,
          image_url: imageUrl,
        })
        .select("id, sku")
        .single();

      if (insertError) throw insertError;

      // Generate QR code
      const qrValue = `PRODUCT:${product.id}:${product.sku}`;
      const qrDataUrl = await QRCode.toDataURL(qrValue, { width: 300, margin: 2 });

      // Convert data URL to Blob and upload
      const qrBlob = await fetch(qrDataUrl).then((r) => r.blob());
      const qrPath = `products/qr-${product.id}.png`;
      await supabase.storage.from("product-images").upload(qrPath, qrBlob, { upsert: true });
      const { data: qrUrlData } = supabase.storage.from("product-images").getPublicUrl(qrPath);

      // Update product with qr_code URL
      await supabase
        .from("products")
        .update({ qr_code: qrUrlData.publicUrl })
        .eq("id", product.id);

      // Insert product_qr_code record
      await supabase.from("product_qr_codes").insert({
        product_id: product.id,
        qr_value: qrValue,
        qr_image_url: qrUrlData.publicUrl,
      });

      // Insert variants if enabled
      if (hasVariants) {
        const toInsert = variantRows
          .filter((r) => r.sku.trim())
          .map((r) => ({
            product_id: product.id,
            size: r.size.trim() || null,
            color: r.color.trim() || null,
            style: r.style.trim() || null,
            sku: r.sku.trim(),
            barcode: r.barcode.trim() || null,
            stock_quantity: parseInt(r.stock) || 0,
            cost_price: r.cost ? parseFloat(r.cost) : null,
            selling_price: r.selling ? parseFloat(r.selling) : null,
          }));
        if (toInsert.length > 0) {
          const { error: varErr } = await supabase.from("product_variants").insert(toInsert);
          if (varErr) throw varErr;
        }
      }

      return product;
    },
    onSuccess: () => {
      toast.success("Product created successfully");
      router.push("/products");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create product");
    },
  });

  const onSubmit = (values: ProductFormValues) => mutation.mutate(values);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Product"
        description="Create a new product in your catalog."
        action={
          <Button variant="outline" onClick={() => router.push("/products")}>
            Cancel
          </Button>
        }
      />

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Main fields ── */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input id="name" placeholder="e.g. Wireless Mouse" {...register("name")} />
                  {errors.name && (
                    <p className="text-xs text-[hsl(var(--destructive))]">{errors.name.message}</p>
                  )}
                </div>

                {/* SKU */}
                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input id="sku" placeholder="Auto-generated" {...register("sku")} />
                  {errors.sku && (
                    <p className="text-xs text-[hsl(var(--destructive))]">{errors.sku.message}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional product description..."
                    rows={3}
                    {...register("description")}
                  />
                </div>

                {/* Category & Supplier */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select onValueChange={(v) => setValue("category_id", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Supplier</Label>
                    <Select onValueChange={(v) => setValue("supplier_id", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cost_price">Cost Price *</Label>
                    <Input
                      id="cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...register("cost_price")}
                    />
                    {errors.cost_price && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.cost_price.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="selling_price">Selling Price *</Label>
                    <Input
                      id="selling_price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...register("selling_price")}
                    />
                    {errors.selling_price && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.selling_price.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="stock_quantity">Current Stock *</Label>
                    <Input
                      id="stock_quantity"
                      type="number"
                      min="0"
                      step="1"
                      {...register("stock_quantity")}
                    />
                    {errors.stock_quantity && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.stock_quantity.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="minimum_stock">Minimum Stock *</Label>
                    <Input
                      id="minimum_stock"
                      type="number"
                      min="0"
                      step="1"
                      {...register("minimum_stock")}
                    />
                    {errors.minimum_stock && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.minimum_stock.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unit">Unit *</Label>
                    <Input id="unit" placeholder="pcs, kg, box..." {...register("unit")} />
                    {errors.unit && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.unit.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variants */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Sizes, Colors & Styles</CardTitle>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      Enable for shoes or clothing with multiple variants
                    </p>
                  </div>
                  <Switch
                    checked={hasVariants}
                    onCheckedChange={(v) => {
                      setHasVariants(v);
                      if (v && variantRows.length === 0) setVariantRows([emptyVariant()]);
                    }}
                  />
                </div>
              </CardHeader>

              {hasVariants && (
                <CardContent className="space-y-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Stock is tracked per variant. The product total is auto-calculated.
                  </p>

                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_1fr_1fr_1.2fr_1fr_0.7fr_0.8fr_0.8fr_auto] gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-1">
                    <span>Size</span>
                    <span>Color</span>
                    <span>Style</span>
                    <span>SKU *</span>
                    <span>Barcode</span>
                    <span>Stock</span>
                    <span>Cost</span>
                    <span>Price</span>
                    <span />
                  </div>

                  {variantRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1.2fr_1fr_0.7fr_0.8fr_0.8fr_auto] gap-1.5 items-center">
                      <Input
                        placeholder="42"
                        value={row.size}
                        onChange={(e) => setVariantRows((prev) => prev.map((r, j) => j === i ? { ...r, size: e.target.value } : r))}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="Black"
                        value={row.color}
                        onChange={(e) => setVariantRows((prev) => prev.map((r, j) => j === i ? { ...r, color: e.target.value } : r))}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="Casual"
                        value={row.style}
                        onChange={(e) => setVariantRows((prev) => prev.map((r, j) => j === i ? { ...r, style: e.target.value } : r))}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="SKU-42-BLK"
                        value={row.sku}
                        onChange={(e) => setVariantRows((prev) => prev.map((r, j) => j === i ? { ...r, sku: e.target.value } : r))}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="Barcode"
                        value={row.barcode}
                        onChange={(e) => setVariantRows((prev) => prev.map((r, j) => j === i ? { ...r, barcode: e.target.value } : r))}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.stock}
                        onChange={(e) => setVariantRows((prev) => prev.map((r, j) => j === i ? { ...r, stock: e.target.value } : r))}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="—"
                        value={row.cost}
                        onChange={(e) => setVariantRows((prev) => prev.map((r, j) => j === i ? { ...r, cost: e.target.value } : r))}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="—"
                        value={row.selling}
                        onChange={(e) => setVariantRows((prev) => prev.map((r, j) => j === i ? { ...r, selling: e.target.value } : r))}
                        className="h-8 text-xs"
                      />
                      <button
                        type="button"
                        title="Remove variant"
                        onClick={() => setVariantRows((prev) => prev.filter((_, j) => j !== i))}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVariantRows((prev) => [...prev, emptyVariant()])}
                    className="w-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Variant
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            {/* Image Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Image</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {imagePreview ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[hsl(var(--border))]">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                    <button
                      type="button"
                      title="Remove image"
                      onClick={clearImage}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-8 text-center transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]"
                  >
                    <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                      Click to upload image
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      PNG, JPG up to 5 MB
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  title="Product image"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Show product in POS
                    </p>
                  </div>
                  <Switch
                    defaultChecked
                    onCheckedChange={(v) => setValue("is_active", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/products")}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mutation.isPending ? "Creating..." : "Create Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
