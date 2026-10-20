"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/auth.store";

type Provider = { id: string; name: string; slug: string; type: "OIDC" | "SAML"; enabled: boolean; enforceSso: boolean; jitProvisioning: boolean };
type ScimToken = { id: string; name: string; schoolId: string; isActive: boolean; expiresAt?: string | null; lastUsedAt?: string | null; createdAt: string };
type BreakGlassGrant = { id: string; schoolId: string; reason: string; status: string; requestedAt: string; expiresAt?: string | null; requester?: { email?: string }; approver?: { email?: string }; school?: { name?: string; code?: string } };

const card: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xl)", padding: "1.5rem" };
const field = "security-input";
const messageOf = (error: unknown, fallback: string) => (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;

export function EnterpriseIdentityPanel() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const canManageSchoolIdentity = user?.role === "SCHOOL_ADMIN" && Boolean(user.schoolId);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [grants, setGrants] = useState<BreakGlassGrant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [targetSchoolId, setTargetSchoolId] = useState(user?.schoolId || "");
  const [newScimToken, setNewScimToken] = useState<string | null>(null);
  const [scimName, setScimName] = useState("Directory provisioning");
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [providerForm, setProviderForm] = useState({
    name: "", slug: "", type: "OIDC" as "OIDC" | "SAML", issuer: "", clientId: "", clientSecret: "",
    samlEntityId: "", samlSsoUrl: "", samlCertificate: "", allowedDomains: "", enabled: false, jitProvisioning: true, enforceSso: false,
  });

  const load = useCallback(async () => {
    try {
      const requests: Promise<unknown>[] = [];
      if (canManageSchoolIdentity) {
        requests.push(apiClient.get("/enterprise-identity/providers").then((response) => setProviders(response.data.data || [])));
      }
      if (targetSchoolId) {
        requests.push(apiClient.get(`/enterprise-identity/scim-tokens?schoolId=${encodeURIComponent(targetSchoolId)}`).then((response) => setTokens(response.data.data || [])));
      }
      if (isSuperAdmin) {
        requests.push(apiClient.get("/enterprise-identity/break-glass").then((response) => setGrants(response.data.data || [])));
      }
      await Promise.all(requests);
    } catch (error) {
      setNotice({ type: "error", text: messageOf(error, "Enterprise identity configuration could not be loaded.") });
    }
  }, [canManageSchoolIdentity, isSuperAdmin, targetSchoolId]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  if (!canManageSchoolIdentity && !isSuperAdmin) return null;

  const createProvider = async () => {
    setBusy("provider");
    try {
      const payload = {
        name: providerForm.name,
        slug: providerForm.slug,
        type: providerForm.type,
        enabled: providerForm.enabled,
        jitProvisioning: providerForm.jitProvisioning,
        enforceSso: providerForm.enforceSso,
        allowedDomains: providerForm.allowedDomains.split(",").map((item) => item.trim()).filter(Boolean),
        defaultRole: "TEACHER",
        ...(providerForm.type === "OIDC" ? { issuer: providerForm.issuer, clientId: providerForm.clientId, clientSecret: providerForm.clientSecret || undefined } : {
          samlEntityId: providerForm.samlEntityId, samlSsoUrl: providerForm.samlSsoUrl, samlCertificate: providerForm.samlCertificate,
        }),
      };
      await apiClient.post("/enterprise-identity/providers", payload);
      setNotice({ type: "success", text: `${providerForm.type} identity provider created.` });
      setProviderForm((current) => ({ ...current, name: "", slug: "", clientSecret: "", samlCertificate: "" }));
      await load();
    } catch (error) {
      setNotice({ type: "error", text: messageOf(error, "Identity provider could not be created.") });
    } finally { setBusy(null); }
  };

  const createScimToken = async () => {
    if (!targetSchoolId) return setNotice({ type: "error", text: "A school ID is required." });
    setBusy("scim");
    try {
      const response = await apiClient.post("/enterprise-identity/scim-tokens", { schoolId: targetSchoolId, name: scimName });
      setNewScimToken(response.data.data.token);
      setNotice({ type: "success", text: "SCIM token created. Copy it now; it cannot be retrieved later." });
      await load();
    } catch (error) {
      setNotice({ type: "error", text: messageOf(error, "SCIM token could not be created.") });
    } finally { setBusy(null); }
  };

  const revokeScimToken = async (id: string) => {
    setBusy(id);
    try {
      await apiClient.delete(`/enterprise-identity/scim-tokens/${id}`);
      setNotice({ type: "success", text: "SCIM token revoked." });
      await load();
    } catch (error) { setNotice({ type: "error", text: messageOf(error, "SCIM token could not be revoked.") }); }
    finally { setBusy(null); }
  };

  const requestBreakGlass = async () => {
    if (!targetSchoolId || breakGlassReason.trim().length < 20) return setNotice({ type: "error", text: "School ID and a reason of at least 20 characters are required." });
    setBusy("break-glass");
    try {
      await apiClient.post("/enterprise-identity/break-glass", { schoolId: targetSchoolId, reason: breakGlassReason });
      setBreakGlassReason("");
      setNotice({ type: "success", text: "Break-glass access requested. A different super administrator must approve it." });
      await load();
    } catch (error) { setNotice({ type: "error", text: messageOf(error, "Break-glass request failed.") }); }
    finally { setBusy(null); }
  };

  const actOnGrant = async (grant: BreakGlassGrant, action: "approve" | "revoke") => {
    setBusy(grant.id);
    try {
      await apiClient.post(`/enterprise-identity/break-glass/${grant.id}/${action}`, action === "approve" ? { durationMinutes: 30 } : { reason: "Revoked from enterprise security console" });
      setNotice({ type: "success", text: `Break-glass request ${action === "approve" ? "approved for 30 minutes" : "revoked"}.` });
      await load();
    } catch (error) { setNotice({ type: "error", text: messageOf(error, `Break-glass request could not be ${action}d.`) }); }
    finally { setBusy(null); }
  };

  return (
    <>
      {notice && <div style={{ ...card, padding: ".85rem 1rem", borderColor: notice.type === "success" ? "#86efac" : "#fca5a5", color: notice.type === "success" ? "#166534" : "#991b1b" }}>{notice.text}</div>}

      {canManageSchoolIdentity && (
        <section style={card}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>SSO identity providers</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "1rem" }}>Configure OIDC or signed SAML federation. Disabled providers never appear on the login page.</p>
          <div className="identity-provider-list">
            {providers.map((provider) => <div key={provider.id} className="identity-provider-row"><KeyRound size={18} /><strong>{provider.name}</strong><span>{provider.type}</span><span>{provider.enabled ? "Enabled" : "Disabled"}</span><span>{provider.enforceSso ? "Password blocked" : "Password allowed"}</span></div>)}
            {!providers.length && <p style={{ color: "var(--text-secondary)" }}>No identity providers configured.</p>}
          </div>
          <div className="identity-form-grid">
            <input className={field} placeholder="Provider name" value={providerForm.name} onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })} />
            <input className={field} placeholder="Slug (e.g. microsoft)" value={providerForm.slug} onChange={(event) => setProviderForm({ ...providerForm, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
            <select className={field} value={providerForm.type} onChange={(event) => setProviderForm({ ...providerForm, type: event.target.value as "OIDC" | "SAML" })}><option value="OIDC">OIDC</option><option value="SAML">SAML 2.0</option></select>
            <input className={field} placeholder="Allowed domains, comma-separated" value={providerForm.allowedDomains} onChange={(event) => setProviderForm({ ...providerForm, allowedDomains: event.target.value })} />
            {providerForm.type === "OIDC" ? <><input className={field} placeholder="Issuer URL" value={providerForm.issuer} onChange={(event) => setProviderForm({ ...providerForm, issuer: event.target.value })} /><input className={field} placeholder="Client ID" value={providerForm.clientId} onChange={(event) => setProviderForm({ ...providerForm, clientId: event.target.value })} /><input className={field} type="password" placeholder="Client secret (minimum 8 characters)" value={providerForm.clientSecret} onChange={(event) => setProviderForm({ ...providerForm, clientSecret: event.target.value })} /></> : <><input className={field} placeholder="SAML entity ID" value={providerForm.samlEntityId} onChange={(event) => setProviderForm({ ...providerForm, samlEntityId: event.target.value })} /><input className={field} placeholder="SAML SSO URL" value={providerForm.samlSsoUrl} onChange={(event) => setProviderForm({ ...providerForm, samlSsoUrl: event.target.value })} /><textarea className={field} placeholder="X.509 signing certificate" value={providerForm.samlCertificate} onChange={(event) => setProviderForm({ ...providerForm, samlCertificate: event.target.value })} /></>}
          </div>
          <div className="identity-options"><label><input type="checkbox" checked={providerForm.enabled} onChange={(event) => setProviderForm({ ...providerForm, enabled: event.target.checked })} /> Enabled</label><label><input type="checkbox" checked={providerForm.jitProvisioning} onChange={(event) => setProviderForm({ ...providerForm, jitProvisioning: event.target.checked })} /> JIT provisioning</label><label><input type="checkbox" checked={providerForm.enforceSso} onChange={(event) => setProviderForm({ ...providerForm, enforceSso: event.target.checked })} /> Enforce SSO</label></div>
          <button className="security-primary-button" onClick={() => void createProvider()} disabled={busy === "provider"}><Plus size={16} /> Create provider</button>
        </section>
      )}

      <section style={card}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>SCIM provisioning</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "1rem" }}>Issue scoped bearer credentials for your directory provider. Secret values are displayed once.</p>
        {isSuperAdmin && <input className={field} placeholder="Target school ID" value={targetSchoolId} onChange={(event) => setTargetSchoolId(event.target.value)} style={{ marginBottom: ".75rem" }} />}
        <div className="security-form-row"><input className={field} value={scimName} onChange={(event) => setScimName(event.target.value)} placeholder="Token name" /><button className="security-primary-button" onClick={() => void createScimToken()} disabled={busy === "scim"}><KeyRound size={16} /> Create SCIM token</button></div>
        {newScimToken && <div className="one-time-secret"><AlertTriangle size={18} /><code>{newScimToken}</code><button className="security-secondary-button" onClick={() => void navigator.clipboard.writeText(newScimToken)}><Copy size={14} /> Copy</button></div>}
        <div className="token-list">{tokens.map((tokenRecord) => <div className="token-row" key={tokenRecord.id}><div><strong>{tokenRecord.name}</strong><span>Created {new Date(tokenRecord.createdAt).toLocaleString()} · Last used {tokenRecord.lastUsedAt ? new Date(tokenRecord.lastUsedAt).toLocaleString() : "never"}</span></div><span>{tokenRecord.isActive ? "Active" : "Revoked"}</span>{tokenRecord.isActive && <button className="security-icon-button" onClick={() => void revokeScimToken(tokenRecord.id)}>{busy === tokenRecord.id ? <Loader2 className="spinner" size={15} /> : <Trash2 size={15} />}</button>}</div>)}</div>
        <button className="security-link-button" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button>
      </section>

      {isSuperAdmin && (
        <section style={{ ...card, borderColor: "#fca5a5" }}>
          <div style={{ display: "flex", gap: ".65rem", alignItems: "center" }}><ShieldAlert color="#b91c1c" /><div><h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Break-glass access</h2><p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Emergency tenant access requires approval by a different super administrator and expires automatically.</p></div></div>
          <div className="identity-form-grid" style={{ marginTop: "1rem" }}><input className={field} placeholder="Target school ID" value={targetSchoolId} onChange={(event) => setTargetSchoolId(event.target.value)} /><textarea className={field} placeholder="Document the emergency reason (minimum 20 characters)" value={breakGlassReason} onChange={(event) => setBreakGlassReason(event.target.value)} /></div>
          <button className="security-danger-button" onClick={() => void requestBreakGlass()} disabled={busy === "break-glass"}><AlertTriangle size={16} /> Request emergency access</button>
          <div className="grant-list">{grants.map((grant) => <article className="grant-row" key={grant.id}><div><strong>{grant.school?.name || grant.schoolId} · {grant.status}</strong><span>{grant.reason}</span><span>Requested by {grant.requester?.email || "unknown"} at {new Date(grant.requestedAt).toLocaleString()}</span></div><div className="grant-actions">{grant.status === "PENDING" && <button className="security-primary-button" onClick={() => void actOnGrant(grant, "approve")}><CheckCircle2 size={14} /> Approve 30m</button>}{["PENDING", "ACTIVE"].includes(grant.status) && <button className="security-danger-button" onClick={() => void actOnGrant(grant, "revoke")}><Trash2 size={14} /> Revoke</button>}</div></article>)}</div>
        </section>
      )}
    </>
  );
}
