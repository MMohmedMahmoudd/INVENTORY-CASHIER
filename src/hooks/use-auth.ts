"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import type { AuthUser } from "@/types";

export function useAuth() {
  const { user, isLoading, setUser, setLoading, hasPermission, clearUser } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { clearUser(); return; }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*, role:roles(*)")
        .eq("auth_user_id", authUser.id)
        .single();

      if (!profile) { clearUser(); return; }

      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("permission:permissions(key)")
        .eq("role_id", profile.role_id ?? "");

      const { data: userPerms } = await supabase
        .from("user_permissions")
        .select("permission:permissions(key)")
        .eq("user_id", profile.id);

      const permissions = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(rolePerms?.map((r: any) => r.permission?.key ?? "") ?? []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(userPerms?.map((u: any) => u.permission?.key ?? "") ?? []),
      ].filter(Boolean);

      const authUserData: AuthUser = {
        id: authUser.id,
        email: authUser.email ?? "",
        profile,
        role: profile.role ?? undefined,
        permissions,
      };

      setUser(authUserData);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearUser();
        router.push("/login");
      } else if (event === "SIGNED_IN") {
        fetchUser();
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearUser();
    router.push("/login");
  };

  return { user, isLoading, hasPermission, signOut };
}
