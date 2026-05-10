"use client";

export const runtime = 'edge';

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import Image from "next/image";

import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import type { Category, Supplier, Product } from "@/types";

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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";

// ─── Schema ───────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  category_id: z.string().optional(),
  supplier_id: z.string().optional(),
  description: z.string().optional(),
  cost_price: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0),
  stock_quantity: z.coerce.number().int().min(0),
  minimum_stock: z.coerce.number().int().min(0),
  unit: z.string().min(1),
  is_active: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [removeImage, setRemoveImage] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
  });

  // ── Fetch product ──
  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          `id, name, slug, sku, barcode, qr_code, category_id, supplier_id,
           image_url, description, cost_price, selling_price,
           stock_quantity, minimum_stock, unit, is_active, created_at, updated_at,
           category:categories(id, name, slug, description, created_at),
           supplier:suppliers(id, name, email, phone, address, created_at)`
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as Product;
    },
    enabled: !!id,
  });

  // Populate form once product is loaded
  React.useEffect(() => {
    if (!product) return;
    reset({
      name: product.name,
      sku: product.sku,
      category_id: product.category_id ?? undefined,
      supplier_id: product.supplier_id ?? undefined,
      description: product.description ?? "",
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      stock_quantity: product.stock_quantity,
      minimum_stock: product.minimum_stock,
      unit: product.unit,
      is_active: product.is_active,
    });
    if (product.image_url) {
      setImagePreview(product.image_url);
    }
  }, [product, reset]);

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
    setRemoveImage(false);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Submit mutation ──
  const mutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      let imageUrl: string | null = product?.image_url ?? null;

      if (removeImage) {
        imageUrl = null;
      } else if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `products/${id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, imageFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const slug = slugify(values.name);

      const { error } = await supabase
        .from("products")
        .update({
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
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      toast.success("Product updated successfully");
      router.push("/products");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update product");
    },
  });

  const onSubmit = (values: ProductFormValues) => mutation.mutate(values);

  if (productLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-4 pt-6">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-9 w-full" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="aspect-square w-full rounded-lg" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[hsl(var(--muted-foreground))]">Product not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Product"
        description={`Editing: ${product.name}`}
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
                <div className="space-y-1.5">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input id="name" {...register("name")} />
                  {errors.name && (
                    <p className="text-xs text-[hsl(var(--destructive))]">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input id="sku" {...register("sku")} />
                  {errors.sku && (
                    <p className="text-xs text-[hsl(var(--destructive))]">{errors.sku.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" rows={3} {...register("description")} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      defaultValue={product.category_id ?? undefined}
                      onValueChange={(v) => setValue("category_id", v)}
                    >
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
                    <Select
                      defaultValue={product.supplier_id ?? undefined}
                      onValueChange={(v) => setValue("supplier_id", v)}
                    >
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cost_price">Cost Price *</Label>
                    <Input id="cost_price" type="number" step="0.01" min="0" {...register("cost_price")} />
                    {errors.cost_price && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.cost_price.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="selling_price">Selling Price *</Label>
                    <Input id="selling_price" type="number" step="0.01" min="0" {...register("selling_price")} />
                    {errors.selling_price && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.selling_price.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="stock_quantity">Current Stock *</Label>
                    <Input id="stock_quantity" type="number" min="0" step="1" {...register("stock_quantity")} />
                    {errors.stock_quantity && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.stock_quantity.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="minimum_stock">Minimum Stock *</Label>
                    <Input id="minimum_stock" type="number" min="0" step="1" {...register("minimum_stock")} />
                    {errors.minimum_stock && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.minimum_stock.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unit">Unit *</Label>
                    <Input id="unit" {...register("unit")} />
                    {errors.unit && (
                      <p className="text-xs text-[hsl(var(--destructive))]">{errors.unit.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Image</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {imagePreview ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[hsl(var(--border))]">
                    <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    <button
                      type="button"
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
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Click to upload image</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Show in POS</p>
                  </div>
                  <Switch
                    defaultChecked={product.is_active}
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
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
