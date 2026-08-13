"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { School, Lock, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/axios";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordDto>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordDto) => {
    if (!token) {
      setGlobalError("Invalid or missing reset token.");
      return;
    }

    try {
      setGlobalError(null);
      await apiClient.post("/auth/reset-password", {
        token,
        newPassword: data.password,
      });
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (error: any) {
      if (error.response?.data?.message) {
        setGlobalError(error.response.data.message);
      } else {
        setGlobalError("Failed to reset password. The link may have expired.");
      }
    }
  };

  if (!token && !isSuccess) {
    return (
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <School className="auth-logo-icon" size={32} />
          </div>
          <h1 className="auth-title">Invalid Link</h1>
          <p className="auth-subtitle">
            This password reset link is invalid or has expired.
          </p>
        </div>
        <Link href="/forgot-password" className="btn-primary" style={{ textDecoration: 'none' }}>
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-logo">
          <School className="auth-logo-icon" size={32} />
          <span>AI School ERP</span>
        </div>
        <h1 className="auth-title">Create new password</h1>
        <p className="auth-subtitle">
          Please enter your new password below.
        </p>
      </div>

      {isSuccess ? (
        <div className="auth-success-state text-center">
          <div className="global-success">
            <CheckCircle2 size={18} />
            <span>Password successfully reset! Redirecting to login...</span>
          </div>
        </div>
      ) : (
        <>
          {globalError && (
            <div className="global-error">
              <AlertCircle size={18} />
              <span>{globalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                New Password
              </label>
              <div className="input-container">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className={`form-input ${errors.password ? "has-error" : ""}`}
                  disabled={isSubmitting}
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <span className="error-message">{errors.password.message}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <div className="input-container">
                <Lock className="input-icon" size={18} />
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className={`form-input ${
                    errors.confirmPassword ? "has-error" : ""
                  }`}
                  disabled={isSubmitting}
                  {...register("confirmPassword")}
                />
              </div>
              {errors.confirmPassword && (
                <span className="error-message">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="spinner" size={18} />
                  Resetting password...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-card"><Loader2 className="spinner" size={24} /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
