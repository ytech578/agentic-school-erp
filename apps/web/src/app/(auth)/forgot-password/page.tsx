"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { School, Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/axios";

// Using local schema since standard auth.schema.ts might not have this in MVP yet
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordDto) => {
    try {
      setGlobalError(null);
      // Fallback API call for future implementation
      await apiClient.post("/auth/forgot-password", data);
      setIsSuccess(true);
    } catch (error: any) {
      if (error.response?.data?.message) {
        setGlobalError(error.response.data.message);
      } else {
        setGlobalError("Failed to connect to the server. Please try again.");
      }
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-logo">
          <School className="auth-logo-icon" size={32} />
          <span>AI School ERP</span>
        </div>
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {isSuccess ? (
        <div className="auth-success-state">
          <div className="global-success">
            <CheckCircle2 size={18} />
            <span>
              If an account exists for that email, we have sent password reset instructions.
            </span>
          </div>
          <Link href="/login" className="btn-primary" style={{ marginTop: '1rem', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
            Back to login
          </Link>
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
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <div className="input-container">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  placeholder="name@school.edu.in"
                  className={`form-input ${errors.email ? "has-error" : ""}`}
                  disabled={isSubmitting}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <span className="error-message">{errors.email.message}</span>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="spinner" size={18} />
                  Sending instructions...
                </>
              ) : (
                "Send reset instructions"
              )}
            </button>
          </form>

          <div className="auth-footer">
            Remember your password? <Link href="/login">Back to login</Link>
          </div>
        </>
      )}
    </div>
  );
}
