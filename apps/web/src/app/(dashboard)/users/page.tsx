"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiClient } from "@/lib/axios";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Users, Plus, Search, Shield, CheckCircle2, XCircle,
  RefreshCw, Key, Edit2, X, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, GraduationCap, Briefcase, UserCheck, ShieldAlert
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { CreateUserModal, ROLES, STATUSES } from "@/components/users/CreateUserModal";
import { EditUserModal } from "@/components/users/EditUserModal";
import { UserAvatar } from "@/components/users/UserAvatar";

// ─── Constants & Types ──────────────────────────────────────────────────────


interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: {
    SUPER_ADMIN: number;
    SCHOOL_ADMIN: number;
    PRINCIPAL: number;
    TEACHER: number;
    STUDENT: number;
    PARENT: number;
  };
}

const DEFAULT_STATS: UserStats = {
  total: 0,
  active: 0,
  inactive: 0,
  byRole: {
    SUPER_ADMIN: 0,
    SCHOOL_ADMIN: 0,
    PRINCIPAL: 0,
    TEACHER: 0,
    STUDENT: 0,
    PARENT: 0,
  },
};

// ─── Role & Status Badges ───────────────────────────────────────────────────

function roleBadge(role: string) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    SUPER_ADMIN: { color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", border: "rgba(139, 92, 246, 0.25)" },
    SCHOOL_ADMIN: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.25)" },
    PRINCIPAL: { color: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", border: "rgba(6, 182, 212, 0.25)" },
    TEACHER: { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.25)" },
    STUDENT: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.25)" },
    PARENT: { color: "#ec4899", bg: "rgba(236, 72, 153, 0.12)", border: "rgba(236, 72, 153, 0.25)" },
  };
  const s = map[role] || { color: "var(--text-secondary)", bg: "var(--bg-app)", border: "var(--border-default)" };
  return (
    <span
      style={{
        padding: "0.25rem 0.625rem",
        borderRadius: "var(--radius-full)",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
      }}
    >
      {role.replace("_", " ")}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    ACTIVE: { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.25)" },
    INACTIVE: { color: "var(--text-tertiary)", bg: "var(--bg-app)", border: "var(--border-default)" },
    SUSPENDED: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.25)" },
    PENDING_VERIFICATION: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.25)" },
  };
  const s = map[status] || { color: "var(--text-secondary)", bg: "var(--bg-app)", border: "var(--border-default)" };
  return (
    <span
      style={{
        padding: "0.25rem 0.625rem",
        borderRadius: "var(--radius-full)",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      {status === "PENDING_VERIFICATION" ? "Pending" : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Main Users Page ────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: authUser } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  // Fetch aggregate user stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get("/users/stats");
      const data = res.data.data || res.data;
      if (data && typeof data.total === "number") {
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load user stats:", err);
    }
  }, []);

  // Fetch paginated users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (status) params.set("status", status);

      const res = await apiClient.get(`/users?${params}`);
      const items = Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      const pagination = res.data.meta || (res.data.data && res.data.data.meta) || {
        total: items.length,
        page,
        limit,
        totalPages: Math.ceil(items.length / limit) || 1,
      };

      setUsers(items);
      setMeta(pagination);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
      setMeta({ total: 0, page: 1, limit, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [search, role, status, page, limit]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const refreshAll = () => {
    fetchStats();
    fetchUsers();
  };

  // Quick Role Tabs with dynamic counts
  const roleTabs = useMemo(() => [
    { label: "All Users", value: "", count: stats.total, icon: Users },
    { label: "Students", value: "STUDENT", count: stats.byRole.STUDENT, icon: GraduationCap },
    { label: "Teachers", value: "TEACHER", count: stats.byRole.TEACHER, icon: Briefcase },
    { label: "Parents", value: "PARENT", count: stats.byRole.PARENT, icon: UserCheck },
    {
      label: "Staff & Admins",
      value: "ADMIN_GROUP",
      count: (stats.byRole.SCHOOL_ADMIN || 0) + (stats.byRole.PRINCIPAL || 0) + (stats.byRole.SUPER_ADMIN || 0),
      icon: ShieldAlert,
    },
  ], [stats]);

  const handleSelectRoleTab = (tabValue: string) => {
    if (tabValue === "ADMIN_GROUP") {
      setRole("SCHOOL_ADMIN");
    } else {
      setRole(tabValue);
    }
    setPage(1);
  };

  const isRoleTabActive = (tabValue: string) => {
    if (tabValue === "") return role === "";
    if (tabValue === "ADMIN_GROUP") return ["SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"].includes(role);
    return role === tabValue;
  };

  // Generate pagination page numbers
  const pageNumbers = useMemo(() => {
    const total = meta.totalPages || 1;
    const current = page;
    const delta = 2;
    const range: (number | string)[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) {
      range.unshift("...");
    }
    range.unshift(1);

    if (current + delta < total - 1) {
      range.push("...");
    }
    if (total > 1) {
      range.push(total);
    }

    return range;
  }, [meta.totalPages, page]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.25rem", letterSpacing: "-0.02em" }}>
            User Management
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Directory of all students, faculty, parents, and administrative staff
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={refreshAll}
            style={{
              padding: "0.625rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              cursor: "pointer",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              transition: "all 0.15s ease",
            }}
            title="Refresh All"
          >
            <RefreshCw size={16} />
          </button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} style={{ marginRight: "0.375rem" }} /> Create User
          </Button>
        </div>
      </div>

      {/* Global Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {[
          { label: "Total Users", value: stats.total || meta.total, color: "var(--primary-500)", icon: Users, sub: "Registered across school" },
          { label: "Active Accounts", value: stats.active, color: "#10b981", icon: CheckCircle2, sub: "Verified & login capable" },
          { label: "Inactive / Suspended", value: stats.inactive, color: "#ef4444", icon: XCircle, sub: "Requires review" },
          { label: "System Roles", value: ROLES.length, color: "#8b5cf6", icon: Shield, sub: "Super, Admin, Staff, Student" },
        ].map(s => (
          <div
            key={s.label}
            style={{
              background: "var(--bg-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "1.125rem 1.25rem",
              border: "1px solid var(--border-default)",
              display: "flex",
              gap: "1rem",
              alignItems: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                background: `${s.color}18`,
                color: s.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <s.icon size={22} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>
                {s.value.toLocaleString()}
              </p>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                {s.label}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.1rem" }}>
                {s.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Role Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.25rem",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        {roleTabs.map(tab => {
          const active = isRoleTabActive(tab.value);
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.label}
              onClick={() => handleSelectRoleTab(tab.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                border: active ? "1px solid var(--primary-500)" : "1px solid transparent",
                background: active ? "rgba(59, 130, 246, 0.12)" : "transparent",
                color: active ? "var(--primary-500)" : "var(--text-secondary)",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <TabIcon size={16} />
              <span>{tab.label}</span>
              <span
                style={{
                  padding: "0.125rem 0.5rem",
                  borderRadius: "var(--radius-full)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  background: active ? "var(--primary-500)" : "var(--bg-app)",
                  color: active ? "#ffffff" : "var(--text-tertiary)",
                }}
              >
                {tab.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
          padding: "1rem 1.25rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <div style={{ flex: 1, minWidth: "240px", position: "relative" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "0.875rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-tertiary)",
            }}
          />
          <input
            placeholder="Search users by name, email, phone..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem 0.625rem 2.5rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-app)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
            }}
          />
        </div>

        {/* Specific Role Dropdown */}
        <select
          value={role}
          onChange={e => {
            setRole(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "0.625rem 0.875rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-app)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            minWidth: "150px",
          }}
        >
          <option value="">All Roles</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{r.replace("_", " ")}</option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          value={status}
          onChange={e => {
            setStatus(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "0.625rem 0.875rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-app)",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            minWidth: "150px",
          }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s === "PENDING_VERIFICATION" ? "Pending Verification" : s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>

        {/* Items Per Page */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Per page:</span>
          <select
            value={limit}
            onChange={e => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            style={{
              padding: "0.625rem 0.625rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-app)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
            }}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-default)" }}>
                {["User Details", "Email", "Role", "Status", "Last Login", "Actions"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "0.875rem 1rem",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "4rem", textAlign: "center", color: "var(--text-tertiary)" }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.75rem", opacity: 0.6 }} />
                    <p style={{ fontWeight: 600 }}>Loading users directory...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "4rem", textAlign: "center", color: "var(--text-tertiary)" }}>
                    <Users size={36} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
                    <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>No users found</p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      {search || role || status ? "Try adjusting your search filters" : "Click 'Create User' to register your first user"}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((u, i) => (
                  <tr
                    key={u.id}
                    style={{
                      borderTop: "1px solid var(--border-light)",
                      background: i % 2 === 0 ? "transparent" : "var(--bg-app)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                        <UserAvatar name={`${u.firstName} ${u.lastName}`} size={38} />
                        <div>
                          <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            {u.firstName} {u.lastName}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                            {u.phone ? u.phone : "No phone provided"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "0.875rem 1rem", color: "var(--text-secondary)" }}>
                      {u.email}
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      {roleBadge(u.role)}
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      {statusBadge(u.status)}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : "Never"}
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <button
                        onClick={() => setEditUser(u)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          padding: "0.4rem 0.875rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-surface)",
                          cursor: "pointer",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Enterprise Pagination Bar — Always Visible when loaded */}
        {!loading && (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.875rem",
              flexWrap: "wrap",
              gap: "1rem",
              background: "var(--bg-surface)",
            }}
          >
            <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
              Showing {meta.total === 0 ? 0 : ((page - 1) * limit) + 1}–{Math.min(page * limit, meta.total)} of{" "}
              <strong style={{ color: "var(--text-primary)" }}>{meta.total.toLocaleString()}</strong> users
            </span>

            <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
              {/* First Page */}
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                style={{
                  padding: "0.375rem 0.625rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "transparent",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.35 : 1,
                  display: "flex",
                  alignItems: "center",
                  color: "var(--text-secondary)",
                }}
                title="First Page"
              >
                <ChevronsLeft size={16} />
              </button>

              {/* Prev Page */}
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "transparent",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.35 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                <ChevronLeft size={15} /> Prev
              </button>

              {/* Page Number Pills */}
              <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginInline: "0.25rem" }}>
                {pageNumbers.map((pNum, idx) => {
                  if (typeof pNum === "string") {
                    return (
                      <span key={`dots-${idx}`} style={{ padding: "0.25rem 0.5rem", color: "var(--text-tertiary)" }}>
                        ...
                      </span>
                    );
                  }
                  const isCurrent = pNum === page;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      style={{
                        minWidth: "32px",
                        height: "32px",
                        padding: "0 0.5rem",
                        borderRadius: "var(--radius-md)",
                        border: isCurrent ? "1px solid var(--primary-500)" : "1px solid var(--border-default)",
                        background: isCurrent ? "var(--primary-500)" : "transparent",
                        color: isCurrent ? "#ffffff" : "var(--text-primary)",
                        fontWeight: isCurrent ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Page */}
              <button
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "transparent",
                  cursor: page >= meta.totalPages ? "not-allowed" : "pointer",
                  opacity: page >= meta.totalPages ? 0.35 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                Next <ChevronRight size={15} />
              </button>

              {/* Last Page */}
              <button
                onClick={() => setPage(meta.totalPages)}
                disabled={page >= meta.totalPages}
                style={{
                  padding: "0.375rem 0.625rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "transparent",
                  cursor: page >= meta.totalPages ? "not-allowed" : "pointer",
                  opacity: page >= meta.totalPages ? 0.35 : 1,
                  display: "flex",
                  alignItems: "center",
                  color: "var(--text-secondary)",
                }}
                title="Last Page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={refreshAll}
          currentUserRole={authUser?.role}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={refreshAll}
          currentUserRole={authUser?.role}
        />
      )}
    </div>
  );
}
