import React, { useState } from "react";
import { apiClient } from "@/lib/axios";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus, CheckCircle2, X } from "lucide-react";

export const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"] as const;
export const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"] as const;

export function CreateUserModal({ onClose, onCreated, currentUserRole }: { onClose: () => void; onCreated: () => void; currentUserRole?: string }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "TEACHER", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<any>(null);

  const submit = async () => {
    if (!form.firstName || !form.email || !form.role) {
      setError("First name, email and role are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.post("/users", form);
      setCreated(res.data.data || res.data);
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
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
          maxWidth: "480px",
          boxShadow: "var(--modal-shadow)",
          animation: "zoomIn 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)" }}>Create New User</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
            <X size={20} />
          </button>
        </div>

        {created ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: "1rem", marginInline: "auto" }} />
            <p style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>User Created Successfully!</p>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>{created.firstName} {created.lastName} ({created.email})</p>
            {created.temporaryPassword && (
              <div style={{ background: "var(--bg-app)", borderRadius: "var(--radius-md)", padding: "0.875rem", marginBottom: "1.5rem", border: "1px solid var(--border-default)" }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.375rem" }}>Temporary Password:</p>
                <code style={{ fontWeight: 700, fontSize: "1rem", color: "var(--primary-500)" }}>{created.temporaryPassword}</code>
              </div>
            )}
            <Button onClick={onClose} style={{ width: "100%" }}>Done</Button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.25)", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.875rem" }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input label="First Name *" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="e.g. Rahul" />
                <Input label="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="e.g. Sharma" />
              </div>
              <Input label="Email Address *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@school.edu.in" />
              <Input label="Phone Number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Role *</label>
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
              <Input
                label="Password (optional — auto-generated if blank)"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to auto-generate"
              />
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: "0.625rem 1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  Cancel
                </button>
                <Button onClick={submit} isLoading={loading}>
                  <Plus size={16} style={{ marginRight: "0.375rem" }} /> Create User
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
