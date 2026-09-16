import React, { useState } from "react";
import { apiClient } from "@/lib/axios";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Edit2, Key, X } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { ROLES, STATUSES } from "./CreateUserModal";

export function EditUserModal({ user, onClose, onSaved, currentUserRole }: { user: any; onClose: () => void; onSaved: () => void; currentUserRole?: string }) {
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || "", role: user.role });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const save = async () => {
    setLoading(true);
    setError("");
    try {
      await apiClient.patch(`/users/${user.id}`, form);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const changeStatus = async (status: string) => {
    try {
      await apiClient.patch(`/users/${user.id}/status`, { status });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update status");
    }
  };

  const doResetPw = async () => {
    if (!resetPw || resetPw.length < 6) {
      setPwMsg("Password must be at least 6 characters");
      return;
    }
    setPwLoading(true);
    try {
      await apiClient.post(`/users/${user.id}/reset-password`, { newPassword: resetPw });
      setPwMsg("Password reset successfully!");
      setResetPw("");
    } catch {
      setPwMsg("Failed to reset password");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-overlay)",
        backdropFilter: "var(--modal-backdrop-blur)",
        WebkitBackdropFilter: "var(--modal-backdrop-blur)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-default)",
          padding: "2rem",
          width: "100%",
          maxWidth: "520px",
          boxShadow: "var(--modal-shadow)",
          maxHeight: "90vh",
          overflowY: "auto",
          animation: "zoomIn 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <UserAvatar name={`${user.firstName} ${user.lastName}`} size={44} />
            <div>
              <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>{user.firstName} {user.lastName}</p>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.25)", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Profile Section */}
          <section>
            <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>Profile Information</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input label="First Name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              <Input label="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{
                    padding: "0.625rem 0.875rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-app)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                    height: "42px",
                  }}
                >
                  {ROLES.filter(r => currentUserRole === 'SUPER_ADMIN' ? true : (r !== 'SUPER_ADMIN' && r !== 'SCHOOL_ADMIN')).map(r => (
                    <option key={r} value={r}>{r.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={save} isLoading={loading}>
                <Edit2 size={14} style={{ marginRight: "0.375rem" }} /> Save Changes
              </Button>
            </div>
          </section>

          <hr style={{ border: "none", borderTop: "1px solid var(--border-light)" }} />

          {/* Account status */}
          <section>
            <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>Account Status</h3>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: user.status === s ? "2px solid var(--primary-500)" : "1px solid var(--border-default)",
                    background: user.status === s ? "var(--primary-50, rgba(59, 130, 246, 0.1))" : "transparent",
                    color: user.status === s ? "var(--primary-500)" : "var(--text-secondary)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {s === "PENDING_VERIFICATION" ? "Pending" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </section>

          <hr style={{ border: "none", borderTop: "1px solid var(--border-light)" }} />

          {/* Password reset */}
          <section>
            <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>Reset Password</h3>
            {pwMsg && (
              <p style={{ fontSize: "0.8125rem", color: pwMsg.includes("success") ? "#10b981" : "#ef4444", marginBottom: "0.75rem" }}>
                {pwMsg}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Input
                type="password"
                placeholder="New password (min 6 chars)"
                value={resetPw}
                onChange={e => setResetPw(e.target.value)}
              />
              <Button onClick={doResetPw} isLoading={pwLoading} style={{ flexShrink: 0 }}>
                <Key size={14} style={{ marginRight: "0.375rem" }} /> Reset
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
