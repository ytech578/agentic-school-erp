"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Users, Plus, Search, Shield, CheckCircle2, XCircle,
  RefreshCw, Key, Edit2, MoreVertical, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

// ─── Helpers ───────────────────────────────────────────────────────────────

const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"];
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"];

function roleBadge(role: string) {
  const map: Record<string, { color: string; bg: string }> = {
    SUPER_ADMIN: { color: "#7c3aed", bg: "#ede9fe" },
    SCHOOL_ADMIN: { color: "#2563eb", bg: "#dbeafe" },
    PRINCIPAL: { color: "#0891b2", bg: "#cffafe" },
    TEACHER: { color: "#059669", bg: "#d1fae5" },
    STUDENT: { color: "#d97706", bg: "#fef3c7" },
    PARENT: { color: "#db2777", bg: "#fce7f3" },
  };
  const s = map[role] || { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span style={{ padding: "0.2rem 0.625rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, color: s.color, background: s.bg }}>
      {role.replace("_", " ")}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { color: string; bg: string }> = {
    ACTIVE: { color: "#166534", bg: "#f0fdf4" },
    INACTIVE: { color: "#6b7280", bg: "#f3f4f6" },
    SUSPENDED: { color: "#991b1b", bg: "#fef2f2" },
    PENDING_VERIFICATION: { color: "#854d0e", bg: "#fefce8" },
  };
  const s = map[status] || { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span style={{ padding: "0.2rem 0.625rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, color: s.color, background: s.bg }}>
      {status === "PENDING_VERIFICATION" ? "Pending" : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#6366f1", "#2563eb", "#0891b2", "#059669", "#d97706", "#db2777"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ─── Create User Modal ─────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated, currentUserRole }: { onClose: () => void; onCreated: () => void; currentUserRole?: string }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "TEACHER", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<any>(null);

  const submit = async () => {
    if (!form.firstName || !form.email || !form.role) { setError("First name, email and role are required"); return; }
    setLoading(true); setError("");
    try {
      const res = await apiClient.post("/users", form);
      setCreated(res.data.data || res.data);
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create user");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", backdropFilter: "var(--modal-backdrop-blur)", WebkitBackdropFilter: "var(--modal-backdrop-blur)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: "var(--bg-surface-solid)", backgroundColor: "var(--bg-surface-solid)", opacity: 1, borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", padding: "2rem", width: "100%", maxWidth: "480px", boxShadow: "var(--modal-shadow)", animation: "zoomIn 0.2s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.125rem" }}>Create New User</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={20} /></button>
        </div>

        {created ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <CheckCircle2 size={48} color="#16a34a" style={{ marginBottom: "1rem" }} />
            <p style={{ fontWeight: 600, fontSize: "1.125rem", marginBottom: "0.5rem" }}>User Created!</p>
            <p style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>{created.firstName} {created.lastName}</p>
            {created.temporaryPassword && (
              <div style={{ background: "var(--bg-app)", borderRadius: "var(--radius-md)", padding: "0.875rem", marginTop: "1rem", marginBottom: "1rem" }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.375rem" }}>Temporary Password (share securely):</p>
                <code style={{ fontWeight: 700, fontSize: "1rem", color: "var(--primary-600)" }}>{created.temporaryPassword}</code>
              </div>
            )}
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.875rem" }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input label="First Name *" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="John" />
                <Input label="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Doe" />
              </div>
              <Input label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@school.edu" />
              <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem" }}>
                  {ROLES.filter(r => currentUserRole === 'SUPER_ADMIN' ? true : (r !== 'SUPER_ADMIN' && r !== 'SCHOOL_ADMIN')).map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
              </div>
              <Input label="Password (optional — auto-generated if blank)" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Leave blank to auto-generate" />
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button onClick={onClose} style={{ padding: "0.625rem 1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
                <Button onClick={submit} isLoading={loading}><Plus size={16} style={{ marginRight: "0.375rem" }} />Create User</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Edit User Modal ───────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSaved, currentUserRole }: { user: any; onClose: () => void; onSaved: () => void; currentUserRole?: string }) {
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || "", role: user.role });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const save = async () => {
    setLoading(true); setError("");
    try {
      await apiClient.patch(`/users/${user.id}`, form);
      onSaved(); onClose();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed to update"); }
    finally { setLoading(false); }
  };

  const changeStatus = async (status: string) => {
    try { await apiClient.patch(`/users/${user.id}/status`, { status }); onSaved(); onClose(); } catch { }
  };

  const doResetPw = async () => {
    if (!resetPw || resetPw.length < 6) { setPwMsg("Password must be at least 6 characters"); return; }
    setPwLoading(true);
    try {
      await apiClient.post(`/users/${user.id}/reset-password`, { newPassword: resetPw });
      setPwMsg("Password reset successfully!"); setResetPw("");
    } catch { setPwMsg("Failed to reset password"); }
    finally { setPwLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", backdropFilter: "var(--modal-backdrop-blur)", WebkitBackdropFilter: "var(--modal-backdrop-blur)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: "var(--bg-surface-solid)", backgroundColor: "var(--bg-surface-solid)", opacity: 1, borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", padding: "2rem", width: "100%", maxWidth: "520px", boxShadow: "var(--modal-shadow)", maxHeight: "90vh", overflowY: "auto", animation: "zoomIn 0.2s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <Avatar name={`${user.firstName} ${user.lastName}`} size={44} />
            <div>
              <p style={{ fontWeight: 700 }}>{user.firstName} {user.lastName}</p>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={20} /></button>
        </div>

        {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.875rem" }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Profile */}
          <section>
            <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>Profile</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input label="First Name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              <Input label="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", height: "42px" }}>
                  {ROLES.filter(r => currentUserRole === 'SUPER_ADMIN' ? true : (r !== 'SUPER_ADMIN' && r !== 'SCHOOL_ADMIN')).map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={save} isLoading={loading}><Edit2 size={14} style={{ marginRight: "0.375rem" }} />Save Changes</Button>
            </div>
          </section>

          <hr style={{ border: "none", borderTop: "1px solid var(--border-light)" }} />

          {/* Account status */}
          <section>
            <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>Account Status</h3>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => changeStatus(s)} style={{
                  padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                  border: user.status === s ? "2px solid var(--primary-500)" : "1px solid var(--border-default)",
                  background: user.status === s ? "var(--primary-50)" : "transparent",
                  color: user.status === s ? "var(--primary-600)" : "var(--text-secondary)",
                }}>
                  {s === "PENDING_VERIFICATION" ? "Pending" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </section>

          <hr style={{ border: "none", borderTop: "1px solid var(--border-light)" }} />

          {/* Password reset */}
          <section>
            <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>Reset Password</h3>
            {pwMsg && <p style={{ fontSize: "0.8125rem", color: pwMsg.includes("success") ? "#166534" : "#991b1b", marginBottom: "0.75rem" }}>{pwMsg}</p>}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Input type="password" placeholder="New password (min 6 chars)" value={resetPw} onChange={e => setResetPw(e.target.value)} />
              <Button onClick={doResetPw} isLoading={pwLoading} style={{ flexShrink: 0 }}>
                <Key size={14} style={{ marginRight: "0.375rem" }} />Reset
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Main Users Page ────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: authUser } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      const res = await apiClient.get(`/users?${params}`);
      const d = res.data.data || res.data;
      setUsers(d.data || d || []);
      setMeta(d.meta || { total: 0, page: 1, totalPages: 1 });
    } catch { } finally { setLoading(false); }
  }, [search, role, status, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "0.25rem" }}>User Management</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Manage all user accounts, roles, and permissions</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} style={{ marginRight: "0.375rem" }} />Create User
        </Button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {[
          { label: "Total Users", value: meta.total, color: "var(--primary-500)", icon: Users },
          { label: "Active", value: users.filter(u => u.status === "ACTIVE").length, color: "var(--success)", icon: CheckCircle2 },
          { label: "Inactive / Suspended", value: users.filter(u => u.status !== "ACTIVE").length, color: "var(--danger)", icon: XCircle },
          { label: "Roles", value: ROLES.length, color: "#8b5cf6", icon: Shield },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", padding: "1rem 1.25rem", border: "1px solid var(--border-light)", display: "flex", gap: "0.875rem", alignItems: "center" }}>
            <div style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", background: `${s.color}18` }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: "1.375rem", fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <input
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: "100%", padding: "0.625rem 0.875rem 0.625rem 2.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem" }}
          />
        </div>
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", minWidth: "140px" }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", minWidth: "140px" }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s === "PENDING_VERIFICATION" ? "Pending" : s}</option>)}
        </select>
        <button onClick={fetchUsers} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center" }} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "var(--bg-app)" }}>
              {["User", "Email", "Role", "Status", "Last Login", "Actions"].map(h => (
                <th key={h} style={{ padding: "0.875rem 1rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.8125rem" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>No users found</td></tr>
            ) : (
              users.map((u, i) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-app)" }}>
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Avatar name={`${u.firstName} ${u.lastName}`} size={36} />
                      <div>
                        <p style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</p>
                        {u.phone && <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "0.875rem 1rem", color: "var(--text-secondary)" }}>{u.email}</td>
                  <td style={{ padding: "0.875rem 1rem" }}>{roleBadge(u.role)}</td>
                  <td style={{ padding: "0.875rem 1rem" }}>{statusBadge(u.status)}</td>
                  <td style={{ padding: "0.875rem 1rem", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Never"}
                  </td>
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <button onClick={() => setEditUser(u)} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      <Edit2 size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>
              Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, meta.total)} of {meta.total} users
            </span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "0.375rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ color: "var(--text-secondary)" }}>Page {page} / {meta.totalPages}</span>
              <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} style={{ padding: "0.375rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: page === meta.totalPages ? "not-allowed" : "pointer", opacity: page === meta.totalPages ? 0.4 : 1, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={fetchUsers} currentUserRole={authUser?.role} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={fetchUsers} currentUserRole={authUser?.role} />}
    </div>
  );
}
