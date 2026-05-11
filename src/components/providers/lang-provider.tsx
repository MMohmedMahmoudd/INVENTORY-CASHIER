"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/ui-store";

export function LangProvider({ children }: { children: React.ReactNode }) {
  const lang = useUIStore((s) => s.lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  return <>{children}</>;
}
