"use client";

import React, { useState } from "react";
import {
  Bot, Zap, DollarSign, Users, Calendar, GraduationCap,
  FileText, ClipboardList, AlertTriangle,
  Play, Send, Loader2, Info, Sparkles, CheckCircle, X
} from "lucide-react";
import { apiClient } from "@/lib/axios";

interface AutomationTask {
  taskType: string;
  count: number;
  items: any[];
}

const AUTOMATIONS = [
  {
    key: "FEE_DEFAULTER",
    label: "Fee Defaulter Follow-Up",
    icon: "DollarSign",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    description: "Detect students with overdue fees and send AI-drafted reminders to parents.",
    confirmLabel: "Send Reminder Messages",
    confirmDesc: "This will send personalized fee reminder messages to the parents/guardians of all listed students.",
  },
  {
    key: "ABSENCE_ALERT",
    label: "Consecutive Absence Alerts",
    icon: "Users",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    description: "Find students absent for 3+ consecutive days and alert their parents immediately.",
    confirmLabel: "Send Absence Alerts",
    confirmDesc: "This will send caring absence alert messages to the parents/guardians of listed students.",
  },
  {
    key: "TIMETABLE_COVER",
    label: "Timetable Cover Assignment",
    icon: "Calendar",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.1)",
    description: "Detect teacher leaves with timetable conflicts and auto-assign suggested substitutes.",
    confirmLabel: "Assign Substitutes",
    confirmDesc: "This will update the timetable, reassigning the listed periods to suggested substitute teachers.",
  },
  {
    key: "ATTENDANCE_WARNING",
    label: "Attendance Warning Letters",
    icon: "AlertTriangle",
    color: "#f97316",
    bg: "rgba(249,115,22,0.1)",
    description: "Identify students with below 75% attendance and send formal warning letters.",
    confirmLabel: "Send Warning Letters",
    confirmDesc: "This will send formal attendance warning letters to students and their parents.",
  },
  {
    key: "LEAVE_RECOMMENDATION",
    label: "Leave AI Recommendation",
    icon: "ClipboardList",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.1)",
    description: "AI reviews all pending leave requests, checks for conflicts, and recommends Approve/Review.",
    confirmLabel: "Apply AI Recommendations",
    confirmDesc: "This will add AI recommendation notes to all pending leave requests for quick admin review.",
  },
  {
    key: "REPORT_CARD_PUBLISH",
    label: "Report Card Readiness",
    icon: "GraduationCap",
    color: "#10b981",
    bg: "rgba(16,185,129,0.1)",
    description: "Check which completed exams have all marks entered and are ready for result publication.",
    confirmLabel: "Notify Results Ready",
    confirmDesc: "This will notify students and parents that results are ready for the listed exams.",
  },
  {
    key: "DAILY_DIGEST",
    label: "Daily School Digest",
    icon: "FileText",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.1)",
    description: "Generate and deliver a comprehensive daily school summary to the principal.",
    confirmLabel: "Send Daily Digest",
    confirmDesc: "This will send today's school digest summary to the principal message inbox.",
  },
];

const ICONS: Record<string, any> = { DollarSign, Users, Calendar, AlertTriangle, ClipboardList, GraduationCap, FileText };

