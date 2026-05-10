import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/types";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: string) => boolean;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        const role = user.role?.name;
        if (role === "admin") return true;
        return user.permissions.includes(permission);
      },
      clearUser: () => set({ user: null, isLoading: false }),
    }),
    {
      name: "invenpos-auth",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
