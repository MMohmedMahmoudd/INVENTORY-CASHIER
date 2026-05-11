"use client";

import { useUIStore } from "@/store/ui-store";
import { en } from "./en";
import { ar } from "./ar";

export type { Translations } from "./en";

const dict = { en, ar } as const;

export function useT() {
  const lang = useUIStore((s) => s.lang);
  return dict[lang as keyof typeof dict] ?? en;
}
