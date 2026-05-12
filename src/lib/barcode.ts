import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBarcode } from "@/lib/utils";

export async function generateUniqueBarcode(
  supabase: SupabaseClient,
  usedInBatch = new Set<string>()
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateBarcode();
    if (usedInBatch.has(code)) continue;
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("barcode", code);
    if (!count) {
      usedInBatch.add(code);
      return code;
    }
  }
  const fallback = generateBarcode();
  usedInBatch.add(fallback);
  return fallback;
}
