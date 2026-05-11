"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

function useLoginSchema() {
  const t = useT();
  return z.object({
    email: z
      .string()
      .min(1, t.auth.emailRequired)
      .email(t.auth.emailInvalid),
    password: z
      .string()
      .min(6, t.auth.passwordMin),
    rememberMe: z.boolean().default(false),
  });
}

type LoginFormValues = { email: string; password: string; rememberMe: boolean };

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const t = useT();
  const schema = useLoginSchema();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const rememberMe = watch("rememberMe");

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message ?? "Failed to sign in. Please try again.");
        return;
      }

      toast.success("Signed in successfully!");
      router.push("/dashboard");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t.auth.welcomeBack}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t.auth.signInSubtitle}
        </p>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.auth.emailAddress}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.auth.emailPlaceholder}
            disabled={isLoading}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-[hsl(var(--destructive))]">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-[hsl(var(--primary))] hover:underline"
            >
              {t.auth.forgotPassword}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={isLoading}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-[hsl(var(--destructive))]">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="rememberMe"
            checked={rememberMe}
            onCheckedChange={(checked) =>
              setValue("rememberMe", checked === true)
            }
            disabled={isLoading}
          />
          <Label
            htmlFor="rememberMe"
            className="cursor-pointer font-normal text-[hsl(var(--muted-foreground))]"
          >
            {t.auth.rememberMe}
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              {t.auth.signingIn}
            </>
          ) : (
            t.auth.signIn
          )}
        </Button>
      </form>
    </>
  );
}
