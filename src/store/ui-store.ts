import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  lang: "en" | "ar";
  currency: string;
  toggleSidebar: () => void;
  toggleCollapsed: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setLang: (lang: "en" | "ar") => void;
  setCurrency: (currency: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      commandOpen: false,
      lang: "en",
      currency: "USD",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setLang: (lang) => set({ lang }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: "invenpos-ui",
      partialize: (s) => ({ lang: s.lang, currency: s.currency }),
    }
  )
);
