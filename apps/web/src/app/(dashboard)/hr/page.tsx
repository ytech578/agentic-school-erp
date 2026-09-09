"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import {
  Users, CalendarCheck, Clock, CheckCircle, XCircle, Plus, X,
  TrendingUp, AlertCircle, ChevronDown, User, Building2, Calendar
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

type LeaveTab = "requests" | "apply" | "attendance";
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Date picker + summary */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
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
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {[
            { label: "Present", count: present, color: "#059669", bg: "#f0fdf4" },
            { label: "Absent", count: absent, color: "#dc2626", bg: "#fef2f2" },
            { label: "On Leave", count: onLeave, color: "#d97706", bg: "#fffbeb" },
            { label: "Not Marked", count: notMark, color: "var(--text-secondary)", bg: "var(--bg-elevated)" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} style={{ padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", background: bg, textAlign: "center", minWidth: "80px" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color, marginTop: "0.2rem" }}>{label}</div>
            </div>
          ))}
        </div>
        {msg && (
          <div style={{ padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", background: msg.type === "success" ? "#dcfce7" : "#fee2e2", color: msg.type === "success" ? "#166534" : "#991b1b", fontSize: "0.8125rem", fontWeight: 600 }}>
            {msg.text}
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading attendance…</div>
        ) : records.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>No staff records found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["Emp ID", "Name", "Department", "Designation", "Status", ...(isAdmin ? ["Mark As"] : [])].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((s, i) => {
                const cfg = statusCfg[s.attendanceStatus] || statusCfg.NOT_MARKED;
                const isMarking = marking === s.id;
                return (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-elevated)" }}>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--text-tertiary)", fontFamily: "monospace" }}>{s.employeeId}</td>
                    <td style={{ padding: "0.875rem 1rem", fontWeight: 600, fontSize: "0.875rem" }}>{s.name}</td>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s.department}</td>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{s.designation}</td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <span style={{ padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          {(["PRESENT", "ABSENT"] as const).map(st => {
                            const c = statusCfg[st];
                            const active = s.attendanceStatus === st;
                            return (
                              <button
                                key={st}
                                disabled={isMarking || active}
                                onClick={() => markAttendance(s.id, st)}
                                style={{
                                  padding: "0.3rem 0.6rem", borderRadius: "var(--radius-sm)", border: `1px solid ${active ? c.color : "var(--border-default)"}`,
                                  background: active ? c.bg : "transparent", color: active ? c.color : "var(--text-secondary)",
                                  fontSize: "0.7rem", fontWeight: 700, cursor: active || isMarking ? "default" : "pointer", opacity: isMarking ? 0.6 : 1,
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

export default function HRPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<LeaveTab>("requests");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [staffAttendance, setStaffAttendance] = useState<any[]>([]);
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

  useEffect(() => { fetchSummary(); fetchLeaves(); }, []);
  useEffect(() => {
    if (tab === "attendance") fetchStaffAttendance();
  }, [tab]);

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

  const fetchStaffAttendance = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/hr/staff-attendance");
      const result = res.data?.data ?? res.data;
      setStaffAttendance(Array.isArray(result) ? result : []);
    } catch { } finally { setIsLoading(false); }
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
      fetchLeaves(); fetchSummary();
    } catch (err: any) {
      showMsg(err?.response?.data?.message || "Failed to apply for leave.", "error");
    } finally { setApplying(false); }
  };

  const reviewLeave = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      await apiClient.put(`/hr/leaves/${id}/review`, { status, reviewNote });
      setReviewingId(null); setReviewNote("");
      showMsg(`Leave ${status.toLowerCase()} successfully!`, "success");
      fetchLeaves(); fetchSummary();
    } catch {
      showMsg("Failed to review leave.", "error");
    }
  };

  const filteredLeaves = statusFilter === "ALL" ? leaves : leaves.filter(l => l.status === statusFilter);

  const tabStyle = (active: boolean) => ({
    padding: "0.6rem 1.25rem", borderRadius: "var(--radius-md)", cursor: "pointer",
    fontWeight: active ? 600 : 400, fontSize: "0.875rem",
    background: active ? "var(--brand-primary)" : "var(--bg-elevated)",
    color: active ? "#fff" : "var(--text-secondary)", border: "1px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "0.25rem" }}>
            {user?.role === 'TEACHER' ? 'My Leaves' : 'HR Management'}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            {user?.role === 'TEACHER' ? 'Manage your leave requests' : 'Manage staff leave requests, approvals, and attendance'}
          </p>
        </div>
        <Button onClick={() => setTab("apply")}>
          <Plus size={16} style={{ marginRight: "0.4rem" }} /> Apply for Leave
        </Button>
      </div>

      {/* Alert */}
      {msg && (
        <div style={{
          padding: "0.75rem 1rem", borderRadius: "var(--radius-md)",
          background: msg.type === "success" ? "#dcfce7" : "#fee2e2",
          color: msg.type === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${msg.type === "success" ? "#86efac" : "#fca5a5"}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          <StatCard label="Total Requests" value={summary.total ?? 0} icon={Calendar} color="var(--brand-primary)" />
          <StatCard label="Pending Review" value={summary.pending ?? 0} icon={Clock} color="#f59e0b" />
          <StatCard label="Approved" value={summary.approved ?? 0} icon={CheckCircle} color="#10b981" />
          <StatCard label="Rejected" value={summary.rejected ?? 0} icon={XCircle} color="#ef4444" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button style={tabStyle(tab === "requests")} onClick={() => setTab("requests")}>
          <CalendarCheck size={15} style={{ marginRight: "0.35rem", display: "inline" }} />Leave Requests
        </button>
        <button style={tabStyle(tab === "apply")} onClick={() => setTab("apply")}>
          <Plus size={15} style={{ marginRight: "0.35rem", display: "inline" }} />Apply Leave
        </button>
        {user?.role !== 'TEACHER' && (
          <button style={tabStyle(tab === "attendance")} onClick={() => setTab("attendance")}>
            <Users size={15} style={{ marginRight: "0.35rem", display: "inline" }} />Staff Attendance
          </button>
        )}
      </div>

      {/* LEAVE REQUESTS TABLE */}
      {tab === "requests" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
          {/* Filter row */}
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading...</div>
          ) : filteredLeaves.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>
              <CalendarCheck size={40} style={{ margin: "0 auto 1rem", opacity: 0.2 }} />
              <p>No leave requests found</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  {["Staff Member", "Leave Type", "Dates", "Days", "Reason", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((leave, i) => {
                  const statusCfg = STATUS_COLORS[leave.status] || STATUS_COLORS.CANCELLED;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={leave.id} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-elevated)" }}>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                          {leave.staff?.user?.firstName} {leave.staff?.user?.lastName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                          {leave.staff?.designation?.name || leave.staff?.user?.role}
                          {leave.staff?.department?.name ? ` · ${leave.staff?.department?.name}` : ""}
                        </div>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ padding: "0.25rem 0.6rem", borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", fontSize: "0.75rem", fontWeight: 600 }}>
                          {leave.leaveType}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                        <div>{new Date(leave.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                        <div style={{ color: "var(--text-tertiary)", fontSize: "0.75rem" }}>to {new Date(leave.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                      </td>
                      <td style={{ padding: "1rem", fontWeight: 700, fontSize: "1rem" }}>{leave.totalDays}</td>
                      <td style={{ padding: "1rem", fontSize: "0.8125rem", color: "var(--text-secondary)", maxWidth: reviewingId === leave.id ? "350px" : "200px", verticalAlign: "top" }}>
                        <div style={{ 
                          whiteSpace: reviewingId === leave.id ? "pre-wrap" : "nowrap", 
                          wordBreak: reviewingId === leave.id ? "break-word" : "normal", 
                          overflow: reviewingId === leave.id ? "visible" : "hidden",
                          textOverflow: reviewingId === leave.id ? "clip" : "ellipsis",
                          lineHeight: "1.4" 
                        }}>{leave.reason}</div>
                        {leave.reviewNote && <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.5rem", fontStyle: "italic" }}>Admin Note: {leave.reviewNote}</div>}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700, background: statusCfg.bg, color: statusCfg.text }}>
                          <StatusIcon size={12} />{leave.status}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        {user?.role !== 'TEACHER' && leave.status === "PENDING" && (
                          <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                            {reviewingId === leave.id ? (
                              <>
                                <input
                                  value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                                  placeholder="Review note (optional)..."
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* APPLY LEAVE FORM */}
      {tab === "apply" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", padding: "2rem", maxWidth: "600px" }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "1.5rem" }}>Apply for Leave</h2>
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
                📅 Total days: <b>{Math.ceil((new Date(applyForm.endDate).getTime() - new Date(applyForm.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1}</b>
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

      {/* STAFF ATTENDANCE */}
      {tab === "attendance" && (
        <StaffAttendanceTab isAdmin={user?.role !== 'TEACHER'} />
      )}
    </div>
  );
}