export default function AutomationHubPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [previews, setPreviews] = useState<Record<string, AutomationTask | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState<string | null>(null);

  const modalOverlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--bg-overlay)", backdropFilter: "var(--modal-backdrop-blur)", WebkitBackdropFilter: "var(--modal-backdrop-blur)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", animation: "fadeIn 0.2s ease-out" };
  const modalBoxStyle: React.CSSProperties = { background: "var(--bg-surface-solid)", backgroundColor: "var(--bg-surface-solid)", opacity: 1, borderRadius: "var(--radius-xl)", padding: "2rem", maxWidth: "480px", width: "100%", border: "1px solid var(--border-default)", boxShadow: "var(--modal-shadow)", animation: "zoomIn 0.2s ease-out" };

  const automation = AUTOMATIONS[activeTab];
  const IconComponent = ICONS[automation.icon];

  const runScan = async (key: string) => {
    setLoading(l => ({ ...l, [key]: true }));
    setError(e => ({ ...e, [key]: "" }));
    setPreviews(p => ({ ...p, [key]: null }));
    setResults(r => ({ ...r, [key]: null }));
    try {
      const res = await apiClient.get(`/ai/automation/preview/${key}`);
      const data = res.data.data || res.data;
      setPreviews(p => ({ ...p, [key]: data }));
    } catch (err: any) {
      setError(e => ({ ...e, [key]: err?.response?.data?.message || "Failed to run scan." }));
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  };

  const executeTask = async (key: string) => {
    const preview = previews[key];
    if (!preview) return;
    setExecuting(x => ({ ...x, [key]: true }));
    setConfirmOpen(null);
    try {
      const res = await apiClient.post("/ai/automation/execute", {
        taskType: key,
        payload: { items: preview.items, subject: automation.label },
      });
      const data = res.data.data || res.data;
      setResults(r => ({ ...r, [key]: data }));
      setPreviews(p => ({ ...p, [key]: null }));
    } catch (err: any) {
      setError(e => ({ ...e, [key]: err?.response?.data?.message || "Execution failed." }));
    } finally {
      setExecuting(x => ({ ...x, [key]: false }));
    }
  };

  const preview = previews[automation.key];
  const isLoading = loading[automation.key];
  const isExecuting = executing[automation.key];
  const result = results[automation.key];
  const err = error[automation.key];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #6366f1, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--text-primary)" }}>Agentic Automation Hub</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>AI-powered workflows with human confirmation — reduce manual work across all operations</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--brand-teal)", fontWeight: 600, fontSize: "var(--text-sm)", background: "rgba(6,182,212,0.08)", borderRadius: "999px", padding: "0.4rem 0.9rem", border: "1px solid rgba(6,182,212,0.2)" }}>
            <Sparkles size={14} />Powered by Gemini AI
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1.5rem" }}>
        <div style={{ width: "260px", flexShrink: 0, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xl)", padding: "0.75rem", height: "fit-content" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", padding: "0.25rem 0.5rem", marginBottom: "0.5rem" }}>Automations</p>
          {AUTOMATIONS.map((a, i) => {
            const Icon = ICONS[a.icon];
            const hasResult = results[a.key];
            const hasScan = previews[a.key];
            const count = hasScan?.count || 0;
            return (
              <button key={a.key} onClick={() => setActiveTab(i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.75rem", borderRadius: "var(--radius-lg)", border: "none", background: activeTab === i ? a.bg : "transparent", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0, background: activeTab === i ? a.bg : "var(--bg-app)", border: `1px solid ${activeTab === i ? a.color + "44" : "var(--border-light)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} color={activeTab === i ? a.color : "var(--text-tertiary)"} />
                </div>
                <span style={{ fontSize: "0.8125rem", fontWeight: activeTab === i ? 600 : 400, color: activeTab === i ? a.color : "var(--text-secondary)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.label}</span>
                {hasResult && <CheckCircle size={14} color="#10b981" style={{ flexShrink: 0 }} />}
                {!hasResult && count > 0 && <span style={{ background: a.color, color: "#fff", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.4rem", flexShrink: 0 }}>{count}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xl)", padding: "1.5rem", borderLeft: `4px solid ${automation.color}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: automation.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${automation.color}33` }}>
                  <IconComponent size={22} color={automation.color} />
                </div>
                <div>
                  <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", color: "var(--text-primary)", marginBottom: "0.25rem" }}>{automation.label}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{automation.description}</p>
                </div>
              </div>
              <button onClick={() => runScan(automation.key)} disabled={isLoading || isExecuting} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.25rem", borderRadius: "var(--radius-md)", background: `linear-gradient(135deg, ${automation.color}, ${automation.color}cc)`, color: "#fff", border: "none", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.875rem", flexShrink: 0, opacity: isLoading ? 0.7 : 1, transition: "all 0.15s", boxShadow: `0 2px 8px ${automation.color}44` }}>
                {isLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={16} />}
                {isLoading ? "Scanning..." : "Run Scan"}
              </button>
            </div>
          </div>

          {err && (
            <div style={{ padding: "1rem 1.25rem", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "var(--text-sm)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <AlertTriangle size={16} />{err}
            </div>
          )}

          {result && (
            <div style={{ padding: "1.25rem 1.5rem", borderRadius: "var(--radius-xl)", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", gap: "1rem" }}>
              <CheckCircle size={28} color="#10b981" />
              <div>
                <p style={{ fontWeight: 700, color: "#10b981", fontSize: "var(--text-base)" }}>Automation Executed Successfully!</p>
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{result.actionsCount} action(s) completed for <strong>{result.taskType?.replace(/_/g, " ")}</strong>.</p>
              </div>
              <button onClick={() => setResults(r => ({ ...r, [automation.key]: null }))} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={18} /></button>
            </div>
          )}

          {!isLoading && !preview && !result && !err && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xl)", padding: "4rem 2rem", textAlign: "center" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: automation.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem", border: `1px solid ${automation.color}33` }}>
                <IconComponent size={28} color={automation.color} />
              </div>
              <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem", fontSize: "var(--text-base)" }}>Ready to scan</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", maxWidth: "340px" }}>Click <strong>"Run Scan"</strong> to let the AI analyze your school data and generate actionable recommendations.</p>
            </div>
          )}

          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[1,2,3].map(i => <div key={i} style={{ height: "80px", borderRadius: "var(--radius-lg)", background: "var(--bg-surface)", border: "1px solid var(--border-default)", animation: "shimmer 1.5s infinite" }} />)}
            </div>
          )}

          {preview && !isLoading && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Info size={16} color="var(--text-tertiary)" />
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{preview.count} item{preview.count !== 1 ? "s" : ""} found</span>
                  <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>— Review before confirming</span>
                </div>
                {preview.count > 0 && (
                  <button onClick={() => setConfirmOpen(automation.key)} disabled={isExecuting} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", borderRadius: "var(--radius-md)", background: "#10b981", color: "#fff", border: "none", cursor: isExecuting ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                    {isExecuting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
                    {isExecuting ? "Executing..." : "Confirm & Execute"}
                  </button>
                )}
              </div>

              {preview.count === 0 ? (
                <div style={{ padding: "2rem", borderRadius: "var(--radius-xl)", background: "var(--bg-surface)", border: "1px solid var(--border-default)", textAlign: "center", color: "var(--text-tertiary)" }}>
                  <CheckCircle size={32} color="#10b981" style={{ margin: "0 auto 1rem" }} />
                  <p style={{ fontWeight: 600, color: "#10b981" }}>All clear! No action needed.</p>
                  <p style={{ fontSize: "var(--text-sm)", marginTop: "0.25rem" }}>No items require attention for this automation right now.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "500px", overflowY: "auto" }}>
                  {preview.items.map((item: any, idx: number) => (
                    <div key={item.id || idx} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "1rem 1.25rem", borderLeft: `3px solid ${automation.color}` }}>
                      <PreviewCard item={item} taskType={automation.key} color={automation.color} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {confirmOpen && (() => {
        const conf = AUTOMATIONS.find(a => a.key === confirmOpen)!;
        const ConfIcon = ICONS[conf.icon];
        return (
          <div style={modalOverlayStyle}>
            <div style={modalBoxStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: conf.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={20} color={conf.color} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>Confirm Execution</h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.6, marginBottom: "0.75rem" }}>{conf.confirmDesc}</p>
              <div style={{ background: "var(--bg-app)", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle size={14} color="#f59e0b" />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>This will affect <strong>{previews[confirmOpen]?.count || 0} record(s)</strong>. This action cannot be undone.</span>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => setConfirmOpen(null)} style={{ flex: 1, padding: "0.75rem", borderRadius: "var(--radius-md)", background: "var(--bg-app)", border: "1px solid var(--border-default)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>Cancel</button>
                <button onClick={() => executeTask(confirmOpen)} style={{ flex: 1, padding: "0.75rem", borderRadius: "var(--radius-md)", background: "#10b981", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                  <Send size={16} />{conf.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function PreviewCard({ item, taskType, color }: { item: any; taskType: string; color: string }) {
  if (taskType === "FEE_DEFAULTER") return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.studentName}</span>
        <span style={{ fontWeight: 700, color }}> Rs.{item.outstandingAmount?.toLocaleString()}</span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: "0.5rem" }}>To: {item.guardianName} - {item.status}</p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>{item.draftMessage}</p>
    </div>
  );
  if (taskType === "ABSENCE_ALERT") return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.studentName}</span>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color, background: color + "22", padding: "0.2rem 0.6rem", borderRadius: "999px" }}>{item.absenceDays} days absent</span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: "0.5rem" }}>To: {item.guardianName}</p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>{item.draftMessage}</p>
    </div>
  );
  if (taskType === "TIMETABLE_COVER") return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.absentStaff} (on leave)</span>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color }}>{item.affectedPeriods} period(s) affected</span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>Suggested substitute: <strong style={{ color }}>{item.suggestedSubstitute}</strong></p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", fontStyle: "italic" }}>{item.draftMessage}</p>
    </div>
  );
  if (taskType === "ATTENDANCE_WARNING") return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.studentName}</span>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color, background: color + "22", padding: "0.2rem 0.6rem", borderRadius: "999px" }}>{item.attendancePercent}% attendance</span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: "0.5rem" }}>To: {item.guardianName}</p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>{item.draftMessage}</p>
    </div>
  );
  if (taskType === "LEAVE_RECOMMENDATION") return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.staffName}</span>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, padding: "0.2rem 0.7rem", borderRadius: "999px", background: item.recommendation === "APPROVE" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: item.recommendation === "APPROVE" ? "#10b981" : "#f59e0b" }}>AI: {item.recommendation}</span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: "0.4rem" }}>{item.leaveType} - {item.totalDays} day(s) - {item.timetableConflicts} conflict(s)</p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.reasoning}</p>
    </div>
  );
  if (taskType === "REPORT_CARD_PUBLISH") return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{item.examName}</span>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, padding: "0.2rem 0.7rem", borderRadius: "999px", background: item.isComplete ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: item.isComplete ? "#10b981" : "#ef4444" }}>{item.isComplete ? "Ready" : "Incomplete"}</span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: "0.4rem" }}>{item.marksEntered}/{item.totalSubjects} subjects with marks entered</p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontStyle: "italic" }}>{item.draftMessage}</p>
    </div>
  );
  if (taskType === "DAILY_DIGEST") return (
    <div>
      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>Today School Summary</p>
      {item.stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
          {Object.entries(item.stats).map(([k, v]: any) => (
            <div key={k} style={{ background: "var(--bg-app)", borderRadius: "var(--radius-md)", padding: "0.6rem 0.75rem" }}>
              <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: "0.2rem" }}>{k.replace(/([A-Z])/g, " $1").trim()}</p>
              <p style={{ fontWeight: 700, color, fontSize: "var(--text-base)" }}>{String(v)}</p>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontStyle: "italic", whiteSpace: "pre-line", lineHeight: 1.6 }}>{item.draftMessage}</p>
    </div>
  );
  return <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{JSON.stringify(item)}</p>;
}
