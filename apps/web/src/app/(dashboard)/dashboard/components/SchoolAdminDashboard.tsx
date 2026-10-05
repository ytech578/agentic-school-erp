"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, GraduationCap, DollarSign, CalendarCheck, UserPlus,
  ArrowRight, CheckCircle2, AlertTriangle, Clock, TrendingUp,
  CreditCard, Check, X, FileText, Send, BarChart2,
  Receipt, FileCheck, CalendarClock, AlertOctagon, BookUser, ShieldCheck, Sparkles, BookMarked
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { DashboardKpiCard } from "@/components/ui/DashboardKpiCard";
import { DashboardLoadingSkeleton } from "@/components/ui/Skeleton";
import { formatCurrencyINR, formatDate } from "@/lib/formatters";

export function SchoolAdminDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchDashboard = async (retryCount = 0) => {
      try {
        const [dashRes, leavesRes] = await Promise.all([
          apiClient.get("/dashboard/school-admin"),
          apiClient.get("/hr/leaves?status=PENDING&limit=5").catch(() => ({ data: { data: [] } })),
        ]);
        if (!isMounted) return;
        setData(dashRes.data?.data || dashRes.data);
        setPendingLeaves(leavesRes.data?.data || []);
      } catch (err: any) {
        if (!isMounted) return;
        // In dev mode when server restarts, gracefully retry before logging to avoid Turbopack crash overlays
        if (retryCount < 3) {
          setTimeout(() => {
            if (isMounted) fetchDashboard(retryCount + 1);
          }, 1500);
          return;
        }
        console.warn("[SchoolAdminDashboard] Backend initializing, awaiting live telemetry:", err?.message || err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLeaveAction = async (id: string, action: "APPROVED" | "REJECTED") => {
    setActionLoading(id);
    try {
      await apiClient.patch(`/hr/leaves/${id}/review`, { status: action });
      setPendingLeaves((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      console.error("Failed to review leave", e);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <DashboardLoadingSkeleton />;

  if (!data) {
    return (
      <div style={{
        padding: "3.5rem 2rem",
        textAlign: "center",
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-2xl)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-sm)",
        margin: "1rem 0"
      }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "rgba(99, 102, 241, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1rem auto",
          color: "var(--brand-primary)"
        }}>
          <Sparkles size={24} />
        </div>
        <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
          Connecting to Campus Telemetry...
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", maxWidth: "420px", margin: "0 auto 1.5rem auto" }}>
          The backend services are initializing. Live metrics will appear automatically.
        </p>
        <Button variant="primary" onClick={() => { setLoading(true); location.reload(); }}>
          Sync Live Cockpit
        </Button>
      </div>
    );
  }

  const kpis = data?.kpis;
  const collectionTrend = data?.collectionTrend || [];
  const recentEnrollments = data?.recentEnrollments || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Operations Header */}
      <div style={{
        background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
        borderRadius: "var(--radius-2xl)",
        padding: "1.75rem 2rem",
        color: "#FFFFFF",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1.25rem",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "var(--radius-full)", padding: "0.2rem 0.65rem", marginBottom: "0.5rem" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--status-success)", display: "inline-block" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#6EE7B7", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Campus Operations Live
            </span>
          </div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "#FFFFFF", marginBottom: "0.25rem" }}>
            Administration & Finance Cockpit
          </h2>
          <p style={{ color: "#94A3B8", fontSize: "var(--text-sm)", margin: 0 }}>
            Real-time financial velocity, admissions pipeline, staff management, and daily campus attendance.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => router.push('/fees')} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CreditCard size={15} /> Fee Collection
          </Button>
          <Button variant="primary" onClick={() => router.push('/students/new')} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <UserPlus size={15} /> Admit Student
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        <DashboardKpiCard
          label="Month's Collection"
          value={kpis ? formatCurrencyINR(kpis.collectedThisMonth) : "—"}
          icon={DollarSign}
          color="#10B981"
          trend="up"
          trendLabel={kpis ? `${kpis.collectionRate}% of target` : undefined}
          subText={kpis ? `Target: ${formatCurrencyINR(kpis.monthlyTarget)}` : "Awaiting data"}
          onClick={() => router.push('/fees')}
        />
        <DashboardKpiCard
          label="Student Attendance"
          value={kpis ? `${kpis.studentAttendancePct}%` : "—"}
          icon={GraduationCap}
          color="#2563EB"
          subText={kpis ? `${kpis.totalStudents} Active Students` : "Awaiting data"}
          onClick={() => router.push('/attendance')}
        />
        <DashboardKpiCard
          label="Staff On Campus"
          value={kpis ? `${kpis.staffAttendance?.present ?? "—"} / ${kpis.staffAttendance?.total ?? "—"}` : "—"}
          icon={Users}
          color="#8B5CF6"
          subText={kpis?.staffAttendance ? (
            <span>
              <span style={{ color: "var(--status-warning)", fontWeight: 600 }}>{kpis.staffAttendance.onLeave} On Leave</span>
              &nbsp;•&nbsp;
              <span style={{ color: "var(--status-danger)", fontWeight: 600 }}>{kpis.staffAttendance.absent} Absent</span>
            </span>
          ) : "Awaiting data"}
          onClick={() => router.push('/hr')}
        />
        <DashboardKpiCard
          label="Admissions Pipeline"
          value={kpis ? `${kpis.admissions?.enquiries ?? "—"} Enquiries` : "—"}
          icon={UserPlus}
          color="#F59E0B"
          subText={kpis?.admissions ? `${kpis.admissions.applications} Applied • ${kpis.totalStudents} Enrolled` : "Awaiting data"}
          onClick={() => router.push('/admissions')}
        />
      </div>

      {/* Campus Academic & Operational Modules Hub */}
      <Card>
        <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.75rem" }}>
          <div>
            <CardTitle style={{ fontSize: "var(--text-base)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Sparkles size={18} className="text-brand" />
              Campus Management & Operations Hub
            </CardTitle>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>
              Quick access to statutory payroll, official credentials, online examinations, and parent-teacher scheduling
            </p>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "var(--radius-full)", background: "rgba(16, 185, 129, 0.1)", color: "var(--status-success)" }}>
            School Scope Active
          </span>
        </CardHeader>
        <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.875rem" }}>
            {[
              {
                title: "Payroll & Payslips",
                desc: "Salary structures, EPF/ESI statutory calculations, disbursement",
                href: "/payroll",
                icon: Receipt,
                color: "#10B981",
                tag: "HR & Finance",
              },
              {
                title: "Official Certificates",
                desc: "Transfer certificates, bonafide & QR verification",
                href: "/certificates",
                icon: FileCheck,
                color: "#2563EB",
                tag: "Tamper-Evident",
              },
              {
                title: "PTM Scheduling",
                desc: "Teacher conferencing slots, parent bookings & meetings",
                href: "/ptm",
                icon: CalendarClock,
                color: "#F59E0B",
                tag: "Conferencing",
              },
              {
                title: "Discipline Log",
                desc: "Incident records, parental notifications, restorative action",
                href: "/discipline",
                icon: AlertOctagon,
                color: "#EF4444",
                tag: "Conduct Sentinel",
              },
              {
                title: "Curriculum & Subjects",
                desc: "CBSE/ICSE curriculum mapping, subject offerings and standards",
                href: "/curriculum",
                icon: BookMarked,
                color: "#06B6D4",
                tag: "Academics",
              },
              {
                title: "Alumni & Transcripts",
                desc: "Graduates directory, transcript requests, alumni networking",
                href: "/alumni",
                icon: BookUser,
                color: "#8B5CF6",
                tag: "Alumni Network",
              },
              {
                title: "DPDP Privacy Center",
                desc: "Sec 9 parental consents, Sec 11 data portability, Sec 12 erasure",
                href: "/privacy",
                icon: ShieldCheck,
                color: "#059669",
                tag: "DPDP Act 2023",
              },
              {
                title: "SaaS Subscriptions",
                desc: "Plan tier quotas, active student & faculty meter telemetry",
                href: "/subscriptions",
                icon: Sparkles,
                color: "#6366F1",
                tag: "Quota & Limits",
              },
            ].map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.title}
                  onClick={() => router.push(module.href)}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-xl)",
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = module.color;
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: `${module.color}15`,
                        color: module.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "var(--radius-full)",
                        background: `${module.color}12`,
                        color: module.color,
                      }}
                    >
                      {module.tag}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>{module.title}</span>
                      <ArrowRight size={13} style={{ opacity: 0.6 }} />
                    </div>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      {module.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mid Section: 7-Day Collection Trend & Pending Approvals */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", flexWrap: "wrap" as any }}>
        {/* Recharts 7-Day Financial Velocity */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>7-Day Fee Collection Velocity</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Daily fee settlement inflow across channels</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "var(--text-xs)", color: "var(--status-success)", fontWeight: 600 }}>
              <TrendingUp size={14} /> Live Trend
            </div>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {collectionTrend.length > 0 ? (
              <div style={{ height: "240px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={collectionTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCollection" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip
                      formatter={(value: any) => [formatCurrencyINR(Number(value)), "Collection"]}
                      contentStyle={{ background: "var(--bg-surface-solid)", borderColor: "var(--border-default)", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Area type="monotone" dataKey="collection" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollection)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: "240px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <BarChart2 size={32} color="var(--text-tertiary)" />
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>No collection data for this period.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals Queue */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle style={{ fontSize: "var(--text-base)" }}>Pending Approvals</CardTitle>
            {pendingLeaves.length > 0 && (
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "var(--radius-full)", background: "rgba(245, 158, 11, 0.15)", color: "#D97706" }}>
                {pendingLeaves.length} Action Required
              </span>
            )}
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {pendingLeaves.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pendingLeaves.map((leave: any) => (
                  <div key={leave.id} style={{ padding: "0.875rem", borderRadius: "var(--radius-lg)", background: "var(--bg-app)", border: "1px solid var(--border-default)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>
                          {leave.staff?.firstName || leave.user?.firstName} {leave.staff?.lastName || leave.user?.lastName}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                          {leave.leaveType} • {formatDate(leave.startDate)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleLeaveAction(leave.id, "APPROVED")}
                        disabled={actionLoading === leave.id}
                        style={{ flex: 1, padding: "0.375rem", borderRadius: "var(--radius-md)", border: "none", background: "rgba(16, 185, 129, 0.1)", color: "var(--status-success)", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleLeaveAction(leave.id, "REJECTED")}
                        disabled={actionLoading === leave.id}
                        style={{ flex: 1, padding: "0.375rem", borderRadius: "var(--radius-md)", border: "none", background: "rgba(239, 68, 68, 0.1)", color: "var(--status-danger)", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <CheckCircle2 size={28} color="var(--status-success)" style={{ marginBottom: "0.5rem" }} />
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>All approvals are up to date.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Enrollments */}
      {recentEnrollments.length > 0 && (
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Recent Enrollments</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Latest admitted students</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => router.push('/students')}>
              View All <ArrowRight size={13} style={{ marginLeft: "0.25rem" }} />
            </Button>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentEnrollments.map((student: any) => (
                <div key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-app)", border: "1px solid var(--border-default)" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{student.firstName} {student.lastName}</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginLeft: "0.5rem" }}>• {student.class || student.section?.class?.name}</span>
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{formatDate(student.createdAt)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
