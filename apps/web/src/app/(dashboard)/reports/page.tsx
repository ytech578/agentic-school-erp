"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { StatCard, Badge } from "@/components/ui/StatCard";
import {
  BarChart3, Users, FileText, TrendingDown, Download,
  Calendar, DollarSign, AlertCircle, CheckCircle2,
  ChevronDown, Search, RefreshCw, Award
} from "lucide-react";

type ReportTab = "overview" | "attendance" | "fees" | "exams";

// ─── Overview Tab ─────────────────────────────────────────────────────────

function OverviewTab() {
  const [daily, setDaily] = useState<any>(null);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get("/reports/attendance/daily"),
      apiClient.get("/reports/fees/outstanding"),
    ]).then(([att, fees]) => {
      setDaily(att.data.data || att.data);
      const raw = fees.data.data || fees.data || [];
      setOutstanding(Array.isArray(raw) ? raw : []);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const totalOutstanding = outstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        <StatCard label="Present Today" value={loading ? "—" : daily?.PRESENT ?? 0} sub={`${daily?.attendanceRate ?? 0}% rate`} icon={CheckCircle2} color="var(--success)" />
        <StatCard label="Absent Today" value={loading ? "—" : daily?.ABSENT ?? 0} sub="Students absent" icon={AlertCircle} color="var(--danger)" />
        <StatCard label="Outstanding Dues" value={loading ? "—" : `₹${(totalOutstanding / 1000).toFixed(1)}K`} sub={`${outstanding.length} students`} icon={DollarSign} color="#f59e0b" />
        <StatCard label="Low Attendance" value="—" sub="Below 75%" icon={TrendingDown} color="#8b5cf6" />
      </div>

      {/* Outstanding dues quick list */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontWeight: 600, fontSize: "0.9375rem" }}>⚠️ Top Outstanding Dues</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-app)" }}>
                {["Student", "Class", "Amount Due", "Days Overdue", "Status"].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.8125rem" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outstanding.slice(0, 8).map((r, i) => (
                <tr key={r.paymentId} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-app)" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>{r.studentName}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>{r.className}</td>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#dc2626" }}>₹{Number(r.outstanding).toLocaleString()}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Badge color={r.daysOverdue > 30 ? "red" : r.daysOverdue > 0 ? "yellow" : "green"}>
                      {r.daysOverdue > 0 ? `${r.daysOverdue}d overdue` : "On time"}
                    </Badge>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Badge color={r.status === "PENDING" ? "yellow" : "blue"}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
              {outstanding.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)" }}>🎉 No outstanding dues!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Tab ──────────────────────────────────────────────────────

