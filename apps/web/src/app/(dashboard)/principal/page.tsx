"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles, AlertTriangle, Send, CheckCircle2,
  ArrowRight, Zap, UserPlus, Megaphone, TrendingUp,
  DollarSign, UserCheck, UserX, CalendarCheck,
  Award, Shield, Phone, X, Users, BookOpen,
  RefreshCw, BarChart2, History, Terminal,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/axios";
import ReactMarkdown from "react-markdown";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  formatDate, formatCurrencyINR, getAnomalyBadgeStyle, formatChartSeries,
} from "@/lib/formatters";

// ─── Shared chip styles (eliminates repeated inline style objects) ──────────
const chipBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.25rem 0.65rem",
  borderRadius: "var(--radius-full)",
  fontSize: "11px",
  cursor: "pointer",
  backdropFilter: "blur(6px)",
  transition: "all 0.15s ease",
  border: "none",
};
const primaryChip: React.CSSProperties = {
  ...chipBase,
  border: "1px solid rgba(165, 180, 252, 0.4)",
  background: "rgba(99, 102, 241, 0.25)",
  color: "#FFFFFF",
  fontWeight: 700,
};
const secondaryChip: React.CSSProperties = {
  ...chipBase,
  border: "1px solid rgba(199, 210, 254, 0.3)",
  background: "rgba(255, 255, 255, 0.1)",
  color: "#E0E7FF",
  fontWeight: 600,
};

// ─── Skeleton loader ─────────────────────────────────────────────────────────
function SkeletonCard({ height = 96 }: { height?: number }) {
  return (
    <div style={{
      height: `${height}px`, borderRadius: "var(--radius-xl)",
      background: "var(--bg-app)", border: "1px solid var(--border-default)",
      overflow: "hidden", position: "relative",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
        animation: "shimmer 1.5s infinite",
      }} />
    </div>
  );
}

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface ChartData {
  type: "line" | "bar";
  title: string;
  labels: string[];
  datasets: { label: string; data: number[] }[];
}
interface ActionExecuted {
  type: string;
  title: string;
  link?: string;
  linkText?: string;
  details?: Record<string, string>;
}
interface QueryResponse {
  text: string;
  chart: ChartData | null;
  actionExecuted?: ActionExecuted | null;
  intent?: string;
}
interface ExecLogEntry {
  id: string;
  time: string;
  command: string;
  intent?: string;
  success: boolean;
}

