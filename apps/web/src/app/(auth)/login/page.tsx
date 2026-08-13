"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { LoginSchema } from "@school-erp/shared/src/schemas/auth.schema";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/auth.store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/dashboard";
  const { setAuth } = useAuthStore();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema) as any,
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof LoginSchema>) => {
    try {
      setGlobalError(null);
      const response = await apiClient.post("/auth/login", data);
      const { user, accessToken } = response.data.data;
      setAuth(user, accessToken);
      router.push(returnUrl);
    } catch (error: any) {
      if (error.response?.data?.message) {
        setGlobalError(error.response.data.message);
      } else {
        setGlobalError("Failed to connect to the server. Please try again.");
      }
    }
  };

  return (
    <div className="login-page">
      {/* Left content area */}
      <div className="login-left">
        {/* Logo above the card */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 2L4 12V26C4 37.05 12.85 47.4 24 50C35.15 47.4 44 37.05 44 26V12L24 2Z" fill="#1a3a6b" />
              <path d="M24 6L8 15V26C8 35.2 15.2 44.1 24 46.5C32.8 44.1 40 35.2 40 26V15L24 6Z" fill="#2563eb" />
              <text x="24" y="32" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">🎓</text>
            </svg>
          </div>
          <div className="login-logo-text">
            <span className="login-logo-name">AI School ERP</span>
            <span className="login-logo-tagline">Smart School. Smarter Future.</span>
          </div>
        </div>

        {/* The white floating card */}
        <div className="login-card">
          <div className="login-card-header">
            <h1 className="login-title">Welcome Back! 👋</h1>
            <p className="login-subtitle">Sign in to continue to your account</p>
          </div>

          {globalError && (
            <div className="global-error">
              <AlertCircle size={18} />
              <span>{globalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email / Username</label>
              <div className="input-container">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  placeholder="admin@sunriseschool.edu"
                  className={`form-input ${errors.email ? "has-error" : ""}`}
                  disabled={isSubmitting}
                  {...register("email")}
                />
              </div>
              {errors.email && <span className="error-message">{errors.email.message}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-container">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  className={`form-input ${errors.password ? "has-error" : ""}`}
                  disabled={isSubmitting}
                  style={{ paddingRight: "3rem" }}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="error-message">{errors.password.message}</span>}
            </div>

            {/* Remember me + Forgot password */}
            <div className="login-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <Link href="/forgot-password" className="forgot-link">Forgot Password?</Link>
            </div>

            {/* Sign In button */}
            <button type="submit" className="btn-signin" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="spinner" size={18} /> Signing in...</>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Social login divider */}
          <div className="social-divider">
            <span className="social-divider-line" />
            <span className="social-divider-text">or continue with</span>
            <span className="social-divider-line" />
          </div>

          {/* Social buttons */}
          <div className="social-buttons">
            <button className="social-btn" type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button className="social-btn" type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 11H3V3h8v8z" fill="#F25022"/>
                <path d="M21 11h-8V3h8v8z" fill="#7FBA00"/>
                <path d="M11 21H3v-8h8v8z" fill="#00A4EF"/>
                <path d="M21 21h-8v-8h8v8z" fill="#FFB900"/>
              </svg>
              Microsoft
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          © 2026 AI School ERP. All rights reserved.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /></div>}>
      <LoginForm />
    </Suspense>
  );
}
