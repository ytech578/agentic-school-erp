"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft, 
  ShieldCheck, Building2, KeyRound, ExternalLink, Copy, Check
} from "lucide-react";
import { ForgotPasswordSchema } from "@school-erp/shared/src/schemas/auth.schema";
import { apiClient } from "@/lib/axios";

type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

interface DevSimulationData {
  devSimulation?: boolean;
  resetToken?: string;
  resetUrl?: string;
}

export default function ForgotPasswordPage() {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [devData, setDevData] = useState<DevSimulationData | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({
    resolver: zodResolver(ForgotPasswordSchema) as any,
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordDto) => {
    try {
      setGlobalError(null);
      setSubmittedEmail(data.email);
      const response = await apiClient.post("/auth/forgot-password", data);
      
      if (response.data?.data?.devSimulation) {
        setDevData(response.data.data);
      }
      setIsSuccess(true);
    } catch (error: any) {
      const msg = error.response?.data?.message;
      if (msg) {
        setGlobalError(msg);
      } else {
        setGlobalError("Unable to connect to the school authentication server. Please try again.");
      }
    }
  };

  const handleCopyToken = () => {
    if (devData?.resetToken) {
      navigator.clipboard.writeText(devData.resetToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="login-page">
      {/* Left content area */}
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

        {/* Floating recovery card */}
        <div className="login-card">
          <div className="login-card-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <h1 className="login-title">Forgot Password</h1>
              <span className="portal-badge">Account Recovery</span>
            </div>
            <p className="login-subtitle">
              {isSuccess 
                ? "Password recovery link has been generated"
                : "Enter your registered institutional email to receive reset instructions"}
            </p>
          </div>

          {/* Global Error Banner */}
          {globalError && (
            <div className="global-error" style={{ marginBottom: "1rem" }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>{globalError}</span>
            </div>
          )}

          {isSuccess ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div 
                style={{ 
                  background: "rgba(16, 185, 129, 0.08)", 
                  border: "1px solid rgba(16, 185, 129, 0.25)", 
                  borderRadius: "12px", 
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.875rem"
                }}
              >
                <CheckCircle2 size={20} style={{ color: "#059669", flexShrink: 0, marginTop: "2px" }} />
                <div style={{ fontSize: "0.875rem", color: "#065f46", lineHeight: 1.5 }}>
                  <p style={{ margin: "0 0 0.35rem 0", fontWeight: 600 }}>Recovery email dispatched</p>
                  <p style={{ margin: 0 }}>
                    If an institutional account exists for <strong>{submittedEmail}</strong>, we have dispatched a secure reset link valid for <strong>1 hour</strong>.
                  </p>
                </div>
              </div>

              {/* Dev Simulation Box (non-production sandbox helper) */}
              {devData?.resetUrl && (
                <div 
                  style={{ 
                    background: "rgba(37, 99, 235, 0.06)", 
                    border: "1px dashed #2563eb", 
                    borderRadius: "12px", 
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <KeyRound size={13} /> Dev Sandbox Preview
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "0.75rem",
                        color: "#2563eb",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontWeight: 600
                      }}
                    >
                      {copiedToken ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                      {copiedToken ? "Copied Token" : "Copy Token"}
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "#1e3a8a" }}>
                    In this development environment, you can immediately test the reset flow without external SMTP:
                  </p>
                  <Link
                    href={`/reset-password?token=${devData.resetToken}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.8125rem",
                      color: "#ffffff",
                      background: "#2563eb",
                      padding: "0.5rem 0.875rem",
                      borderRadius: "6px",
                      textDecoration: "none",
                      fontWeight: 600,
                      alignSelf: "flex-start"
                    }}
                  >
                    Proceed to Reset Password <ExternalLink size={13} />
                  </Link>
                </div>
              )}

              <Link 
                href="/login" 
                className="btn-signin" 
                style={{ 
                  textDecoration: "none", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: "0.5rem",
                  marginTop: "0.25rem"
                }}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Registered Institutional Email
                </label>
                <div className="input-container">
                  <Mail className="input-icon" size={17} />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@sunriseschool.edu.in"
                    className={`form-input ${errors.email ? "has-error" : ""}`}
                    disabled={isSubmitting}
                    autoComplete="email"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <span className="error-message">{errors.email.message}</span>
                )}
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
                    Sending Recovery Link...
                  </>
                ) : (
                  "Send Recovery Link"
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

          {/* Institutional Helpdesk Notice */}
          <div className="helpdesk-banner" style={{ marginTop: "1.25rem" }}>
            <div className="helpdesk-icon">
              <Building2 size={16} />
            </div>
            <div className="helpdesk-text">
              <span>Need help accessing your account?</span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Contact school administration: helpdesk@sunriseschool.edu.in
              </span>
            </div>
          </div>

          {/* Security Trust Assurance */}
          <div className="security-trust-badge">
            <ShieldCheck size={13} style={{ color: "#059669" }} />
            <span>256-Bit SSL Encrypted · Official Recovery Gateway</span>
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
