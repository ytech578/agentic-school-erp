"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Award, AlertTriangle, Users, Sparkles, Send,
  ArrowRight, CheckCircle2, TrendingUp, BookOpen,
  CalendarCheck, UserX, UserCheck, Bot, BarChart2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { DashboardKpiCard } from "@/components/ui/DashboardKpiCard";
import { formatDate, getAnomalyBadgeStyle } from "@/lib/formatters";

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ height: "180px", background: "var(--bg-surface)", borderRadius: "var(--radius-2xl)", animation: "shimmer 1.5s infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        {Array(4).fill(0).map((_, i) => (
          <div key={i} style={{ height: "130px", background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", animation: "shimmer 1.5s infinite" }} />
        ))}
      </div>
    </div>
  );
}

export function PrincipalDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commandPrompt, setCommandPrompt] = useState("");
  const [commandRunning, setCommandRunning] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await apiClient.get("/dashboard/principal");
        setData(res.data?.data || res.data);
      } catch (err) {
        console.error("Failed to fetch principal dashboard", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandPrompt.trim()) return;
    router.push(`/principal?q=${encodeURIComponent(commandPrompt)}`);
  };

  if (loading) return <LoadingSkeleton />;

  const overview = data?.overview;
  const classComparison = data?.classComparison || [];
  const substitutions = data?.substitutions || [];
  const anomalies = data?.anomalies || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Principal Command Center Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
        borderRadius: "var(--radius-2xl)",
        padding: "2rem 2.25rem",
        color: "#FFFFFF",
        boxShadow: "var(--shadow-xl), 0 0 28px rgba(79, 70, 229, 0.25)",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", bottom: "-60px", right: "-40px", width: "220px", height: "220px", borderRadius: "50%", background: "radial-gradient(circle, rgba(165, 180, 252, 0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(99, 102, 241, 0.25)", border: "1px solid rgba(165, 180, 252, 0.3)", borderRadius: "var(--radius-full)", padding: "0.25rem 0.75rem", marginBottom: "0.5rem" }}>
              <Sparkles size={13} style={{ color: "#C7D2FE" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#E0E7FF", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Executive Academic Command
              </span>
            </div>
            <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              Principal Executive Desk
            </h2>
            <p style={{ color: "#C7D2FE", fontSize: "var(--text-sm)", margin: 0, maxWidth: "600px" }}>
              Academic quality monitoring, faculty substitution intelligence, at-risk student intervention, and natural-language school automation.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => router.push('/principal')}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255, 255, 255, 0.15)", color: "#FFFFFF", border: "1px solid rgba(255, 255, 255, 0.3)", backdropFilter: "blur(8px)" }}
          >
            <Bot size={16} /> Open Full Command Center <ArrowRight size={14} />
          </Button>
        </div>

        {/* Natural Language Executive Command Bar */}
        <form onSubmit={handleCommandSubmit} style={{ display: "flex", gap: "0.5rem", zIndex: 1 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(199, 210, 254, 0.3)", borderRadius: "var(--radius-xl)", padding: "0.5rem 1rem", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)" }}>
            <Sparkles size={18} color="#818CF8" style={{ marginRight: "0.75rem", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Ask or execute: 'Show attendance trend for Grade 10' or 'Broadcast holiday alert'..."
              value={commandPrompt}
              onChange={(e) => setCommandPrompt(e.target.value)}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#FFFFFF", fontSize: "var(--text-sm)" }}
            />
          </div>
          <button
            type="submit"
            style={{ padding: "0 1.25rem", borderRadius: "var(--radius-xl)", border: "none", background: "#4F46E5", color: "#FFFFFF", fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Send size={15} /> Execute
          </button>
        </form>
      </div>

      {/* Academic Overview KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        <DashboardKpiCard
          label="Academic Index"
          value={overview ? `${overview.avgAcademicPct}%` : "—"}
          icon={Award}
          color="#10B981"
          trend="up"
          trendLabel="+3.8% Overall Performance"
          onClick={() => router.push('/reports')}
        />
        <DashboardKpiCard
          label="At-Risk Students"
          value={overview ? `${overview.atRiskStudentsCount} Students` : "—"}
          icon={AlertTriangle}
          color="#EF4444"
          subText="Attendance < 75% or score drop"
          onClick={() => router.push('/students')}
        />
        <DashboardKpiCard
          label="Substitutions Today"
          value={overview ? `${overview.substitutionsNeeded} Required` : "—"}
          icon={UserX}
          color="#F59E0B"
          subText="Recommended substitutes ready"
          onClick={() => router.push('/timetable')}
        />
        <DashboardKpiCard
          label="Faculty Strength"
          value={overview?.totalFaculty ?? "—"}
          icon={Users}
          color="#6366F1"
          subText="Active Teaching Staff"
          onClick={() => router.push('/hr')}
        />
      </div>

      {/* Mid Section: Class Academic Health & Teacher Substitutions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "1.5rem" }}>
        {/* Class Performance Comparison Chart */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Class Academic Competency & Attendance</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Class-by-class average test scores vs attendance percentage</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => router.push('/reports')} style={{ fontSize: "var(--text-xs)" }}>
              Detailed Reports <ArrowRight size={13} style={{ marginLeft: "0.25rem" }} />
            </Button>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {classComparison.length > 0 ? (
              <div style={{ height: "250px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classComparison} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} domain={[50, 100]} />
                    <Tooltip contentStyle={{ background: "var(--bg-surface-solid)", borderColor: "var(--border-default)", borderRadius: "8px", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar dataKey="avgScore" name="Avg Score (%)" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="attendance" name="Attendance (%)" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: "250px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <BarChart2 size={32} color="var(--text-tertiary)" />
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>No class comparison data available yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teacher Substitution Recommendations */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Faculty Substitution Radar</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Automated resolution for absent teachers today</p>
            </div>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {substitutions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {substitutions.map((sub: any, i: number) => (
                  <div key={i} style={{ padding: "0.875rem", borderRadius: "var(--radius-lg)", background: "var(--bg-app)", border: "1px solid var(--border-default)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>{sub.name}</span>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.4rem", borderRadius: "var(--radius-full)", background: "rgba(239, 68, 68, 0.1)", color: "var(--status-danger)" }}>
                        {sub.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "11px", color: "var(--status-success)", fontWeight: 600, marginTop: "0.35rem" }}>
                      <UserCheck size={13} />
                      Substitute: {sub.recommendedSubstitute}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => router.push('/timetable')} style={{ width: "100%", marginTop: "0.6rem", fontSize: "11px", padding: "0.35rem" }}>
                      Confirm Substitution
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <CheckCircle2 size={24} color="var(--status-success)" style={{ margin: "0 auto 0.5rem" }} />
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>Full faculty attendance today.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Autonomous Anomaly Sentinel Feed */}
      <Card>
        <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles size={18} color="var(--brand-primary)" />
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Autonomous AI Anomaly Sentinel</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Proactive alerts detected across academic, attendance & financial workflows</p>
            </div>
          </div>
          {anomalies.length > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "var(--radius-full)", background: "rgba(99, 102, 241, 0.1)", color: "#4F46E5" }}>
              {anomalies.length} Flagged Incidents
            </span>
          )}
        </CardHeader>
        <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
          {anomalies.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0.875rem" }}>
              {anomalies.map((item: any) => {
                const badge = getAnomalyBadgeStyle(item.type);
                return (
                  <div
                    key={item.id}
                    style={{ padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-app)", border: item.type === "CRITICAL" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border-default)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "var(--radius-full)", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                          {badge.label}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>{item.title}</span>
                      </div>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{item.description}</p>
                    </div>
                    {item.actionLabel && (
                      <Button size="sm" variant="outline" onClick={() => router.push(item.actionRoute || '/principal')} style={{ marginTop: "0.75rem", fontSize: "11px", justifyContent: "center" }}>
                        {item.actionLabel}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "2.5rem", textAlign: "center" }}>
              <CheckCircle2 size={32} color="var(--status-success)" style={{ marginBottom: "0.75rem" }} />
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0, fontWeight: 600 }}>No AI alerts today 🎉</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "0.25rem" }}>All academic and operational metrics are within expected thresholds.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