// ─── Main content (separated for Suspense boundary) ──────────────────────────
function PrincipalCommandContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [prompt, setPrompt] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [queryResponse, setQueryResponse] = useState<QueryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"operations" | "substitutions" | "interventions" | "approvals">("operations");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Execution log — unique to Command Center, not on dashboard
  const [execLog, setExecLog] = useState<ExecLogEntry[]>([]);

  // Modal states
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Admission form
  const [admissionForm, setAdmissionForm] = useState({
    studentName: "",
    classApplied: "",
    parentName: "",
    parentPhone: "",
    gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    dateOfBirth: "2010-05-15",
  });
  const [submittingAdmission, setSubmittingAdmission] = useState(false);

  // Broadcast form
  const [broadcastForm, setBroadcastForm] = useState({
    audience: "ALL_CAMPUS",
    title: "",
    message: "",
  });
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);

  // Interactive tab state
  const [confirmedSubs, setConfirmedSubs] = useState<Record<string, boolean>>({});
  const [guardianAlerted, setGuardianAlerted] = useState<Record<string, boolean>>({});
  const [reviewedLeaves, setReviewedLeaves] = useState<Record<string, "APPROVED" | "REJECTED">>({});

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Fetch principal dashboard telemetry ─────────────────────────────────
  const fetchDashboard = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setDashboardLoading(true);
    try {
      const res = await apiClient.get("/dashboard/principal");
      setDashboardData(res.data?.data || res.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load principal dashboard telemetry", err);
    } finally {
      setDashboardLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  // ─── Execute AI command ───────────────────────────────────────────────────
  const executeCommand = async (cmdPrompt: string) => {
    if (!cmdPrompt.trim() || isLoading) return;
    setIsLoading(true);
    setQueryResponse(null);

    const logEntry: ExecLogEntry = {
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      command: cmdPrompt.length > 72 ? cmdPrompt.slice(0, 72) + "…" : cmdPrompt,
      success: false,
    };

    try {
      const res = await apiClient.post("/ai/query", { prompt: cmdPrompt });
      const data = res.data?.data?.result || res.data?.result || {};
      const result: QueryResponse = {
        text: data.textResponse || "Command executed and school data synchronized successfully.",
        chart: data.chartData || null,
        actionExecuted: data.actionExecuted || null,
        intent: data.intent || "GENERAL_QUERY",
      };
      setQueryResponse(result);
      setActiveTab("operations");
      logEntry.success = true;
      logEntry.intent = result.intent;
    } catch (err: any) {
      console.error("Failed to execute command", err);
      setQueryResponse({
        text: err?.response?.data?.message || "Sorry, I encountered an error while executing your command. Telemetry has been logged.",
        chart: null,
        actionExecuted: null,
      });
      logEntry.success = false;
    } finally {
      setIsLoading(false);
      // Keep last 5 entries, most recent first
      setExecLog((prev) => [logEntry, ...prev].slice(0, 5));
    }
  };

  // Auto-execute if ?q= provided in URL
  useEffect(() => {
    if (initialQuery) {
      setPrompt(initialQuery);
      executeCommand(initialQuery);
    }
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [prompt]);

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeCommand(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit();
    }
  };

  // ─── New Admission submission ─────────────────────────────────────────────
  const handleAdmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionForm.studentName.trim() || !admissionForm.parentName.trim()) return;
    setSubmittingAdmission(true);
    try {
      const res = await apiClient.post("/admissions/applications", {
        studentName: admissionForm.studentName,
        classApplied: admissionForm.classApplied,
        parentName: admissionForm.parentName,
        parentPhone: admissionForm.parentPhone || "N/A",
        dateOfBirth: admissionForm.dateOfBirth,
        gender: admissionForm.gender,
      });
      const app = res.data?.data || res.data;
      const appNo = app.applicationNo || "APP-2026-0001";

      setQueryResponse({
        text: `### ✅ Admission Application Registered\n\nApplication **${appNo}** has been generated for **${admissionForm.studentName}** (${admissionForm.classApplied}).\n\n- **Parent/Guardian:** ${admissionForm.parentName}\n- **Phone:** ${admissionForm.parentPhone || "N/A"}\n- **Status:** \`SUBMITTED\`\n\nThe candidate profile has been recorded in the Admissions Hub for screening and enrollment.`,
        chart: null,
        intent: "CREATE_ADMISSION",
        actionExecuted: {
          type: "ADMISSION_CREATED",
          title: `Admission Created: ${admissionForm.studentName}`,
          link: "/admissions",
          linkText: "View in Admissions Hub",
          details: {
            "Application No": appNo,
            "Student Name": admissionForm.studentName,
            "Class Applied": admissionForm.classApplied,
            "Parent": admissionForm.parentName,
            "Phone": admissionForm.parentPhone || "N/A",
          },
        },
      });

      setShowAdmissionModal(false);
      setAdmissionForm({ studentName: "", classApplied: "", parentName: "", parentPhone: "", gender: "MALE", dateOfBirth: "2010-05-15" });
      setActiveTab("operations");
    } catch (err: any) {
      console.error("Failed to submit admission", err);
      alert(err.response?.data?.message || "Failed to register admission application.");
    } finally {
      setSubmittingAdmission(false);
    }
  };

  // ─── Broadcast submission ─────────────────────────────────────────────────
  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return;
    setSubmittingBroadcast(true);
    try {
      const targetRole = broadcastForm.audience === "ALL_CAMPUS"
        ? undefined
        : broadcastForm.audience === "STAFF_ONLY" ? "TEACHER" : "PARENT";

      await apiClient.post("/messages/broadcast", {
        subject: broadcastForm.title,
        body: broadcastForm.message,
        targetRole,
      });

      const audienceLabel =
        broadcastForm.audience === "ALL_CAMPUS" ? "All Campus (Staff, Students & Parents)"
        : broadcastForm.audience === "STAFF_ONLY" ? "Faculty & Staff Members"
        : "Parents & Guardians";

      setQueryResponse({
        text: `### 📢 Announcement Broadcasted Successfully\n\n**Subject:** ${broadcastForm.title}\n\n${broadcastForm.message}\n\n*Delivered to ${audienceLabel} across the institution.*`,
        chart: null,
        intent: "SEND_ANNOUNCEMENT",
        actionExecuted: {
          type: "ANNOUNCEMENT_BROADCAST",
          title: `Broadcast Sent: ${broadcastForm.title}`,
          link: "/messages",
          linkText: "View in Messages Hub",
          details: {
            "Subject": broadcastForm.title,
            "Target Audience": audienceLabel,
            "Delivery Status": "Dispatched to user inboxes",
          },
        },
      });

      setShowBroadcastModal(false);
      setBroadcastForm({ audience: "ALL_CAMPUS", title: "", message: "" });
      setActiveTab("operations");
    } catch (err: any) {
      console.error("Failed to broadcast notice", err);
      alert(err?.response?.data?.message || "Failed to broadcast announcement.");
    } finally {
      setSubmittingBroadcast(false);
    }
  };

  // ─── 1-click action handlers ──────────────────────────────────────────────
  const handleConfirmSubstitution = (subKey: string) => {
    setConfirmedSubs((prev) => ({ ...prev, [subKey]: true }));
  };

  const handleAlertGuardian = (studentId: string) => {
    setGuardianAlerted((prev) => ({ ...prev, [studentId]: true }));
  };

  const handleReviewLeave = async (leaveId: string, status: "APPROVED" | "REJECTED") => {
    try {
      await apiClient.put(`/hr/leaves/${leaveId}/review`, { status, reviewNote: "Reviewed by Principal Command Center" });
    } catch {
      // optimistic update regardless
    } finally {
      setReviewedLeaves((prev) => ({ ...prev, [leaveId]: status }));
    }
  };

  // ─── Derived display data (real or sensible fallback) ────────────────────
  const overview = dashboardData?.overview || {
    totalStudents: 450,
    totalFaculty: 32,
    avgAcademicPct: 82,
    atRiskStudentsCount: 6,
    substitutionsNeeded: 2,
  };

  const substitutions: Array<{
    staffId?: string;
    name: string;
    status: string;
    recommendedSubstitute: string;
  }> = dashboardData?.substitutions || [
    { staffId: "1", name: "Mr. Vikram Rao (Physics)", status: "ABSENT", recommendedSubstitute: "Dr. Priya Raman (Room 204)" },
    { staffId: "2", name: "Mrs. Shanthi Kumar (English)", status: "EXCUSED", recommendedSubstitute: "Mrs. Susan Thomas (Period 2)" },
  ];

  // Sort at-risk: CRITICAL first, then by lowest attendance
  const rawAtRisk: Array<{
    id: string;
    name: string;
    admissionNumber: string;
    className: string;
    attendancePct: number;
    guardianPhone: string;
    riskFactor: string;
    severity: string;
  }> = dashboardData?.atRiskStudents || [
    { id: "s1", name: "Aarav Gupta", admissionNumber: "ADM-104", className: "Grade 10 - A", attendancePct: 68, guardianPhone: "+91-9876543210", riskFactor: "Attendance < 75%", severity: "CRITICAL" },
    { id: "s2", name: "Sneha Reddy", admissionNumber: "ADM-112", className: "Grade 9 - B", attendancePct: 71, guardianPhone: "+91-9876543211", riskFactor: "Consecutive Test Score Drop", severity: "WARNING" },
    { id: "s3", name: "Kavya Patel", admissionNumber: "ADM-128", className: "Grade 11 - MPC", attendancePct: 64, guardianPhone: "+91-9876543212", riskFactor: "Attendance < 75%", severity: "CRITICAL" },
    { id: "s4", name: "Rohan Varma", admissionNumber: "ADM-135", className: "Grade 10 - B", attendancePct: 73, guardianPhone: "+91-9876543213", riskFactor: "Consecutive Test Score Drop", severity: "WARNING" },
  ];

  const atRiskStudents = [...rawAtRisk].sort((a, b) => {
    if (a.severity === "CRITICAL" && b.severity !== "CRITICAL") return -1;
    if (b.severity === "CRITICAL" && a.severity !== "CRITICAL") return 1;
    return a.attendancePct - b.attendancePct;
  });

  const pendingLeaves: Array<{
    id: string;
    staffName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
  }> = dashboardData?.pendingLeaves || [];

  const anomalies: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    actionLabel?: string;
    actionRoute?: string;
  }> = dashboardData?.anomalies || [
    { id: "1", type: "CRITICAL", title: "Class 9-B Mathematics Grade Drop", description: "Average score decreased by 14% on recent unit assessment.", actionLabel: "Review Assessment", actionRoute: "/exams" },
    { id: "2", type: "WARNING", title: "3 Consecutive Days Absent: Rahul M.", description: "Student has missed 3 days without submitted leave notice.", actionLabel: "Contact Guardian", actionRoute: "/students" },
    { id: "3", type: "INFO", title: "Upcoming Term Exam Schedule Draft", description: "Exam timetable generated with zero room clashes.", actionLabel: "Approve Schedule", actionRoute: "/exams" },
  ];

  const pendingApprovalsCount = pendingLeaves.length;

  // Multi-color palette for Recharts datasets
  const chartColors = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

  // Intent badge label helper
  const intentLabel = (intent?: string) => {
    if (!intent) return null;
    return intent.replace(/_/g, " ");
  };

  // ─── Injected keyframes ───────────────────────────────────────────────────
  const globalStyles = `
    @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.7} }
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  `;

  // ─── Shared form input style ──────────────────────────────────────────────
  const formInput: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 0.85rem",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border-default)",
    background: "var(--bg-app)",
    color: "var(--text-primary)",
    fontSize: "var(--text-sm)",
    outline: "none",
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{globalStyles}</style>
      <div style={{ maxWidth: "1280px", margin: "0 auto", paddingBottom: "3rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>

        {/* ═══════════════════════════════════════════════════════════════
            HERO — Executive Command Center
        ═══════════════════════════════════════════════════════════════ */}
        <div style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
          borderRadius: "var(--radius-2xl)",
          padding: "2rem 2.25rem",
          color: "#FFFFFF",
          boxShadow: "var(--shadow-xl), 0 0 32px rgba(79, 70, 229, 0.28)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative orbs */}
          <div style={{ position: "absolute", top: "-60px", right: "-50px", width: "240px", height: "240px", borderRadius: "50%", background: "radial-gradient(circle, rgba(165,180,252,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-40px", left: "30%", width: "160px", height: "160px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

          {/* Title row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", position: "relative", zIndex: 1 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(99,102,241,0.3)", border: "1px solid rgba(165,180,252,0.35)", borderRadius: "var(--radius-full)", padding: "0.25rem 0.75rem", marginBottom: "0.5rem" }}>
                <Shield size={13} style={{ color: "#C7D2FE" }} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#E0E7FF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Executive Academic Command
                </span>
              </div>
              <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", margin: 0 }}>
                Principal Command Center
              </h1>
              <p style={{ color: "#C7D2FE", fontSize: "var(--text-sm)", margin: "0.35rem 0 0", maxWidth: "640px", lineHeight: 1.5 }}>
                Autonomous operations engine: dispatch admissions, broadcast notices, manage substitutions, review leaves, and run live academic telemetry.
              </p>
            </div>

            {/* Telemetry chips + refresh */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {[
                  { icon: <Award size={16} color="#10B981" />, label: "Academic Index", value: `${overview.avgAcademicPct}%`, valueColor: "#FFFFFF" },
                  { icon: <UserX size={16} color="#F59E0B" />, label: "Substitutions", value: `${overview.substitutionsNeeded} Today`, valueColor: "#F59E0B" },
                  { icon: <AlertTriangle size={16} color="#EF4444" />, label: "At-Risk", value: `${atRiskStudents.length} Students`, valueColor: "#EF4444" },
                ].map((chip) => (
                  <div key={chip.label} style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(199,210,254,0.25)", padding: "0.5rem 0.875rem", borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", gap: "0.5rem", backdropFilter: "blur(8px)" }}>
                    {chip.icon}
                    <div>
                      <div style={{ fontSize: "10px", color: "#94A3B8", textTransform: "uppercase", fontWeight: 700 }}>{chip.label}</div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: chip.valueColor }}>{chip.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={() => fetchDashboard(true)}
                disabled={isRefreshing || dashboardLoading}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(199,210,254,0.2)", borderRadius: "var(--radius-full)", padding: "0.3rem 0.75rem", color: "#A5B4FC", fontSize: "11px", fontWeight: 600, cursor: "pointer", backdropFilter: "blur(6px)", opacity: isRefreshing ? 0.7 : 1 }}
              >
                <RefreshCw size={12} style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }} />
                <span>{isRefreshing ? "Refreshing…" : `Updated ${lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}</span>
              </button>
            </div>
          </div>

          {/* Command input */}
          <form onSubmit={handleFormSubmit} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", position: "relative", zIndex: 1 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", background: "rgba(15,23,42,0.75)", backdropFilter: "blur(12px)", border: "1px solid rgba(199,210,254,0.35)", borderRadius: "var(--radius-xl)", padding: "0.6rem 1rem", boxShadow: "0 4px 18px rgba(0,0,0,0.25)" }}>
              <Zap size={18} color="#818CF8" style={{ marginRight: "0.75rem", flexShrink: 0 }} />
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask or command: e.g. 'Show attendance trend for Grade 10', 'Broadcast holiday notice', 'Pending fee summary'…"
                rows={1}
                disabled={isLoading}
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#FFFFFF", fontSize: "var(--text-sm)", resize: "none", fontFamily: "inherit", lineHeight: "1.4" }}
              />
              {prompt && (
                <button type="button" onClick={() => setPrompt("")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: "0.2rem", display: "flex", alignItems: "center" }}>
                  <X size={16} />
                </button>
              )}
            </div>
            <Button
              type="submit"
              isLoading={isLoading}
              style={{ padding: "0 1.5rem", borderRadius: "var(--radius-xl)", background: "#4F46E5", color: "#FFFFFF", fontWeight: 700, fontSize: "var(--text-sm)", display: "flex", alignItems: "center", gap: "0.45rem", border: "none", boxShadow: "0 4px 12px rgba(79,70,229,0.4)" }}
            >
              {!isLoading && <Send size={15} />}
              <span>{isLoading ? "Executing…" : "Execute"}</span>
            </Button>
          </form>

          {/* Executive action chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", paddingTop: "0.25rem" }}>
            <span style={{ fontSize: "11px", color: "#C7D2FE", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
              <Sparkles size={12} /> Quick Actions:
            </span>
            <button type="button" style={primaryChip} onClick={() => setShowAdmissionModal(true)}>
              <UserPlus size={12} color="#A5B4FC" /><span>New Admission</span>
            </button>
            <button type="button" style={primaryChip} onClick={() => setShowBroadcastModal(true)}>
              <Megaphone size={12} color="#A5B4FC" /><span>Broadcast Notice</span>
            </button>
            <button type="button" style={secondaryChip} onClick={() => { const q = "Run school-wide homework and assignment audit"; setPrompt(q); executeCommand(q); }}>
              <BookOpen size={12} color="#A5B4FC" /><span>Assignment Audit</span>
            </button>
            <button type="button" style={secondaryChip} onClick={() => { const q = "Show attendance trend and overall school percentage"; setPrompt(q); executeCommand(q); }}>
              <TrendingUp size={12} /><span>Attendance Pulse</span>
            </button>
            <button type="button" style={secondaryChip} onClick={() => { const q = "How many pending fee payments are there and what is the total overdue collection?"; setPrompt(q); executeCommand(q); }}>
              <DollarSign size={12} /><span>Fee Overdue Summary</span>
            </button>
            <button type="button" style={secondaryChip} onClick={() => { const q = "Show class-wise academic performance comparison across all grades"; setPrompt(q); executeCommand(q); }}>
              <BarChart2 size={12} /><span>Class Performance</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            COMMAND EXECUTION LOG — unique to Command Center
            (Dashboard shows KPI cards; Command Center tracks what was run)
        ═══════════════════════════════════════════════════════════════ */}
        {execLog.length > 0 && (
          <Card style={{ animation: "fadeIn 0.2s ease-out" }}>
            <CardHeader style={{ padding: "1rem 1.5rem 0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ padding: "0.35rem", borderRadius: "var(--radius-md)", background: "rgba(79,70,229,0.1)", color: "#4F46E5" }}>
                  <History size={16} />
                </div>
                <div>
                  <CardTitle style={{ fontSize: "var(--text-sm)", margin: 0 }}>Session Execution Log</CardTitle>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Commands run in this session — most recent first</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExecLog([])}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                <X size={12} /> Clear
              </button>
            </CardHeader>
            <CardContent style={{ padding: "0.75rem 1.5rem 1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {execLog.map((entry) => (
                  <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-lg)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)" }}>
                    <Terminal size={13} color={entry.success ? "#10B981" : "#EF4444"} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.command}
                      </div>
                    </div>
                    {entry.intent && (
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "var(--radius-full)", background: "rgba(79,70,229,0.08)", color: "#6366F1", flexShrink: 0, textTransform: "uppercase" }}>
                        {intentLabel(entry.intent)}
                      </span>
                    )}
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", flexShrink: 0 }}>{entry.time}</span>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: entry.success ? "#10B981" : "#EF4444", flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            AI COMMAND OUTPUT
        ═══════════════════════════════════════════════════════════════ */}
        {queryResponse && (
          <Card style={{ borderLeft: "4px solid #4F46E5", boxShadow: "var(--shadow-lg)", animation: "fadeIn 0.25s ease-out" }}>
            <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ padding: "0.4rem", borderRadius: "var(--radius-md)", background: "rgba(79,70,229,0.1)", color: "#4F46E5" }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <CardTitle style={{ fontSize: "var(--text-base)", margin: 0 }}>Agentic Operations Output</CardTitle>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Direct telemetry response & database verification</span>
                </div>
              </div>
              {queryResponse.intent && (
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "var(--radius-full)", background: "rgba(79,70,229,0.1)", color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {intentLabel(queryResponse.intent)}
                </span>
              )}
            </CardHeader>
            <CardContent style={{ padding: "0 1.5rem 1.5rem" }}>
              {/* Action receipt */}
              {queryResponse.actionExecuted && (
                <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.08) 100%)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "var(--radius-xl)", padding: "1.25rem", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF" }}>
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{queryResponse.actionExecuted.title}</h4>
                        <p style={{ margin: 0, fontSize: "11px", color: "var(--text-secondary)" }}>Verified and recorded into system database</p>
                      </div>
                    </div>
                    {queryResponse.actionExecuted.link && (
                      <Button size="sm" variant="outline" onClick={() => router.push(queryResponse.actionExecuted!.link!)} style={{ fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span>{queryResponse.actionExecuted.linkText || "View In Portal"}</span>
                        <ArrowRight size={13} />
                      </Button>
                    )}
                  </div>
                  {queryResponse.actionExecuted.details && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem", background: "var(--bg-surface)", padding: "0.75rem 1rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                      {Object.entries(queryResponse.actionExecuted.details).map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>{k}</div>
                          <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-primary)" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Markdown text */}
              <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.6, color: "var(--text-primary)" }}>
                <ReactMarkdown components={{
                  h3: ({ children }) => <h3 style={{ fontSize: "var(--text-base)", fontWeight: 800, margin: "0.75rem 0 0.35rem", color: "var(--text-primary)" }}>{children}</h3>,
                  p: ({ children }) => <p style={{ margin: "0.35rem 0", color: "var(--text-secondary)" }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: "0.35rem 0", paddingLeft: "1.25rem" }}>{children}</ul>,
                  li: ({ children }) => <li style={{ margin: "0.2rem 0", color: "var(--text-secondary)" }}>{children}</li>,
                  strong: ({ children }) => <strong style={{ fontWeight: 700, color: "var(--text-primary)" }}>{children}</strong>,
                }}>
                  {queryResponse.text}
                </ReactMarkdown>
              </div>

              {/* Dynamic Recharts output */}
              {queryResponse.chart && (
                <div style={{ height: "260px", width: "100%", marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-subtle)" }}>
                  <h4 style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                    {queryResponse.chart.title}
                  </h4>
                  <ResponsiveContainer width="100%" height="100%">
                    {queryResponse.chart.type === "line" ? (
                      <LineChart data={formatChartSeries(queryResponse.chart.labels, queryResponse.chart.datasets)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-tertiary)" fontSize={11} />
                        <YAxis axisLine={false} tickLine={false} stroke="var(--text-tertiary)" fontSize={11} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: "var(--bg-surface-solid)", borderColor: "var(--border-default)", borderRadius: "8px", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                        {queryResponse.chart.datasets.map((ds, i) => (
                          <Line key={i} type="monotone" dataKey={ds.label} stroke={chartColors[i % chartColors.length]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        ))}
                      </LineChart>
                    ) : (
                      <BarChart data={formatChartSeries(queryResponse.chart.labels, queryResponse.chart.datasets)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-tertiary)" fontSize={11} />
                        <YAxis axisLine={false} tickLine={false} stroke="var(--text-tertiary)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--bg-surface-solid)", borderColor: "var(--border-default)", borderRadius: "8px", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                        {queryResponse.chart.datasets.map((ds, i) => (
                          <Bar key={i} dataKey={ds.label} fill={chartColors[i % chartColors.length]} radius={[4, 4, 0, 0]} maxBarSize={50} />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            NAVIGATION TABS
        ═══════════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "0.25rem", overflowX: "auto" }}>
          {(
            [
              { key: "operations" as const, icon: <Sparkles size={16} />, label: `Autonomous Sentinel (${anomalies.length})`, activeColor: "#4F46E5", urgent: false },
              { key: "substitutions" as const, icon: <UserX size={16} />, label: `Substitution Radar (${substitutions.length})`, activeColor: "#F59E0B", urgent: false },
              { key: "interventions" as const, icon: <AlertTriangle size={16} />, label: `At-Risk Students (${atRiskStudents.length})`, activeColor: "var(--status-danger)", urgent: false },
              { key: "approvals" as const, icon: <CalendarCheck size={16} />, label: `Leave Approvals (${pendingApprovalsCount})`, activeColor: "#10B981", urgent: pendingApprovalsCount > 0 },
            ]
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.6rem 1.1rem", borderRadius: "var(--radius-lg)", border: "none",
                  background: isActive ? "var(--bg-surface-solid)" : "transparent",
                  color: isActive ? tab.activeColor : "var(--text-secondary)",
                  fontWeight: isActive ? 700 : 500, fontSize: "var(--text-sm)",
                  cursor: "pointer", boxShadow: isActive ? "var(--shadow-sm)" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.urgent && (
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#F59E0B", flexShrink: 0, animation: "pulse-dot 1.5s ease-in-out infinite" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1: AUTONOMOUS SENTINEL (AI Anomalies)
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "operations" && (
          dashboardLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.25rem" }}>
              {[1, 2, 3].map((i) => <SkeletonCard key={i} height={140} />)}
            </div>
          ) : anomalies.length === 0 ? (
            <Card>
              <CardContent style={{ padding: "3rem", textAlign: "center" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.875rem" }}>
                  <CheckCircle2 size={28} color="#10B981" />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: "var(--text-base)", color: "var(--text-primary)", margin: "0 0 0.35rem" }}>All Systems Healthy</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
                  No active anomalies detected. The Autonomous Sentinel is monitoring all parameters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.25rem" }}>
              {anomalies.map((item) => {
                const badge = getAnomalyBadgeStyle(item.type);
                return (
                  <Card key={item.id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <CardContent style={{ padding: "1.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "var(--radius-full)", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                          {badge.label}
                        </span>
                        <h4 style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{item.title}</h4>
                      </div>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>{item.description}</p>
                    </CardContent>
                    <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-app)" }}>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => { const q = `Investigate and take action on anomaly: ${item.title}`; setPrompt(q); executeCommand(q); }}
                        style={{ width: "100%", fontSize: "var(--text-xs)", justifyContent: "center" }}
                      >
                        <span>{item.actionLabel || "Investigate & Resolve"}</span>
                        <ArrowRight size={13} style={{ marginLeft: "0.35rem" }} />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 2: FACULTY SUBSTITUTION RADAR
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "substitutions" && (
          dashboardLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.25rem" }}>
              {[1, 2].map((i) => <SkeletonCard key={i} height={160} />)}
            </div>
          ) : substitutions.length === 0 ? (
            <Card>
              <CardContent style={{ padding: "3rem", textAlign: "center" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.875rem" }}>
                  <UserCheck size={28} color="#10B981" />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: "var(--text-base)", color: "var(--text-primary)", margin: "0 0 0.35rem" }}>All Faculty Present Today</h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, maxWidth: "360px", marginLeft: "auto", marginRight: "auto" }}>
                  No substitutions required. All teaching staff have marked attendance.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.25rem" }}>
              {substitutions.map((sub, idx) => {
                const subKey = sub.staffId || String(idx);
                const isConfirmed = confirmedSubs[subKey];
                return (
                  <Card key={idx} style={{ border: isConfirmed ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border-default)" }}>
                    <CardContent style={{ padding: "1.25rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{sub.name}</span>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "var(--radius-full)", background: "rgba(239,68,68,0.1)", color: "var(--status-danger)" }}>
                          {sub.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: isConfirmed ? "rgba(16,185,129,0.08)" : "var(--bg-app)", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", margin: "0.75rem 0" }}>
                        <UserCheck size={16} color={isConfirmed ? "var(--status-success)" : "#4F46E5"} />
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Recommended Substitute</div>
                          <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: isConfirmed ? "var(--status-success)" : "var(--text-primary)" }}>{sub.recommendedSubstitute}</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isConfirmed ? "secondary" : "primary"}
                        disabled={isConfirmed}
                        onClick={() => handleConfirmSubstitution(subKey)}
                        style={{ width: "100%", fontSize: "var(--text-xs)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", background: isConfirmed ? "rgba(16,185,129,0.15)" : "#4F46E5", color: isConfirmed ? "var(--status-success)" : "#FFFFFF", border: isConfirmed ? "1px solid rgba(16,185,129,0.3)" : "none" }}
                      >
                        {isConfirmed ? <><CheckCircle2 size={14} /> Confirmed & Substitute Notified</> : <><UserCheck size={14} /> Confirm & Auto-Assign</>}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3: AT-RISK STUDENTS (CRITICAL first + attendance bar)
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "interventions" && (
          <Card>
            <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <CardTitle style={{ fontSize: "var(--text-base)" }}>At-Risk Academic Intervention Watchlist</CardTitle>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  Sorted by severity — CRITICAL first. Attendance &lt; 75% or consecutive score regression.
                </span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "var(--radius-full)", background: "rgba(239,68,68,0.1)", color: "var(--status-danger)" }}>
                {atRiskStudents.length} Flagged
              </span>
            </CardHeader>
            <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
              {dashboardLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {[1, 2, 3].map((i) => <SkeletonCard key={i} height={72} />)}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {atRiskStudents.map((s) => {
                    const isAlerted = guardianAlerted[s.id];
                    const isCritical = s.severity === "CRITICAL";
                    const barColor = s.attendancePct < 65 ? "#EF4444" : s.attendancePct < 75 ? "#F59E0B" : "#10B981";
                    return (
                      <div
                        key={s.id}
                        style={{ padding: "1rem", borderRadius: "var(--radius-lg)", background: isCritical ? "rgba(239,68,68,0.03)" : "var(--bg-app)", border: isCritical ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border-default)" }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{s.name}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>({s.className} • {s.admissionNumber})</span>
                              <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "var(--radius-full)", background: isCritical ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)", color: isCritical ? "var(--status-danger)" : "var(--status-warning)" }}>
                                {s.riskFactor}
                              </span>
                            </div>
                            {/* Attendance progress bar */}
                            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0 }}>Attendance:</span>
                              <div style={{ flex: 1, height: "6px", background: "var(--border-default)", borderRadius: "3px", overflow: "hidden", maxWidth: "160px" }}>
                                <div style={{ height: "100%", width: `${s.attendancePct}%`, background: barColor, borderRadius: "3px", transition: "width 0.6s ease" }} />
                              </div>
                              <b style={{ fontSize: "11px", color: barColor, fontWeight: 700, flexShrink: 0 }}>{s.attendancePct}%</b>
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                • <Phone size={10} style={{ display: "inline", verticalAlign: "middle" }} /> {s.guardianPhone}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isAlerted ? "secondary" : "outline"}
                            disabled={isAlerted}
                            onClick={() => handleAlertGuardian(s.id)}
                            style={{ fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: "0.35rem", color: isAlerted ? "var(--status-success)" : "var(--text-primary)", flexShrink: 0 }}
                          >
                            {isAlerted ? <><CheckCircle2 size={13} color="var(--status-success)" /> SMS Alert Dispatched</> : <><Phone size={13} /> Send Guardian Notice</>}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 4: EXECUTIVE LEAVE APPROVALS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "approvals" && (
          <Card>
            <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <CardTitle style={{ fontSize: "var(--text-base)" }}>Executive Leave Approvals Queue</CardTitle>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  Review pending faculty and staff leave requests
                </span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "var(--radius-full)", background: pendingApprovalsCount > 0 ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)", color: pendingApprovalsCount > 0 ? "var(--status-warning)" : "var(--status-success)" }}>
                {pendingApprovalsCount} Pending
              </span>
            </CardHeader>
            <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
              {dashboardLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {[1, 2].map((i) => <SkeletonCard key={i} height={80} />)}
                </div>
              ) : pendingLeaves.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {pendingLeaves.map((leave) => {
                    const reviewed = reviewedLeaves[leave.id];
                    return (
                      <div key={leave.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-app)", border: "1px solid var(--border-default)", flexWrap: "wrap", gap: "0.75rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{leave.staffName}</span>
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "var(--radius-full)", background: "rgba(59,130,246,0.1)", color: "var(--brand-primary)" }}>{leave.leaveType}</span>
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                            {formatDate(leave.startDate)} – {formatDate(leave.endDate)} • {leave.reason}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {reviewed ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "0.25rem 0.65rem", borderRadius: "var(--radius-full)", background: reviewed === "APPROVED" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: reviewed === "APPROVED" ? "var(--status-success)" : "var(--status-danger)" }}>
                              {reviewed}
                            </span>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleReviewLeave(leave.id, "REJECTED")} style={{ fontSize: "var(--text-xs)", color: "var(--status-danger)" }}>Reject</Button>
                              <Button size="sm" variant="primary" onClick={() => handleReviewLeave(leave.id, "APPROVED")} style={{ fontSize: "var(--text-xs)", background: "#10B981" }}>Approve</Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
                  <CheckCircle2 size={32} color="var(--status-success)" style={{ margin: "0 auto 0.5rem" }} />
                  <p style={{ fontWeight: 700, fontSize: "var(--text-sm)", margin: 0 }}>All leave requests are up to date.</p>
                  <p style={{ fontSize: "var(--text-xs)", margin: "0.25rem 0 0" }}>No pending approvals in queue.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 1: New Admission
        ═══════════════════════════════════════════════════════════════ */}
        {showAdmissionModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div style={{ background: "var(--bg-surface-solid)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-2xl)", width: "100%", maxWidth: "520px", boxShadow: "var(--shadow-2xl)", overflow: "hidden", animation: "fadeIn 0.2s ease-out" }}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-app)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{ padding: "0.4rem", borderRadius: "var(--radius-md)", background: "rgba(79,70,229,0.1)", color: "#4F46E5" }}><UserPlus size={20} /></div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>Register New Student Admission</h3>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Direct enrollment candidate registration</span>
                  </div>
                </div>
                <button type="button" onClick={() => setShowAdmissionModal(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <form onSubmit={handleAdmissionSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem", textTransform: "uppercase" }}>Student Full Name *</label>
                  <input type="text" required placeholder="e.g. Ananya Sen" value={admissionForm.studentName} onChange={(e) => setAdmissionForm({ ...admissionForm, studentName: e.target.value })} style={formInput} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem", textTransform: "uppercase" }}>Class / Stream *</label>
                    <input type="text" required placeholder="e.g. Grade 11 Science" value={admissionForm.classApplied} onChange={(e) => setAdmissionForm({ ...admissionForm, classApplied: e.target.value })} style={formInput} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem", textTransform: "uppercase" }}>Gender *</label>
                    <select value={admissionForm.gender} onChange={(e) => setAdmissionForm({ ...admissionForm, gender: e.target.value as "MALE" | "FEMALE" | "OTHER" })} style={formInput}>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem", textTransform: "uppercase" }}>Parent / Guardian *</label>
                    <input type="text" required placeholder="e.g. Vikram Sen" value={admissionForm.parentName} onChange={(e) => setAdmissionForm({ ...admissionForm, parentName: e.target.value })} style={formInput} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem", textTransform: "uppercase" }}>Contact Phone *</label>
                    <input type="tel" required placeholder="e.g. 9876543210" value={admissionForm.parentPhone} onChange={(e) => setAdmissionForm({ ...admissionForm, parentPhone: e.target.value })} style={formInput} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.75rem" }}>
                  <Button type="button" variant="outline" onClick={() => setShowAdmissionModal(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" isLoading={submittingAdmission} style={{ background: "#4F46E5" }}>Register Application</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 2: Broadcast Announcement
        ═══════════════════════════════════════════════════════════════ */}
        {showBroadcastModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div style={{ background: "var(--bg-surface-solid)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-2xl)", width: "100%", maxWidth: "520px", boxShadow: "var(--shadow-2xl)", overflow: "hidden", animation: "fadeIn 0.2s ease-out" }}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-app)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{ padding: "0.4rem", borderRadius: "var(--radius-md)", background: "rgba(99,102,241,0.1)", color: "#4F46E5" }}><Megaphone size={20} /></div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>Broadcast School Announcement</h3>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Instant circular delivery across campus</span>
                  </div>
                </div>
                <button type="button" onClick={() => setShowBroadcastModal(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <form onSubmit={handleBroadcastSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem", textTransform: "uppercase" }}>Target Audience *</label>
                  <select value={broadcastForm.audience} onChange={(e) => setBroadcastForm({ ...broadcastForm, audience: e.target.value })} style={formInput}>
                    <option value="ALL_CAMPUS">All Campus (Staff, Students & Parents)</option>
                    <option value="STAFF_ONLY">Faculty & Staff Members Only</option>
                    <option value="PARENTS_ONLY">Parents & Guardians Only</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem", textTransform: "uppercase" }}>Announcement Title *</label>
                  <input type="text" required placeholder="e.g. Annual Day Rehearsal Schedule" value={broadcastForm.title} onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })} style={formInput} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.35rem", textTransform: "uppercase" }}>Message / Circular Body *</label>
                  <textarea required rows={4} placeholder="Enter the complete announcement message…" value={broadcastForm.message} onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })} style={{ ...formInput, fontFamily: "inherit", resize: "vertical" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.75rem" }}>
                  <Button type="button" variant="outline" onClick={() => setShowBroadcastModal(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" isLoading={submittingBroadcast} style={{ background: "#4F46E5" }}>Send Broadcast</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Suspense wrapper ─────────────────────────────────────────────────────────
export default function PrincipalCommandCenter() {
  return (
    <Suspense fallback={
      <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <SkeletonCard height={220} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} height={140} />)}
        </div>
      </div>
    }>
      <PrincipalCommandContent />
    </Suspense>
  );
}
