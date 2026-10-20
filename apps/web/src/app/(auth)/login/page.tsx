"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Mail, Lock, AlertCircle, Loader2, Eye, EyeOff,
  ShieldCheck, HelpCircle, Building2, X, AlertTriangle,
  KeyRound, Fingerprint, ExternalLink, ArrowRight,
  GraduationCap, UsersRound
} from "lucide-react";
import { LoginSchema } from "@school-erp/shared/src/schemas/auth.schema";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/auth.store";
import { getAuthorizedRedirect } from "@/lib/role-routes";

type LoginFormValues = z.input<typeof LoginSchema>;
type SsoProvider = { name: string; slug: string; type: "OIDC" | "SAML" };

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnUrl = searchParams.get("returnUrl") || "/dashboard";
  const { setAuth } = useAuthStore();

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [schoolCode, setSchoolCode] = useState("");
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [discoveringSso, setDiscoveringSso] = useState(false);
  const [ssoMessage, setSsoMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
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
        queueMicrotask(() => setRememberMe(true));
      }
      const savedSchoolCode = localStorage.getItem("erp_school_code");
      if (savedSchoolCode) queueMicrotask(() => setSchoolCode(savedSchoolCode));
    } catch {
      // localStorage may be restricted
    }
  }, [setValue]);

  // Keyboard handler for Caps Lock detection
  const handlePasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState("CapsLock"));
  };

  const returnToCredentials = () => {
    setMfaRequired(false);
    setGlobalError(null);
    resetField("otp");
    setValue("password", "");
  };

  const discoverSso = async () => {
    const normalized = schoolCode.trim().toUpperCase();
    if (!normalized) {
      setSsoMessage("Enter your school code to discover enterprise sign-in options.");
      return;
    }
    setDiscoveringSso(true);
    setSsoMessage(null);
    try {
      const response = await apiClient.get(`/sso/${encodeURIComponent(normalized)}/providers`);
      const providers = (response.data?.data || []) as SsoProvider[];
      setSsoProviders(providers);
      localStorage.setItem("erp_school_code", normalized);
      if (!providers.length) setSsoMessage("No enabled SSO provider was found for this school.");
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setSsoProviders([]);
      setSsoMessage(apiError.response?.data?.message || "Unable to discover SSO providers.");
    } finally {
      setDiscoveringSso(false);
    }
  };

  const startSso = (provider: SsoProvider) => {
    const normalized = schoolCode.trim().toUpperCase();
    const callback = `${window.location.origin}/auth/sso/callback?returnUrl=${encodeURIComponent(rawReturnUrl)}`;
    // A full browser navigation is required because this API route redirects
    // to an external identity provider.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(
      `/api/sso/${encodeURIComponent(normalized)}/${encodeURIComponent(provider.slug)}/start?returnUrl=${encodeURIComponent(callback)}`,
    );
  };

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setGlobalError(null);
      const response = await apiClient.post("/auth/login", data);
      const { user, accessToken, refreshToken } = response.data.data;

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

      setAuth(user, accessToken, refreshToken);
      const destination = getAuthorizedRedirect(rawReturnUrl, user?.role);
      router.push(destination);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { message?: string; error?: string } } };
      const rawMsg = axiosError.response?.data?.message;
      const errorCode = axiosError.response?.data?.error;
      const status = axiosError.response?.status;

      if (errorCode === "MFA_REQUIRED") {
        setMfaRequired(true);
        setGlobalError(null);
      } else if (status === 401 && mfaRequired) {
        // Once the password has been accepted and the MFA step is visible, a
        // subsequent 401 describes the second factor, not the password.
        setGlobalError(rawMsg || "Invalid or expired authenticator/recovery code.");
      } else if (status === 401 || rawMsg === "Unauthorized") {
        setGlobalError("Invalid email or password. Please verify your school credentials and try again.");
      } else if (rawMsg) {
        setGlobalError(rawMsg);
      } else {
        setGlobalError("Unable to connect to the school server. Please verify your connection or try again.");
      }
    }
  };

  return (
    <div className="enterprise-login-page">
      <aside className="identity-brand-panel" aria-label="Agentic School ERP security overview">
        <div className="identity-brand-content">
          <div className="identity-brand-header">
            <div className="identity-brand-mark" aria-hidden="true">
              <GraduationCap size={27} strokeWidth={2.2} />
            </div>
            <div>
              <span className="identity-brand-name">Agentic School ERP</span>
              <span className="identity-school-name">Sunrise International School</span>
            </div>
          </div>

          <div className="identity-brand-message">
            <h1>One secure workspace <em>for your entire school.</em></h1>
            <p>Simplify administration, empower educators, and create better learning outcomes—all in one trusted platform.</p>
          </div>

          <div className="identity-trust-list">
            <div className="identity-trust-item">
              <span className="identity-trust-icon"><ShieldCheck size={20} /></span>
              <div>
                <strong>99.9%</strong>
                <span>Service uptime</span>
              </div>
            </div>
            <div className="identity-trust-item">
              <span className="identity-trust-icon"><Lock size={20} /></span>
              <div>
                <strong>Your data stays private</strong>
                <span>Encrypted &amp; compliant</span>
              </div>
            </div>
            <div className="identity-trust-item">
              <span className="identity-trust-icon"><UsersRound size={20} /></span>
              <div>
                <strong>Trusted by educators</strong>
                <span>Across the country</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="identity-login-shell">
        <section className="identity-login-card" aria-labelledby="login-heading">
          <div className="identity-login-header">
            <span className="identity-login-kicker">Welcome to</span>
            <h2 id="login-heading">{mfaRequired ? "Verify your identity" : "Agentic School ERP"}</h2>
            <p>
              {mfaRequired
                ? "Enter your authenticator code or a recovery code to complete sign-in."
                : "Sign in with your institutional account"}
            </p>
          </div>

          {globalError && (
            <div className="global-error" role="alert" aria-live="polite">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{globalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} method="post" className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Institutional email</label>
              <div className="input-container">
                <Mail className="input-icon" size={18} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@sunriseschool.edu.in"
                  className={`form-input ${errors.email ? "has-error" : ""}`}
                  disabled={isSubmitting}
                  readOnly={mfaRequired}
                  autoComplete="email"
                  aria-readonly={mfaRequired}
                  aria-invalid={Boolean(errors.email)}
                  suppressHydrationWarning
                  {...register("email")}
                />
              </div>
              {errors.email && <span className="error-message">{errors.email.message}</span>}
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="password">Password</label>
                {capsLockActive && (
                  <span className="caps-lock-warning">
                    <AlertTriangle size={11} /> Caps Lock is on
                  </span>
                )}
              </div>
              <div className="input-container">
                <Lock className="input-icon" size={18} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className={`form-input ${errors.password ? "has-error" : ""}`}
                  disabled={isSubmitting}
                  readOnly={mfaRequired}
                  autoComplete="current-password"
                  aria-readonly={mfaRequired}
                  onKeyDown={handlePasswordKey}
                  onKeyUp={handlePasswordKey}
                  aria-invalid={Boolean(errors.password)}
                  suppressHydrationWarning
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="error-message">{errors.password.message}</span>}
            </div>

            {mfaRequired && (
              <div className="form-group mfa-challenge">
                <label className="form-label" htmlFor="otp">Authenticator or recovery code</label>
                <div className="input-container">
                  <KeyRound className="input-icon" size={18} aria-hidden="true" />
                  <input
                    id="otp"
                    type="text"
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    placeholder="6-digit or recovery code"
                    className={`form-input ${errors.otp ? "has-error" : ""}`}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.otp)}
                    autoFocus
                    {...register("otp")}
                  />
                </div>
                {errors.otp && <span className="error-message">{errors.otp.message}</span>}
                <span className="field-hint">Recovery codes can be used once in place of an authenticator code.</span>
              </div>
            )}

            <div className="login-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember this device</span>
              </label>
              {mfaRequired ? (
                <button type="button" className="change-account-button" onClick={returnToCredentials}>
                  Use another account
                </button>
              ) : (
                <Link href="/forgot-password" className="forgot-link">Forgot password?</Link>
              )}
            </div>

            <button type="submit" className="btn-signin" disabled={isSubmitting} suppressHydrationWarning>
              {isSubmitting ? (
                <><Loader2 className="spinner" size={18} /> Authenticating...</>
              ) : (
                <>{mfaRequired ? "Verify and sign in" : "Continue"}<ArrowRight size={18} /></>
              )}
            </button>
          </form>

          {!mfaRequired && (
            <>
              <div className="enterprise-divider"><span>or</span></div>
              <div className="sso-discovery">
                <div className="sso-heading">
                  <strong>Enterprise SSO</strong>
                  <label htmlFor="school-code">Enter school code</label>
                </div>
                <div className="sso-school-row">
                  <div className="input-container">
                    <Building2 className="input-icon" size={18} aria-hidden="true" />
                    <input
                      id="school-code"
                      value={schoolCode}
                      onChange={(event) => setSchoolCode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void discoverSso();
                        }
                      }}
                      className="form-input"
                      placeholder="e.g. SIS2026"
                      autoComplete="organization"
                    />
                  </div>
                  <button type="button" className="btn-discover-sso" onClick={() => void discoverSso()} disabled={discoveringSso}>
                    {discoveringSso ? <Loader2 className="spinner" size={17} /> : <Fingerprint size={17} />}
                    Continue with SSO
                  </button>
                </div>
                {ssoMessage && <p className="sso-message" role="status">{ssoMessage}</p>}
                {ssoProviders.length > 0 && (
                  <div className="sso-provider-list">
                    {ssoProviders.map((provider) => (
                      <button key={provider.slug} type="button" className="btn-sso-provider" onClick={() => startSso(provider)}>
                        <ShieldCheck size={17} />
                        <span>Continue with {provider.name}</span>
                        <small>{provider.type}</small>
                        <ExternalLink size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="identity-security-strip">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Secure access • MFA protected</span>
          </div>
        </section>

        <footer className="identity-login-footer">
          <span>© 2026 Sunrise International School</span>
          <span aria-hidden="true">•</span>
          <button type="button" onClick={() => setShowHelpModal(true)}>Help &amp; support</button>
          <span aria-hidden="true">•</span>
          <span>Session 2026–27</span>
        </footer>
      </main>

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
