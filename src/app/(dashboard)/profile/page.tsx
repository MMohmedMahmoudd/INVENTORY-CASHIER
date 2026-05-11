"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Camera,
  Lock,
  Activity,
  Save,
  Eye,
  EyeOff,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, getInitials } from "@/lib/utils";
import type { ActivityLog, UserProfile } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_BUCKET = "avatars";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const t = useT();

  const [fullName, setFullName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile | null>({
    queryKey: ["my-profile", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*, role:roles(*)")
        .eq("auth_user_id", authUser.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setAvatarPreview(profile.avatar_url);
    }
  }, [profile]);

  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityLog[]>({
    queryKey: ["my-activity", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return [];
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t.profile.toast.imageMustBeImage);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.profile.toast.imageTooLarge);
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser?.id || !profile) return;
    setSavingProfile(true);
    try {
      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${authUser.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from(AVATAR_BUCKET)
          .getPublicUrl(path);
        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({ full_name: fullName.trim(), avatar_url: avatarUrl })
        .eq("auth_user_id", authUser.id);

      if (error) throw error;

      if (authUser) {
        setUser({
          ...authUser,
          profile: { ...profile, full_name: fullName.trim(), avatar_url: avatarUrl },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setAvatarFile(null);
      toast.success(t.profile.toast.updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.profile.toast.updateError);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t.profile.toast.passwordsDoNotMatch);
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t.profile.toast.passwordTooShort);
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t.profile.toast.passwordChanged);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.profile.toast.passwordError);
    } finally {
      setChangingPassword(false);
    }
  };

  const displayName = profile?.full_name || authUser?.email || "User";
  const initials = getInitials(displayName);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
          <User className="h-6 w-6 text-blue-500" />
          {t.profile.title}
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t.profile.description}
        </p>
      </div>

      {/* Profile overview card */}
      <div className="flex items-center gap-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
        <div className="relative">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarPreview ?? ""} />
            <AvatarFallback className="text-xl font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          {profileLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ) : (
            <>
              <p className="text-xl font-semibold text-[hsl(var(--foreground))]">
                {displayName}
              </p>
              <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                {authUser?.email}
              </p>
              {profile?.role && (
                <Badge variant="secondary" className="mt-2 capitalize">
                  {profile.role.name}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {t.profile.tabInfo}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            {t.profile.tabSecurity}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            {t.profile.tabActivity}
          </TabsTrigger>
        </TabsList>

        {/* ── Profile Info ── */}
        <TabsContent value="info" className="mt-5">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm space-y-6"
          >
            {/* Avatar upload */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">
                {t.profile.profilePhoto}
              </h3>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarPreview ?? ""} />
                  <AvatarFallback className="text-lg font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    title={t.profile.profilePhoto}
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="me-2 h-4 w-4" />
                    {t.profile.changePhoto}
                  </Button>
                  {avatarFile && (
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <Upload className="me-1 inline h-3 w-3" />
                      {avatarFile.name} — {t.profile.willUploadOnSave}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {t.profile.imageFormats}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Full name */}
            <div className="space-y-1.5">
              <Label htmlFor="full-name">{t.profile.fullName}</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t.profile.fullNamePlaceholder}
                disabled={profileLoading}
              />
            </div>

            {/* Email — read-only */}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t.profile.emailAddress}</Label>
              <Input
                id="email"
                type="email"
                value={authUser?.email ?? ""}
                disabled
                className="cursor-not-allowed opacity-70"
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t.profile.emailReadOnly}
              </p>
            </div>

            {/* Role — read-only */}
            {profile?.role && (
              <div className="space-y-1.5">
                <Label>{t.profile.roleLabel}</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {profile.role.name}
                  </Badge>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {t.profile.assignedByAdmin}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={savingProfile || profileLoading}>
                <Save className="me-2 h-4 w-4" />
                {savingProfile ? t.profile.saving : t.profile.saveProfile}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ── Security ── */}
        <TabsContent value="security" className="mt-5">
          <form
            onSubmit={handleChangePassword}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm space-y-5"
          >
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {t.profile.changePassword}
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="current-pw">{t.profile.currentPassword}</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t.profile.currentPasswordPlaceholder}
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pw">{t.profile.newPassword}</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t.profile.newPasswordPlaceholder}
                  className="pe-10"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">{t.profile.confirmPassword}</Label>
              <div className="relative">
                <Input
                  id="confirm-pw"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.profile.confirmPasswordPlaceholder}
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">{t.profile.passwordsDoNotMatch}</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={
                  changingPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword ||
                  newPassword.length < 8
                }
              >
                <Lock className="me-2 h-4 w-4" />
                {changingPassword ? t.profile.changing : t.profile.changePassword}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ── Activity ── */}
        <TabsContent value="activity" className="mt-5">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
            <div className="border-b border-[hsl(var(--border))] px-5 py-3">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                {t.profile.recentActivity}
              </h3>
            </div>

            {activityLoading ? (
              <div className="divide-y divide-[hsl(var(--border))]">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Activity className="mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t.profile.noRecentActivity}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border))]">
                {activity.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-5 py-3.5"
                  >
                    <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-[hsl(var(--foreground))]">
                          <span className="font-medium">{log.action}</span>
                          {log.entity_type && (
                            <span className="text-[hsl(var(--muted-foreground))]">
                              {" "}{t.profile.on} {log.entity_type}
                            </span>
                          )}
                        </p>
                        <time className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                          {formatDateTime(log.created_at)}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
