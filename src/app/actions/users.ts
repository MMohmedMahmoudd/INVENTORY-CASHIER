"use server";

import { createAdminClient } from "@/lib/supabase/server";

export async function inviteUser(
  email: string,
  roleId: string,
  fullName: string
) {
  const supabase = await createAdminClient();

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });

  if (error) throw new Error(error.message);

  // Set role on user_profiles row (created by DB trigger on invite)
  await supabase
    .from("user_profiles")
    .update({ role_id: roleId, full_name: fullName })
    .eq("auth_user_id", data.user.id);

  return data;
}

export async function updateUserRole(authUserId: string, roleId: string) {
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ role_id: roleId })
    .eq("auth_user_id", authUserId);

  if (error) throw new Error(error.message);
}

export async function setUserActive(authUserId: string, isActive: boolean) {
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ is_active: isActive })
    .eq("auth_user_id", authUserId);

  if (error) throw new Error(error.message);
}

export async function deleteUser(authUserId: string) {
  const supabase = await createAdminClient();

  const { error } = await supabase.auth.admin.deleteUser(authUserId);
  if (error) throw new Error(error.message);
}

export async function listUsers() {
  const supabase = await createAdminClient();

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("*, role:roles(*)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: authData } = await supabase.auth.admin.listUsers();

  const authMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, u])
  );

  return (profiles ?? []).map((p) => ({
    ...p,
    email: authMap.get(p.auth_user_id)?.email ?? "",
    last_sign_in_at: authMap.get(p.auth_user_id)?.last_sign_in_at ?? null,
  }));
}
