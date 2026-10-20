"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/axios";
import { getAuthorizedRedirect } from "@/lib/role-routes";
import { useAuthStore } from "@/store/auth.store";

function SsoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const exchanged = useRef(false);
  const code = searchParams.get("code");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    code ? null : "The identity provider did not return a valid sign-in code.",
  );

  async function completeExchange(token?: string) {
    const requestedReturnUrl = searchParams.get("returnUrl") || "/dashboard";
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
        const response = await apiClient.post("/sso/exchange", { code, ...(token ? { otp: token } : {}) });
        const { user, accessToken } = response.data.data;
        setAuth(user, accessToken);
        router.replace(getAuthorizedRedirect(requestedReturnUrl, user?.role));
    } catch (reason: unknown) {
      const apiError = reason as { response?: { data?: { message?: string; error?: string } } };
      if (apiError.response?.data?.error === "MFA_REQUIRED") {
        setMfaRequired(true);
      } else {
        setError(apiError.response?.data?.message || "Enterprise sign-in could not be completed.");
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;
    void completeExchange();
    // The callback code is exchanged once on arrival; retries are explicit form submissions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, router, searchParams, setAuth]);

  return (
    <main className="login-page">
      <div className="sso-callback-card">
        {mfaRequired ? (
          <>
            <ShieldCheck size={38} className="sso-callback-success" />
            <h1>Verify your identity</h1>
            <p>Enter your authenticator code or a recovery code to complete enterprise sign-in.</p>
            {error && <p role="alert" className="sso-callback-error">{error}</p>}
            <form className="login-form" onSubmit={(event) => { event.preventDefault(); void completeExchange(otp); }}>
              <label className="form-label" htmlFor="sso-otp">Authenticator or recovery code</label>
              <input id="sso-otp" className="form-input" autoComplete="one-time-code" autoFocus required maxLength={32} value={otp} onChange={(event) => setOtp(event.target.value)} disabled={busy} />
              <button className="btn-signin" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in"}</button>
              <Link href="/login">Use another account</Link>
            </form>
          </>
        ) : error ? (
          <>
            <AlertCircle size={36} className="sso-callback-error" />
            <h1>Sign-in was not completed</h1>
            <p>{error}</p>
            <Link href="/login" className="btn-signin">Return to sign in</Link>
          </>
        ) : (
          <>
            <ShieldCheck size={38} className="sso-callback-success" />
            <h1>Verifying enterprise sign-in</h1>
            <p>Your identity assertion is being exchanged for a secure ERP session.</p>
            <Loader2 className="spinner sso-callback-loader" size={25} />
          </>
        )}
      </div>
    </main>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense fallback={<main className="login-page" />}>
      <SsoCallbackContent />
    </Suspense>
  );
}
