"use client";

import { Suspense, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Lock, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff, 
  ShieldCheck, ArrowLeft, Check, X, Building2, KeyRound 
} from "lucide-react";
import { ResetPasswordSchema } from "@school-erp/shared/src/schemas/auth.schema";
import { apiClient } from "@/lib/axios";

type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(ResetPasswordSchema) as any,
    defaultValues: {
      token,
      password: "",
      confirmPassword: "",
    },
  });

  const passwordValue = watch("password", "");
  const confirmPasswordValue = watch("confirmPassword", "");

  // Live Password Criteria Verification
  const criteria = useMemo(() => {
    return {
      minLength: passwordValue.length >= 8,
      hasUpper: /[A-Z]/.test(passwordValue),
      hasLower: /[a-z]/.test(passwordValue),
      hasNumber: /[0-9]/.test(passwordValue),
      isMatching: passwordValue.length > 0 && passwordValue === confirmPasswordValue,
    };
  }, [passwordValue, confirmPasswordValue]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setGlobalError("Invalid or missing reset token. Please request a new password reset link.");
      return;
    }

    try {
      setGlobalError(null);
      await apiClient.post("/auth/reset-password", {
        token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (error: any) {
      const msg = error.response?.data?.message;
      if (msg) {
        setGlobalError(msg);
      } else {
        setGlobalError("Failed to reset password. The security token may have expired or is invalid.");
      }
    }
  };

  if (!token && !isSuccess) {
    return (
      <div className="login-page">
        <div className="login-left">
          <div className="login-logo">
            <div className="login-logo-icon">
              <svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 2L4 12V26C4 37.05 12.85 47.4 24 50C35.15 47.4 44 37.05 44 26V12L24 2Z" fill="#1a3a6b" />
                <path d="M24 6L8 15V26C8 35.2 15.2 44.1 24 46.5C32.8 44.1 40 35.2 40 26V15L24 6Z" fill="#2563eb" />
                <text x="24" y="32" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">🎓</text>
              </svg>
            </div>
            <div className="login-logo-text">
              <span className="login-logo-name">Agentic School ERP</span>
              <span className="login-logo-tagline">Sunrise International School · Session 2026-27</span>
            </div>
          </div>

          <div className="login-card">
            <div className="login-card-header">
              <h1 className="login-title">Invalid Reset Link</h1>
              <p className="login-subtitle">
                This password reset link is missing a valid security token or has already expired.
              </p>
            </div>

            <div style={{ margin: "1.5rem 0" }}>
              <Link 
                href="/forgot-password" 
                className="btn-signin" 
                style={{ 
                  textDecoration: "none", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: "0.5rem" 
                }}
              >
                Request New Reset Link
              </Link>
            </div>

            <div style={{ textAlign: "center" }}>
              <Link 
                href="/login" 
                style={{ 
                  fontSize: "0.8125rem", 
                  color: "#2563eb", 
                  textDecoration: "none", 
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </div>

          <div className="login-footer">
            © 2026 Sunrise International School · Powered by Agentic ERP
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-left">
        {/* Institutional Branding Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 2L4 12V26C4 37.05 12.85 47.4 24 50C35.15 47.4 44 37.05 44 26V12L24 2Z" fill="#1a3a6b" />
              <path d="M24 6L8 15V26C8 35.2 15.2 44.1 24 46.5C32.8 44.1 40 35.2 40 26V15L24 6Z" fill="#2563eb" />
              <text x="24" y="32" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">🎓</text>
            </svg>
          </div>
          <div className="login-logo-text">
            <span className="login-logo-name">Agentic School ERP</span>
            <span className="login-logo-tagline">Sunrise International School · Session 2026-27</span>
          </div>
        </div>

        {/* Floating reset card */}
        <div className="login-card">
          <div className="login-card-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <h1 className="login-title">Reset Password</h1>
              <span className="portal-badge">Security Update</span>
            </div>
            <p className="login-subtitle">
              {isSuccess 
                ? "Password updated successfully" 
                : "Create a strong, unique password to secure your institutional account"}
            </p>
          </div>

          {globalError && (
            <div className="global-error" style={{ marginBottom: "1rem" }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>{globalError}</span>
            </div>
          )}

          {isSuccess ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", margin: "1rem 0" }}>
              <div 
                style={{ 
                  background: "rgba(16, 185, 129, 0.08)", 
                  border: "1px solid rgba(16, 185, 129, 0.25)", 
                  borderRadius: "12px", 
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem"
                }}
              >
                <CheckCircle2 size={24} style={{ color: "#059669", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: "#065f46", fontSize: "0.9375rem" }}>
                    Password Successfully Reset!
                  </div>
                  <div style={{ color: "#047857", fontSize: "0.8125rem", marginTop: "0.2rem" }}>
                    Your institutional password has been updated. Redirecting you to sign in...
                  </div>
                </div>
              </div>

              <Link 
                href="/login" 
                className="btn-signin" 
                style={{ 
                  textDecoration: "none", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: "0.5rem" 
                }}
              >
                Continue to Sign In &rarr;
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="login-form">
              <input type="hidden" {...register("token")} value={token} />

              {/* New Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  New Password
                </label>
                <div className="input-container">
                  <Lock className="input-icon" size={17} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    className={`form-input ${errors.password ? "has-error" : ""}`}
                    disabled={isSubmitting}
                    style={{ paddingRight: "2.75rem" }}
                    autoComplete="new-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
                    title={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.password && (
                  <span className="error-message">{errors.password.message}</span>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">
                  Confirm New Password
                </label>
                <div className="input-container">
                  <Lock className="input-icon" size={17} />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    className={`form-input ${errors.confirmPassword ? "has-error" : ""}`}
                    disabled={isSubmitting}
                    style={{ paddingRight: "2.75rem" }}
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="password-toggle"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="error-message">{errors.confirmPassword.message}</span>
                )}
              </div>

              {/* Security Requirements Progress */}
              <div 
                style={{ 
                  background: "#f8fafc", 
                  border: "1px solid #e2e8f0", 
                  borderRadius: "10px", 
                  padding: "0.75rem 0.875rem",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.4rem 0.75rem",
                  fontSize: "0.75rem",
                  marginBottom: "0.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: criteria.minLength ? "#059669" : "#64748b" }}>
                  {criteria.minLength ? <Check size={13} /> : <span style={{ width: 13, height: 13, display: "inline-block", borderRadius: "50%", border: "1px solid #cbd5e1" }} />}
                  <span>8+ Characters</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: criteria.hasUpper ? "#059669" : "#64748b" }}>
                  {criteria.hasUpper ? <Check size={13} /> : <span style={{ width: 13, height: 13, display: "inline-block", borderRadius: "50%", border: "1px solid #cbd5e1" }} />}
                  <span>Uppercase Letter</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: criteria.hasLower ? "#059669" : "#64748b" }}>
                  {criteria.hasLower ? <Check size={13} /> : <span style={{ width: 13, height: 13, display: "inline-block", borderRadius: "50%", border: "1px solid #cbd5e1" }} />}
                  <span>Lowercase Letter</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: criteria.hasNumber ? "#059669" : "#64748b" }}>
                  {criteria.hasNumber ? <Check size={13} /> : <span style={{ width: 13, height: 13, display: "inline-block", borderRadius: "50%", border: "1px solid #cbd5e1" }} />}
                  <span>At Least 1 Number</span>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-signin" 
                disabled={isSubmitting}
                style={{ marginTop: "0.5rem" }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="spinner" size={17} />
                    Securing Account...
                  </>
                ) : (
                  "Update & Save Password"
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: "0.75rem" }}>
                <Link 
                  href="/login" 
                  style={{ 
                    fontSize: "0.8125rem", 
                    color: "#2563eb", 
                    textDecoration: "none", 
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem"
                  }}
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* Security Trust Assurance */}
          <div className="security-trust-badge" style={{ marginTop: "1rem" }}>
            <ShieldCheck size={13} style={{ color: "#059669" }} />
            <span>256-Bit SSL Encrypted · Official Password Reset Service</span>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          © 2026 Sunrise International School · Powered by Agentic ERP
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="spinner" size={32} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