function AttendanceTab({ classes }: { classes: any[] }) {
  const [classId, setClassId] = useState("");
  const [sections, setSections] = useState<any[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [register, setRegister] = useState<any>(null);
  const [lowAtt, setLowAtt] = useState<any[]>([]);
  const [view, setView] = useState<"register" | "low">("register");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSections([]); setSectionId(""); setRegister(null);
    if (classId) {
      apiClient.get(`/classes/${classId}/sections`).then(res => {
        setSections(res.data.data || res.data || []);
      }).catch(() => {});
    }
  }, [classId]);

  const fetchRegister = async () => {
    if (!classId || !sectionId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/reports/attendance/register?sectionId=${sectionId}&month=${month}&year=${year}`);
      setRegister(res.data.data || res.data);
    } catch { } finally { setLoading(false); }
  };

  const fetchLow = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/reports/attendance/low?threshold=75");
      const data = res.data.data || res.data || [];
      setLowAtt(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (view === "low") fetchLow(); }, [view, fetchLow]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {(["register", "low"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "0.5rem 1.25rem", borderRadius: "var(--radius-full)", border: "1.5px solid",
            borderColor: view === v ? "var(--primary-500)" : "var(--border-light)",
            background: view === v ? "var(--primary-50)" : "transparent",
            color: view === v ? "var(--primary-600)" : "var(--text-secondary)",
            fontWeight: view === v ? 600 : 400, cursor: "pointer", fontSize: "0.875rem"
          }}>
            {v === "register" ? "📋 Attendance Register" : "⚠️ Low Attendance Alert"}
          </button>
        ))}
      </div>

      {view === "register" && (
        <>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Class</label>
              <select value={classId} onChange={e => setClassId(e.target.value)} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", minWidth: "140px" }}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Section</label>
              <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", minWidth: "140px" }}>
                <option value="">Select Section</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Month</label>
              <select value={month} onChange={e => setMonth(+e.target.value)} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem" }}>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Year</label>
              <select value={year} onChange={e => setYear(+e.target.value)} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem" }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={fetchRegister} disabled={!classId || !sectionId || loading} style={{ padding: "0.625rem 1.25rem", background: "var(--primary-500)", color: "white", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
              <RefreshCw size={14} /> Load Register
            </button>
          </div>
          {register && (
            <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg-app)" }}>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, position: "sticky", left: 0, background: "var(--bg-app)", zIndex: 1, color: "var(--text-secondary)" }}>Student</th>
                    {register.days.map((d: number) => (
                      <th key={d} style={{ padding: "0.5rem", textAlign: "center", fontWeight: 600, color: "var(--text-secondary)", minWidth: "32px" }}>{d}</th>
                    ))}
                    <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 600, color: "var(--text-secondary)" }}>P</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 600, color: "var(--text-secondary)" }}>A</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 600, color: "var(--text-secondary)" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {register.students.map((s: any, i: number) => (
                    <tr key={s.studentId} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-app)" }}>
                      <td style={{ padding: "0.625rem 1rem", fontWeight: 500, position: "sticky", left: 0, background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-app)", zIndex: 1, whiteSpace: "nowrap" }}>
                        {s.rollNumber && <span style={{ color: "var(--text-tertiary)", marginRight: "0.5rem" }}>#{s.rollNumber}</span>}
                        {s.name}
                      </td>
                      {register.days.map((d: number) => {
                        const status = s.days[d.toString()];
                        return (
                          <td key={d} style={{ padding: "0.375rem", textAlign: "center" }}>
                            <span title={status || "—"} style={{
                              display: "inline-block", width: "22px", height: "22px", borderRadius: "4px",
                              background: status === "PRESENT" ? "#86efac" : status === "ABSENT" ? "#fca5a5" : status === "LATE" ? "#fde68a" : "transparent",
                              fontSize: "0.6875rem", fontWeight: 700, lineHeight: "22px",
                              color: status === "PRESENT" ? "#166534" : status === "ABSENT" ? "#991b1b" : status === "LATE" ? "#854d0e" : "var(--text-tertiary)",
                            }}>
                              {status === "PRESENT" ? "P" : status === "ABSENT" ? "A" : status === "LATE" ? "L" : "·"}
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ padding: "0.625rem 1rem", textAlign: "center", fontWeight: 600, color: "var(--success)" }}>{s.present}</td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "center", fontWeight: 600, color: "var(--danger)" }}>{s.absent}</td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "center" }}>
                        <Badge color={parseFloat(s.percentage) >= 75 ? "green" : "red"}>{s.percentage}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === "low" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-light)" }}>
            <h3 style={{ fontWeight: 600 }}>Students Below 75% Attendance</h3>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-app)" }}>
                {["Student", "Class", "Present", "Total", "Attendance %"].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.8125rem" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lowAtt.map((s, i) => (
                <tr key={s.studentId} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-app)" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>{s.className}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{s.presentDays}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{s.totalDays}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Badge color={parseFloat(s.percentage) < 50 ? "red" : "yellow"}>{s.percentage}%</Badge>
                  </td>
                </tr>
              ))}
              {lowAtt.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)" }}>✅ All students have attendance above 75%</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Fee Reports Tab ──────────────────────────────────────────────────────

function FeesTab() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<any>(null);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [view, setView] = useState<"collection" | "outstanding">("collection");
  const [loading, setLoading] = useState(false);

  const fetchCollection = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/reports/fees/collection?from=${from}&to=${to}`);
      setSummary(res.data.data || res.data);
    } catch { } finally { setLoading(false); }
  };

  const fetchOutstanding = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/reports/fees/outstanding");
      const data = res.data.data || res.data || [];
      setOutstanding(Array.isArray(data) ? data : []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (view === "outstanding") fetchOutstanding(); }, [view, fetchOutstanding]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {(["collection", "outstanding"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "0.5rem 1.25rem", borderRadius: "var(--radius-full)", border: "1.5px solid",
            borderColor: view === v ? "var(--primary-500)" : "var(--border-light)",
            background: view === v ? "var(--primary-50)" : "transparent",
            color: view === v ? "var(--primary-600)" : "var(--text-secondary)",
            fontWeight: view === v ? 600 : 400, cursor: "pointer", fontSize: "0.875rem"
          }}>
            {v === "collection" ? "💰 Collection Report" : "⚠️ Outstanding Dues"}
          </button>
        ))}
      </div>

      {view === "collection" && (
        <>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            {[["From", from, setFrom], ["To", to, setTo]].map(([label, val, setter]: any) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</label>
                <input type="date" value={val} onChange={e => setter(e.target.value)} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem" }} />
              </div>
            ))}
            <button onClick={fetchCollection} disabled={loading} style={{ padding: "0.625rem 1.25rem", background: "var(--primary-500)", color: "white", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
              Generate Report
            </button>
          </div>
          {summary && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <StatCard label="Total Collected" value={`₹${Number(summary.totalCollected).toLocaleString()}`} icon={DollarSign} color="var(--success)" />
                <StatCard label="Total Payments" value={summary.totalPayments} icon={FileText} color="var(--primary-500)" />
                <StatCard label="Date Range" value={`${from} → ${to}`} icon={Calendar} color="#8b5cf6" />
              </div>
              {summary.byFeeHead && (
                <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", padding: "1.25rem" }}>
                  <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Collection by Fee Head</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {Object.entries(summary.byFeeHead).map(([head, amt]: any) => {
                      const pct = ((amt / summary.totalCollected) * 100).toFixed(1);
                      return (
                        <div key={head}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                            <span style={{ fontWeight: 500 }}>{head}</span>
                            <span style={{ fontWeight: 600 }}>₹{Number(amt).toLocaleString()} ({pct}%)</span>
                          </div>
                          <div style={{ height: "6px", borderRadius: "3px", background: "var(--bg-app)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "var(--primary-500)", borderRadius: "3px" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {view === "outstanding" && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontWeight: 600 }}>Outstanding Fee Dues</h3>
            <span style={{ fontWeight: 700, color: "#dc2626", fontSize: "1.125rem" }}>
              Total: ₹{outstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0).toLocaleString()}
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-app)" }}>
                {["Student", "Class", "Total", "Paid", "Due", "Days Overdue", "Status"].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.8125rem" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outstanding.map((r, i) => (
                <tr key={r.paymentId} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-app)" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>{r.studentName}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>{r.className}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>₹{Number(r.totalAmount).toLocaleString()}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--success)" }}>₹{Number(r.paidAmount).toLocaleString()}</td>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "#dc2626" }}>₹{Number(r.outstanding).toLocaleString()}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Badge color={r.daysOverdue > 30 ? "red" : r.daysOverdue > 0 ? "yellow" : "green"}>
                      {r.daysOverdue > 0 ? `${r.daysOverdue}d` : "OK"}
                    </Badge>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}><Badge color="yellow">{r.status}</Badge></td>
                </tr>
              ))}
              {outstanding.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)" }}>🎉 No outstanding dues found!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Exam Reports Tab ──────────────────────────────────────────────────────

function ExamsTab() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get("/exams"),
      apiClient.get("/classes"),
    ]).then(([e, c]) => {
      setExams(e.data.data || e.data || []);
      setClasses(c.data.data || c.data || []);
    }).catch(() => {});
  }, []);

  const fetchReport = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const url = `/reports/exams/${examId}${classId ? `?classId=${classId}` : ""}`;
      const res = await apiClient.get(url);
      setReport(res.data.data || res.data);
    } catch { } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Exam *</label>
          <select value={examId} onChange={e => setExamId(e.target.value)} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", minWidth: "200px" }}>
            <option value="">Select Exam</option>
            {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Filter by Class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", minWidth: "160px" }}>
            <option value="">All Classes</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={fetchReport} disabled={!examId || loading} style={{ padding: "0.625rem 1.25rem", background: "var(--primary-500)", color: "white", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
          Generate Report
        </button>
      </div>

      {report && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
            <StatCard label="Class Average" value={`${report.classAverage}%`} icon={BarChart3} color="var(--primary-500)" />
            <StatCard label="Passed" value={report.passCount} sub={`${report.passPercentage}% pass rate`} icon={CheckCircle2} color="var(--success)" />
            <StatCard label="Failed" value={report.failCount} icon={AlertCircle} color="var(--danger)" />
            <StatCard label="Top Score" value={`${report.topScore}%`} icon={Award} color="#f59e0b" />
          </div>

          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-light)" }}>
              <h3 style={{ fontWeight: 600 }}>{report.exam.name} — Student Results</h3>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "var(--bg-app)" }}>
                  {["Rank", "Student", "Roll No.", "Total Marks", "Percentage", "Grade"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.8125rem" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.students.map((s: any, i: number) => (
                  <tr key={s.studentId} style={{ borderTop: "1px solid var(--border-light)", background: i % 2 === 0 ? "transparent" : "var(--bg-app)" }}>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {s.rank <= 3 ? <span style={{ fontSize: "1.25rem" }}>{["🥇","🥈","🥉"][s.rank-1]}</span> : `#${s.rank}`}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>{s.name}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "var(--text-tertiary)" }}>{s.rollNumber || "—"}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>{s.total}/{s.maxTotal}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ flex: 1, height: "6px", background: "var(--bg-app)", borderRadius: "3px", overflow: "hidden", maxWidth: "80px" }}>
                          <div style={{ height: "100%", width: `${s.percentage}%`, background: parseFloat(s.percentage) >= 60 ? "var(--success)" : "var(--danger)", borderRadius: "3px" }} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{s.percentage}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <Badge color={s.grade === "F" ? "red" : s.grade.startsWith("A") ? "green" : s.grade.startsWith("B") ? "blue" : "yellow"}>
                        {s.grade}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Reports Page ─────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("overview");
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get("/classes").then(r => {
      const data = r.data.data || r.data || [];
      setClasses(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const tabs = [
    { key: "overview" as ReportTab, label: "Overview", icon: BarChart3 },
    { key: "attendance" as ReportTab, label: "Attendance", icon: Users },
    { key: "fees" as ReportTab, label: "Fees", icon: DollarSign },
    { key: "exams" as ReportTab, label: "Examinations", icon: FileText },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "0.25rem" }}>Reports & Analytics</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Comprehensive insights across attendance, fees, and examinations</p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem", background: "var(--primary-500)", color: "white", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
          <Download size={16} /> Export
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-app)", borderRadius: "var(--radius-lg)", padding: "0.25rem", width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1.25rem",
            borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", fontSize: "0.875rem",
            fontWeight: tab === t.key ? 600 : 400,
            background: tab === t.key ? "var(--bg-surface)" : "transparent",
            color: tab === t.key ? "var(--text-primary)" : "var(--text-secondary)",
            boxShadow: tab === t.key ? "var(--shadow-sm)" : "none",
            transition: "all 0.15s",
          }}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab />}
      {tab === "attendance" && <AttendanceTab classes={classes} />}
      {tab === "fees" && <FeesTab />}
      {tab === "exams" && <ExamsTab />}
    </div>
  );
}
