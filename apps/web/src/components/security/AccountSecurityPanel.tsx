"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/auth.store";

interface SessionRecord {
  id: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  status: string;
  authMethod: string;
  mfaVerifiedAt?: string | null;
  lastSeenAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
}

interface Enrollment {
  secret: string;
  qrCodeDataUrl: string;
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-xl)",
  padding: "1.5rem",
};

function errorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
}

export function AccountSecurityPanel() {
  const router = useRouter();
  const { updateUser, logout } = useAuthStore();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const loadSecurity = useCallback(async () => {
    setLoading(true);
    try {
      const [profileResponse, sessionResponse] = await Promise.all([
        apiClient.get("/auth/me"),
        apiClient.get("/auth/sessions"),
      ]);
      const profile = profileResponse.data.data;
      setMfaEnabled(Boolean(profile.twoFactorEnabled));
      updateUser({
        twoFactorEnabled: Boolean(profile.twoFactorEnabled),
        mfaEnrolledAt: profile.mfaEnrolledAt || null,
      });
      setSessions(sessionResponse.data.data || []);
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error, "Unable to load account security status.") });
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  useEffect(() => {
    queueMicrotask(() => void loadSecurity());
  }, [loadSecurity]);

  const beginEnrollment = async () => {
    if (!password) return setNotice({ type: "error", text: "Enter your current password first." });
    setBusy("mfa-setup");
    try {
      const response = await apiClient.post("/auth/mfa/setup", { password });
      setEnrollment(response.data.data);
      setRecoveryCodes([]);
      setNotice({ type: "success", text: "Scan the QR code and enter the current authenticator code." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error, "MFA enrollment could not be started.") });
    } finally {
      setBusy(null);
    }
  };

  const confirmEnrollment = async () => {
    setBusy("mfa-confirm");
    try {
      const response = await apiClient.post("/auth/mfa/verify", { token });
      setRecoveryCodes(response.data.data.recoveryCodes || []);
      setMfaEnabled(true);
      updateUser({ twoFactorEnabled: true });
      setEnrollment(null);
      setPassword("");
      setToken("");
      setNotice({ type: "success", text: "MFA is enabled. Save the recovery codes now; they are shown once." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error, "The authenticator code was rejected.") });
    } finally {
      setBusy(null);
    }
  };

  const disableMfa = async () => {
    if (!password || !token) return setNotice({ type: "error", text: "Password and MFA code are required." });
    setBusy("mfa-disable");
    try {
      await apiClient.delete("/auth/mfa", { data: { password, token } });
      logout();
      router.replace("/login?reason=mfa-disabled");
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error, "MFA could not be disabled.") });
      setBusy(null);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setBusy(sessionId);
    try {
      await apiClient.delete(`/auth/sessions/${sessionId}`);
      setNotice({ type: "success", text: "Session revoked." });
      await loadSecurity();
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error, "Session could not be revoked.") });
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    setBusy("revoke-others");
    try {
      const response = await apiClient.post("/auth/sessions/revoke-others");
      setNotice({ type: "success", text: `${response.data.data.revoked} other session(s) revoked.` });
      await loadSecurity();
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error, "Other sessions could not be revoked.") });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div style={cardStyle}><Loader2 className="spinner" size={22} /> Loading account security…</div>;
  }

  return (
    <>
      {notice && (
        <div role="status" style={{ ...cardStyle, padding: "0.85rem 1rem", borderColor: notice.type === "success" ? "#86efac" : "#fca5a5", color: notice.type === "success" ? "#166534" : "#991b1b" }}>
          {notice.text}
        </div>
      )}

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Multi-factor authentication</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Protect password sign-in with TOTP and one-time recovery codes.</p>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", padding: ".35rem .65rem", borderRadius: "999px", background: mfaEnabled ? "#dcfce7" : "#f1f5f9", color: mfaEnabled ? "#166534" : "#475569", fontWeight: 700, fontSize: ".75rem" }}>
            {mfaEnabled ? <ShieldCheck size={15} /> : <KeyRound size={15} />}{mfaEnabled ? "Enabled" : "Not enabled"}
          </span>
        </div>

        {!mfaEnabled && !enrollment && !recoveryCodes.length && (
          <div className="security-form-row">
            <input className="security-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Current password" autoComplete="current-password" />
            <button className="security-primary-button" onClick={() => void beginEnrollment()} disabled={busy === "mfa-setup"}>
              {busy === "mfa-setup" ? <Loader2 className="spinner" size={16} /> : <Smartphone size={16} />} Set up authenticator
            </button>
          </div>
        )}

        {enrollment && (
          <div className="mfa-enrollment-grid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrCodeDataUrl} alt="Authenticator enrollment QR code" width={190} height={190} />
            <div>
              <p style={{ fontWeight: 700, marginBottom: ".35rem" }}>1. Scan with your authenticator app</p>
              <code className="security-secret">{enrollment.secret}</code>
              <p style={{ fontWeight: 700, margin: "1rem 0 .35rem" }}>2. Confirm the current code</p>
              <div className="security-form-row">
                <input className="security-input" value={token} onChange={(event) => setToken(event.target.value)} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" />
                <button className="security-primary-button" onClick={() => void confirmEnrollment()} disabled={busy === "mfa-confirm" || token.length < 6}>
                  {busy === "mfa-confirm" ? <Loader2 className="spinner" size={16} /> : <CheckCircle2 size={16} />} Confirm MFA
                </button>
              </div>
            </div>
          </div>
        )}

        {recoveryCodes.length > 0 && (
          <div className="recovery-code-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Recovery codes — store offline</strong>
              <button className="security-secondary-button" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join("\n"))}><Copy size={14} /> Copy</button>
            </div>
            <div className="recovery-code-grid">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div>
          </div>
        )}

        {mfaEnabled && !recoveryCodes.length && (
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: ".75rem" }}>Disabling MFA revokes every active session, including this device.</p>
            <div className="security-form-row security-form-row-three">
              <input className="security-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Current password" />
              <input className="security-input" value={token} onChange={(event) => setToken(event.target.value)} placeholder="MFA or recovery code" />
              <button className="security-danger-button" onClick={() => void disableMfa()} disabled={busy === "mfa-disable"}>
                {busy === "mfa-disable" ? <Loader2 className="spinner" size={16} /> : <Trash2 size={16} />} Disable MFA
              </button>
            </div>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Session administration</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Review authentication method, MFA assurance, expiry and device activity.</p>
          </div>
          <button className="security-secondary-button" onClick={() => void revokeOthers()} disabled={busy === "revoke-others"}>
            {busy === "revoke-others" ? <Loader2 className="spinner" size={15} /> : <LogOut size={15} />} Revoke other sessions
          </button>
        </div>
        <div className="session-list">
          {sessions.map((session) => (
            <article className="session-row" key={session.id}>
              <Laptop size={21} />
              <div className="session-details">
                <strong>{session.deviceInfo || "Unknown device"}{session.isCurrentSession ? " · Current session" : ""}</strong>
                <span>{session.ipAddress || "IP unavailable"} · {session.authMethod}{session.mfaVerifiedAt ? " + MFA" : ""}</span>
                <span>Last active {new Date(session.lastSeenAt).toLocaleString()} · Expires {new Date(session.expiresAt).toLocaleString()}</span>
              </div>
              <span className={`session-status session-status-${session.status.toLowerCase()}`}>{session.status}</span>
              {!session.isCurrentSession && session.status === "ACTIVE" && (
                <button aria-label="Revoke session" className="security-icon-button" onClick={() => void revokeSession(session.id)} disabled={busy === session.id}>
                  {busy === session.id ? <Loader2 className="spinner" size={16} /> : <Trash2 size={16} />}
                </button>
              )}
            </article>
          ))}
          {!sessions.length && <p style={{ color: "var(--text-secondary)" }}>No sessions were found.</p>}
        </div>
        <button className="security-link-button" onClick={() => void loadSecurity()}><RefreshCw size={14} /> Refresh sessions</button>
      </section>
    </>
  );
}
