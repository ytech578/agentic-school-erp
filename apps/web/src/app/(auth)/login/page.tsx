"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { 
  Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, 
  ShieldCheck, HelpCircle, Building2, X, AlertTriangle
} from "lucide-react";
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
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema) as any,
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Restore remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("erp_remembered_email");
      if (savedEmail) {
        setValue("email", savedEmail);
        setRememberMe(true);
      }
    } catch {
      // localStorage may be restricted
    }
  }, [setValue]);

  // Keyboard handler for Caps Lock detection
  const handlePasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState("CapsLock"));
  };

  const onSubmit = async (data: z.infer<typeof LoginSchema>) => {
    try {
      setGlobalError(null);
      const response = await apiClient.post("/auth/login", data);
      const { user, accessToken } = response.data.data;

      // Handle remember me persistence
      try {
        if (rememberMe) {
          localStorage.setItem("erp_remembered_email", data.email);
        } else {
          localStorage.removeItem("erp_remembered_email");
        }
      } catch {
        // Ignore storage errors
      }

      setAuth(user, accessToken);
      router.push(returnUrl);
    } catch (error: any) {
      const rawMsg = error.response?.data?.message;
      const status = error.response?.status;

      if (status === 401 || rawMsg === "Unauthorized") {
        setGlobalError("Invalid email or password. Please verify your school credentials and try again.");
      } else if (rawMsg) {
        setGlobalError(rawMsg);
      } else {
        setGlobalError("Unable to connect to the school server. Please verify your connection or try again.");
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

        {/* Floating login card */}
        <div className="login-card">
          <div className="login-card-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <h1 className="login-title">Sign In</h1>
              <span className="portal-badge">Official Portal</span>
            </div>
            <p className="login-subtitle">Enter your institutional credentials to access your portal</p>
          </div>

          {/* Error Banner */}
          {globalError && (
            <div className="global-error">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>{globalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">Institutional Email / Username</label>
              <div className="input-container">
                <Mail className="input-icon" size={17} />
                <input
                  id="email"
                  type="email"
                  placeholder="name@sunriseschool.edu.in"
                  className={`form-input ${errors.email ? "has-error" : ""}`}
                  disabled={isSubmitting}
                  autoComplete="email"
                  suppressHydrationWarning
                  {...register("email")}
                />
              </div>
              {errors.email && <span className="error-message">{errors.email.message}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="form-label" htmlFor="password">Password</label>
                {capsLockActive && (
                  <span className="caps-lock-warning">
                    <AlertTriangle size={11} /> Caps Lock is ON
                  </span>
                )}
              </div>
              <div className="input-container">
                <Lock className="input-icon" size={17} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  className={`form-input ${errors.password ? "has-error" : ""}`}
                  disabled={isSubmitting}
                  style={{ paddingRight: "2.75rem" }}
                  autoComplete="current-password"
                  onKeyDown={handlePasswordKey}
                  onKeyUp={handlePasswordKey}
                  suppressHydrationWarning
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
            <button type="submit" className="btn-signin" disabled={isSubmitting} suppressHydrationWarning>
              {isSubmitting ? (
                <><Loader2 className="spinner" size={17} /> Authenticating...</>
              ) : (
                "Sign In to ERP"
              )}
            </button>
          </form>

          {/* Institutional Help & Directory Notice */}
          <div className="helpdesk-banner">
            <div className="helpdesk-icon">
              <Building2 size={16} />
            </div>
            <div className="helpdesk-text">
              <span>Credentials provisioned by school admin.</span>
              <button 
                type="button" 
                onClick={() => setShowHelpModal(true)} 
                className="helpdesk-link"
              >
                Need login help? &rarr;
              </button>
            </div>
          </div>

          {/* Security Trust Assurance */}
          <div className="security-trust-badge">
            <ShieldCheck size={13} style={{ color: "#059669" }} />
            <span>256-Bit SSL Encrypted · Role-Based Security</span>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          © 2026 Sunrise International School · Powered by Agentic ERP
        </div>
      </div>

      {/* ========================================================
          INSTITUTIONAL HELPDESK MODAL
          Strict Solid Background + 12px Backdrop Blur
          ======================================================== */}
      {showHelpModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    School Portal Helpdesk
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                    Sunrise International School · IT Support
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowHelpModal(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.6 }}>
                All student, parent, and teacher login accounts are provisioned directly by the school administration upon enrollment or staff onboarding.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginTop: "0.5rem" }}>
                <div className="help-info-row">
                  <span className="help-info-label">🏫 School Office</span>
                  <span className="help-info-value">Administrative Block, Room 104</span>
                </div>
                <div className="help-info-row">
                  <span className="help-info-label">📧 IT Helpline</span>
                  <span className="help-info-value">support@sunriseschool.edu.in</span>
                </div>
                <div className="help-info-row">
                  <span className="help-info-label">📞 Phone Support</span>
                  <span className="help-info-value">+91 (020) 1234-5678 (Ext. 104)</span>
                </div>
                <div className="help-info-row">
                  <span className="help-info-label">⏰ Support Hours</span>
                  <span className="help-info-value">Mon – Fri: 8:00 AM – 4:30 PM</span>
                </div>
              </div>

              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", borderRadius: "8px", background: "#F1F5F9", border: "1px solid #E2E8F0", fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.5 }}>
                💡 <strong>Forgot password?</strong> Use the <Link href="/forgot-password" onClick={() => setShowHelpModal(false)} style={{ color: "#2563EB", fontWeight: 600 }}>Forgot Password link</Link> to receive a reset token on your registered email address.
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setShowHelpModal(false)}
                className="btn-modal-close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#2563EB" }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
