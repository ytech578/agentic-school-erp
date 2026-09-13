"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import {
  Users, CalendarCheck, Clock, CheckCircle, XCircle, Plus, X,
  TrendingUp, AlertCircle, ChevronDown, User, Building2, Calendar,
  Briefcase, Search, Filter, Shield, Layers, Award, FileText, Check
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { formatDate } from "@/lib/formatters";

type HRTab = "requests" | "apply" | "attendance" | "roster" | "departments" | "entitlements";
type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  PENDING:   { bg: "#fef3c7", text: "#92400e", icon: Clock },
  APPROVED:  { bg: "#dcfce7", text: "#166534", icon: CheckCircle },
  REJECTED:  { bg: "#fee2e2", text: "#991b1b", icon: XCircle },
  CANCELLED: { bg: "#f1f5f9", text: "#64748b", icon: X },
};

const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "MATERNITY", "PATERNITY", "UNPAID", "COMPENSATORY"];

// ─── Staff Attendance Sub-Component ───────────────────────────────────────

function StaffAttendanceTab({ isAdmin }: { isAdmin: boolean }) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const fetchAttendance = async (d: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/hr/staff-attendance?date=${d}`);
      const result = res.data?.data ?? res.data;
      setRecords(Array.isArray(result) ? result : []);
    } catch { setRecords([]); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAttendance(date); }, [date]);

  const markAttendance = async (staffId: string, status: "PRESENT" | "ABSENT") => {
    setMarking(staffId);
    try {
      await apiClient.post("/hr/staff-attendance/mark", { staffId, date, status });
      setRecords(prev => prev.map(r => r.id === staffId ? { ...r, attendanceStatus: status } : r));
      showMsg(`Marked ${status} successfully`, "success");
    } catch (e: any) {
      showMsg(e?.response?.data?.message || "Failed to mark attendance", "error");
    } finally { setMarking(null); }
  };

  const present = records.filter(r => r.attendanceStatus === "PRESENT").length;
  const absent  = records.filter(r => r.attendanceStatus === "ABSENT").length;
  const onLeave = records.filter(r => r.attendanceStatus === "ON_LEAVE").length;
  const notMark = records.filter(r => r.attendanceStatus === "NOT_MARKED").length;

  const statusCfg: Record<string, { bg: string; color: string; label: string }> = {
    PRESENT:    { bg: "#dcfce7", color: "#166534", label: "Present" },
    ABSENT:     { bg: "#fee2e2", color: "#991b1b", label: "Absent" },
    ON_LEAVE:   { bg: "#fef3c7", color: "#92400e", label: "On Leave" },
    NOT_MARKED: { bg: "var(--bg-elevated)", color: "var(--text-tertiary)", label: "Not Marked" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Date picker + summary */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Attendance Date</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => setDate(e.target.value)}
              style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { label: "Present", count: present, color: "#059669", bg: "#f0fdf4" },
            { label: "Absent", count: absent, color: "#dc2626", bg: "#fef2f2" },
            { label: "On Leave", count: onLeave, color: "#d97706", bg: "#fffbeb" },
            { label: "Not Marked", count: notMark, color: "var(--text-secondary)", bg: "var(--bg-elevated)" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} style={{ padding: "0.6rem 1.25rem", borderRadius: "var(--radius-md)", background: bg, textAlign: "center", minWidth: "95px", border: "1px solid rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginTop: "0.25rem" }}>{label}</div>
            </div>
          ))}
        </div>
        {msg && (
          <div style={{ padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", background: msg.type === "success" ? "#dcfce7" : "#fee2e2", color: msg.type === "success" ? "#166534" : "#991b1b", fontSize: "0.8125rem", fontWeight: 600 }}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Attendance Table */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading attendance…</div>
        ) : records.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>No staff records found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["Emp ID", "Staff Name", "Department", "Designation", "Attendance Status", ...(isAdmin ? ["Quick Action"] : [])].map(h => (
                  <th key={h} style={{ padding: "0.85rem 1.25rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((s, i) => {
                const cfg = statusCfg[s.attendanceStatus] || statusCfg.NOT_MARKED;
                const isMarking = marking === s.id;
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-elevated)" }}>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.8125rem", color: "var(--text-tertiary)", fontFamily: "monospace", fontWeight: 600 }}>{s.employeeId}</td>
                    <td style={{ padding: "0.875rem 1.25rem", fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{s.name}</td>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s.department || "—"}</td>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s.designation || "—"}</td>
                    <td style={{ padding: "0.875rem 1.25rem" }}>
                      <span style={{ padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "0.875rem 1.25rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {(["PRESENT", "ABSENT"] as const).map(st => {
                            const c = statusCfg[st];
                            const active = s.attendanceStatus === st;
                            return (
                              <button
                                key={st}
                                disabled={isMarking || active}
                                onClick={() => markAttendance(s.id, st)}
                                style={{
                                  padding: "0.35rem 0.75rem", borderRadius: "var(--radius-sm)", border: `1px solid ${active ? c.color : "var(--border-default)"}`,
                                  background: active ? c.bg : "transparent", color: active ? c.color : "var(--text-secondary)",
                                  fontSize: "0.75rem", fontWeight: 700, cursor: active || isMarking ? "default" : "pointer", opacity: isMarking ? 0.6 : 1,
                                  transition: "all 0.15s",
                                }}
                              >
                                {st === "PRESENT" ? "✓ Present" : "✗ Absent"}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Staff Directory & Roster Sub-Component ─────────────────────────────────

function StaffRosterTab() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedDesig, setSelectedDesig] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const [staffRes, deptRes, desigRes] = await Promise.all([
        apiClient.get("/hr/staff", {
          params: { search: search || undefined, departmentId: selectedDept || undefined, designationId: selectedDesig || undefined, limit: 100 }
        }),
        apiClient.get("/hr/departments"),
        apiClient.get("/hr/designations"),
      ]);
      const data = staffRes.data?.data ?? staffRes.data;
      setStaffList(data?.items || (Array.isArray(data) ? data : []));
      setTotal(data?.total ?? (data?.items?.length || 0));
      setDepartments(deptRes.data?.data ?? deptRes.data ?? []);
      setDesignations(desigRes.data?.data ?? desigRes.data ?? []);
    } catch {
      setStaffList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [selectedDept, selectedDesig]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStaff();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Search & Filter Bar */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "1.25rem 1.5rem" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "260px", maxWidth: "400px", position: "relative" }}>
            <input
              placeholder="Search by name, employee ID, or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.85rem 0.6rem 2.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem" }}
            />
            <Search size={16} color="var(--text-tertiary)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
          </div>

          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            style={{ padding: "0.6rem 0.85rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem" }}
          >
            <option value="">All Departments</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={selectedDesig}
            onChange={e => setSelectedDesig(e.target.value)}
            style={{ padding: "0.6rem 0.85rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem" }}
          >
            <option value="">All Designations</option>
            {designations.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <Button type="submit" variant="secondary">Filter Staff</Button>

          {(search || selectedDept || selectedDesig) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setSearch(""); setSelectedDept(""); setSelectedDesig(""); fetchStaff(); }}
              style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}
            >
              Reset
            </Button>
          )}
        </form>
      </div>

      {/* Staff Table */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Showing <strong>{staffList.length}</strong> staff member{staffList.length === 1 ? '' : 's'} (Total: {total})
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading staff roster…</div>
        ) : staffList.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>No staff members match the selected filters.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["Employee ID", "Staff Name", "Role", "Department", "Designation", "Employment Type", "Status"].map(h => (
                  <th key={h} style={{ padding: "0.85rem 1.25rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffList.map((s, i) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-elevated)" }}>
                  <td style={{ padding: "0.875rem 1.25rem", fontFamily: "monospace", fontWeight: 600, fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                    {s.employeeId}
                  </td>
                  <td style={{ padding: "0.875rem 1.25rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                      {s.user?.firstName} {s.user?.lastName}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                      {s.user?.email}
                    </div>
                  </td>
                  <td style={{ padding: "0.875rem 1.25rem" }}>
                    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, background: "rgba(99,102,241,0.1)", color: "var(--brand-primary)" }}>
                      {s.user?.role || "STAFF"}
                    </span>
                  </td>
                  <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    {s.department?.name || "Academics"}
                  </td>
                  <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    {s.designation?.name || "Teacher"}
                  </td>
                  <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                    {s.employmentType || "FULL_TIME"}
                  </td>
                  <td style={{ padding: "0.875rem 1.25rem" }}>
                    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700, background: "#dcfce7", color: "#166534" }}>
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Departments & Structure Sub-Component ─────────────────────────────────

function DepartmentsTab() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDept, setShowAddDept] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });
  const [savingDept, setSavingDept] = useState(false);

  const fetchStructure = async () => {
    setLoading(true);
    try {
      const [deptRes, desigRes] = await Promise.all([
        apiClient.get("/hr/departments"),
        apiClient.get("/hr/designations"),
      ]);
      setDepartments(deptRes.data?.data ?? deptRes.data ?? []);
      setDesignations(desigRes.data?.data ?? desigRes.data ?? []);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStructure();
  }, []);

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name.trim()) return;
    setSavingDept(true);
    try {
      await apiClient.post("/hr/departments", deptForm);
      setDeptForm({ name: "", description: "" });
      setShowAddDept(false);
      fetchStructure();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to create department");
    } finally {
      setSavingDept(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Organizational Hierarchy
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Departments and professional designations configured for the school.
          </p>
        </div>
        <Button onClick={() => setShowAddDept(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Plus size={16} /> Add Department
        </Button>
      </div>

      {/* Add Department Modal */}
      {showAddDept && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", padding: "1.5rem", maxWidth: "450px", width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Add New Department</h3>
              <button onClick={() => setShowAddDept(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateDept} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>Department Name *</label>
                <input
                  required
                  placeholder="e.g. Science & Mathematics"
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>Description</label>
                <textarea
                  placeholder="Optional description of roles and faculty in this department..."
                  value={deptForm.description}
                  onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                  style={{ width: "100%", height: "80px", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <Button type="button" variant="outline" onClick={() => setShowAddDept(false)}>Cancel</Button>
                <Button type="submit" isLoading={savingDept}>Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Departments Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
        {departments.map((dept: any) => (
          <div key={dept.id} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem", borderTop: "3px solid var(--brand-primary)" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>{dept.name}</h4>
                <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", background: "rgba(99,102,241,0.1)", color: "var(--brand-primary)", fontSize: "0.75rem", fontWeight: 700 }}>
                  {dept._count?.staff ?? 0} Staff
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {dept.description || "Active department covering academic and administrative responsibilities."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-light)", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              <Users size={14} /> Headcount tracked automatically
            </div>
          </div>
        ))}
      </div>

      {/* Designations Section */}
      <div style={{ marginTop: "1rem" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
          Registered Designations ({designations.length})
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {designations.map((d: any) => (
            <div key={d.id} style={{ padding: "0.5rem 0.9rem", borderRadius: "var(--radius-md)", background: "var(--bg-surface)", border: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <Briefcase size={14} color="var(--brand-primary)" />
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", background: "var(--bg-elevated)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                {d._count?.staff ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Leave Policy & Entitlements Sub-Component ─────────────────────────────

function EntitlementsTab() {
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBalances = async () => {
      try {
        const res = await apiClient.get("/hr/leaves/balances");
        setBalances(res.data?.data ?? res.data ?? []);
      } catch {
        setBalances([]);
      } finally {
        setLoading(false);
      }
    };
    loadBalances();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Annual Leave Quotas & Entitlements
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
          Official institutional leave policy quotas, utilized days, and remaining balances for the current academic year.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading entitlements…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          {balances.map((b: any) => {
            const pct = Math.min(100, Math.round((b.used / b.quota) * 100));
            return (
              <div key={b.type} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>{b.label}</h4>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--brand-primary)", background: "rgba(99,102,241,0.1)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                    {b.quota} Days Total
                  </span>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: "0.35rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Used: <strong>{b.used}</strong></span>
                    <span style={{ color: b.balance <= 2 ? "#dc2626" : "#059669", fontWeight: 700 }}>
                      Remaining: {b.balance}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: "100%", height: "8px", borderRadius: "999px", background: "var(--bg-elevated)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: pct > 80 ? "#dc2626" : "var(--brand-primary)", borderRadius: "999px", transition: "width 0.3s ease" }} />
                  </div>
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                  {b.balance === 0 ? "⚠️ Quota fully consumed" : `✓ ${b.balance} day${b.balance === 1 ? '' : 's'} available`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Institutional Policy Guidelines */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "1.5rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Shield size={18} color="var(--brand-primary)" /> School HR Leave Regulations
        </h3>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <li>Casual leaves must be submitted at least 24 hours in advance, except in emergency situations.</li>
          <li>Sick leaves exceeding 3 consecutive calendar days require a certified medical practitioner certificate.</li>
          <li>Earned leaves can be accrued or cashed out according to the institution's annual faculty handbook.</li>
          <li>Attendance records and biometric punches sync daily at 23:59 IST to reconcile active duty hours.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Main HR Page ─────────────────────────────────────────────────────────

export default function HRPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role !== 'TEACHER';
  const [tab, setTab] = useState<HRTab>("requests");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  // Apply form
  const [applyForm, setApplyForm] = useState({ leaveType: "CASUAL", startDate: "", endDate: "", reason: "" });
  const [applying, setApplying] = useState(false);

  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  useEffect(() => {
    fetchSummary();
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/hr/leaves");
      const result = res.data?.data ?? res.data;
      setLeaves(Array.isArray(result) ? result : []);
    } catch { setLeaves([]); } finally { setIsLoading(false); }
  };

  const fetchSummary = async () => {
    try {
      const res = await apiClient.get("/hr/leaves/summary");
      setSummary(res.data?.data ?? res.data ?? {});
    } catch { }
  };

  const applyLeave = async () => {
    if (!applyForm.startDate || !applyForm.endDate || !applyForm.reason.trim()) {
      showMsg("Please fill all required fields.", "error");
      return;
    }
    setApplying(true);
    try {
      await apiClient.post("/hr/leaves/apply", applyForm);
      setApplyForm({ leaveType: "CASUAL", startDate: "", endDate: "", reason: "" });
      showMsg("Leave application submitted successfully!", "success");
      setTab("requests");
      fetchLeaves();
      fetchSummary();
    } catch (err: any) {
      showMsg(err?.response?.data?.message || "Failed to apply for leave.", "error");
    } finally { setApplying(false); }
  };

  const reviewLeave = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      await apiClient.put(`/hr/leaves/${id}/review`, { status, reviewNote });
      setReviewingId(null);
      setReviewNote("");
      showMsg(`Leave ${status.toLowerCase()} successfully!`, "success");
      fetchLeaves();
      fetchSummary();
    } catch {
      showMsg("Failed to review leave.", "error");
    }
  };

  const filteredLeaves = statusFilter === "ALL" ? leaves : leaves.filter(l => l.status === statusFilter);

  const tabStyle = (active: boolean) => ({
    padding: "0.6rem 1.25rem", borderRadius: "var(--radius-md)", cursor: "pointer",
    fontWeight: active ? 700 : 500, fontSize: "0.875rem",
    background: active ? "var(--brand-primary)" : "var(--bg-surface)",
    color: active ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border-default)",
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, marginBottom: "0.25rem", color: "var(--text-primary)" }}>
            {user?.role === 'TEACHER' ? 'Faculty Portal & Leaves' : 'Enterprise HR Management'}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            {user?.role === 'TEACHER' ? 'Manage your personal leave requests, view quotas, and review approvals.' : 'Comprehensive staff directory, leave lifecycle, daily attendance, and organizational departments.'}
          </p>
        </div>
        <Button onClick={() => setTab("apply")} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Plus size={16} /> Apply for Leave
        </Button>
      </div>

      {/* Alert */}
      {msg && (
        <div style={{
          padding: "0.75rem 1.25rem", borderRadius: "var(--radius-md)",
          background: msg.type === "success" ? "#dcfce7" : "#fee2e2",
          color: msg.type === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${msg.type === "success" ? "#86efac" : "#fca5a5"}`,
          fontWeight: 600,
        }}>
          {msg.text}
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <StatCard label="Total Leave Requests" value={summary.total ?? 0} icon={Calendar} color="var(--brand-primary)" />
          <StatCard label="Pending Approval" value={summary.pending ?? 0} icon={Clock} color="#f59e0b" />
          <StatCard label="Approved Leaves" value={summary.approved ?? 0} icon={CheckCircle} color="#10b981" />
          <StatCard label="Rejected / Void" value={summary.rejected ?? 0} icon={XCircle} color="#ef4444" />
        </div>
      )}

      {/* Enterprise Tabs Navigation */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button style={tabStyle(tab === "requests")} onClick={() => setTab("requests")}>
          <CalendarCheck size={15} style={{ marginRight: "0.35rem", display: "inline" }} /> Leave Requests
        </button>
        <button style={tabStyle(tab === "apply")} onClick={() => setTab("apply")}>
          <Plus size={15} style={{ marginRight: "0.35rem", display: "inline" }} /> Apply Leave
        </button>
        {isAdmin && (
          <>
            <button style={tabStyle(tab === "attendance")} onClick={() => setTab("attendance")}>
              <Users size={15} style={{ marginRight: "0.35rem", display: "inline" }} /> Staff Attendance
            </button>
            <button style={tabStyle(tab === "roster")} onClick={() => setTab("roster")}>
              <Briefcase size={15} style={{ marginRight: "0.35rem", display: "inline" }} /> Staff Directory & Roster
            </button>
            <button style={tabStyle(tab === "departments")} onClick={() => setTab("departments")}>
              <Building2 size={15} style={{ marginRight: "0.35rem", display: "inline" }} /> Departments & Structure
            </button>
          </>
        )}
        <button style={tabStyle(tab === "entitlements")} onClick={() => setTab("entitlements")}>
          <Shield size={15} style={{ marginRight: "0.35rem", display: "inline" }} /> Leave Policy & Quotas
        </button>
      </div>

      {/* TAB 1: LEAVE REQUESTS TABLE */}
      {tab === "requests" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
          {/* Status Filter row */}
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-secondary)", marginRight: "0.5rem" }}>Filter Status:</span>
            {(["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "0.35rem 0.85rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600,
                  cursor: "pointer", border: "none",
                  background: statusFilter === s ? "var(--brand-primary)" : "var(--bg-elevated)",
                  color: statusFilter === s ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading leave records...</div>
          ) : filteredLeaves.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>
              <CalendarCheck size={40} style={{ margin: "0 auto 1rem", opacity: 0.2 }} />
              <p>No leave requests found</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  {["Staff Member", "Leave Type", "Duration", "Days", "Reason", "Status", ...(isAdmin ? ["Review"] : [])].map(h => (
                    <th key={h} style={{ padding: "0.85rem 1.25rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((leave, i) => {
                  const statusCfg = STATUS_COLORS[leave.status] || STATUS_COLORS.CANCELLED;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={leave.id} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-elevated)" }}>
                      <td style={{ padding: "1rem 1.25rem" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                          {leave.staff?.user?.firstName} {leave.staff?.user?.lastName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                          {leave.staff?.designation?.name || leave.staff?.user?.role}
                          {leave.staff?.department?.name ? ` · ${leave.staff?.department?.name}` : ""}
                        </div>
                      </td>
                      <td style={{ padding: "1rem 1.25rem" }}>
                        <span style={{ padding: "0.25rem 0.6rem", borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", fontSize: "0.75rem", fontWeight: 600 }}>
                          {leave.leaveType}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.25rem", fontSize: "0.875rem" }}>
                        <div>{formatDate(leave.startDate)}</div>
                        <div style={{ color: "var(--text-tertiary)", fontSize: "0.75rem" }}>to {formatDate(leave.endDate)}</div>
                      </td>
                      <td style={{ padding: "1rem 1.25rem", fontWeight: 700, fontSize: "1rem" }}>{leave.totalDays}</td>
                      <td style={{ padding: "1rem 1.25rem", fontSize: "0.8125rem", color: "var(--text-secondary)", maxWidth: reviewingId === leave.id ? "350px" : "220px", verticalAlign: "top" }}>
                        <div style={{ 
                          whiteSpace: reviewingId === leave.id ? "pre-wrap" : "nowrap", 
                          wordBreak: reviewingId === leave.id ? "break-word" : "normal", 
                          overflow: reviewingId === leave.id ? "visible" : "hidden",
                          textOverflow: reviewingId === leave.id ? "clip" : "ellipsis",
                          lineHeight: "1.4" 
                        }}>{leave.reason}</div>
                        {leave.reviewNote && <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.5rem", fontStyle: "italic" }}>Admin Note: {leave.reviewNote}</div>}
                      </td>
                      <td style={{ padding: "1rem 1.25rem" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700, background: statusCfg.bg, color: statusCfg.text }}>
                          <StatusIcon size={12} /> {leave.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "1rem 1.25rem" }}>
                          {leave.status === "PENDING" && (
                            <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                              {reviewingId === leave.id ? (
                                <>
                                  <input
                                    value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                                    placeholder="Review remarks..."
                                    style={{ padding: "0.35rem 0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.75rem", width: "160px" }}
                                  />
                                  <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <Button variant="outline" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", flex: 1, background: "#dcfce7", color: "#166534", border: "none" }} onClick={() => reviewLeave(leave.id, "APPROVED")}>✓ Approve</Button>
                                    <Button variant="outline" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", flex: 1, background: "#fee2e2", color: "#991b1b", border: "none" }} onClick={() => reviewLeave(leave.id, "REJECTED")}>✗ Reject</Button>
                                  </div>
                                  <button onClick={() => { setReviewingId(null); setReviewNote(""); }} style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                                </>
                              ) : (
                                <Button variant="outline" style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }} onClick={() => setReviewingId(leave.id)}>
                                  Review
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: APPLY LEAVE FORM */}
      {tab === "apply" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "2rem", maxWidth: "600px" }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "1.5rem", color: "var(--text-primary)" }}>Apply for Leave</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>Leave Type *</label>
              <select
                value={applyForm.leaveType}
                onChange={e => setApplyForm(f => ({ ...f, leaveType: e.target.value }))}
                style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem" }}
              >
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>Start Date *</label>
                <input type="date" value={applyForm.startDate} onChange={e => setApplyForm(f => ({ ...f, startDate: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>End Date *</label>
                <input type="date" value={applyForm.endDate} onChange={e => setApplyForm(f => ({ ...f, endDate: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                />
              </div>
            </div>
            {applyForm.startDate && applyForm.endDate && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", fontSize: "0.875rem", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>
                📅 Total days: <b>{Math.max(1, Math.ceil((new Date(applyForm.endDate).getTime() - new Date(applyForm.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)}</b>
              </div>
            )}
            <div>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>Reason *</label>
              <textarea
                value={applyForm.reason}
                onChange={e => setApplyForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Describe the reason for your leave request..."
                style={{ width: "100%", height: "100px", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Button isLoading={applying} onClick={applyLeave}>Submit Application</Button>
              <Button variant="outline" onClick={() => setTab("requests")}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF ATTENDANCE REGISTER */}
      {tab === "attendance" && (
        <StaffAttendanceTab isAdmin={isAdmin} />
      )}

      {/* TAB 4: STAFF DIRECTORY & ROSTER */}
      {tab === "roster" && (
        <StaffRosterTab />
      )}

      {/* TAB 5: DEPARTMENTS & STRUCTURE */}
      {tab === "departments" && (
        <DepartmentsTab />
      )}

      {/* TAB 6: LEAVE POLICY & ENTITLEMENTS */}
      {tab === "entitlements" && (
        <EntitlementsTab />
      )}
    </div>
  );
}

