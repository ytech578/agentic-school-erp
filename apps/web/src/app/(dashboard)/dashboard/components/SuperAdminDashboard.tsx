"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Users, ShieldCheck, Activity, Plus, ArrowRight,
  Server, CheckCircle2, Clock, RefreshCw,
  Globe, Sparkles, Database, ExternalLink, Cpu
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { DashboardKpiCard } from "@/components/ui/DashboardKpiCard";
import { formatDate, formatTimeAgo } from "@/lib/formatters";

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ height: "160px", background: "var(--bg-surface)", borderRadius: "var(--radius-2xl)", animation: "shimmer 1.5s infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        {Array(4).fill(0).map((_, i) => (
          <div key={i} style={{ height: "130px", background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", animation: "shimmer 1.5s infinite" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div style={{ height: "300px", background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", animation: "shimmer 1.5s infinite" }} />
        <div style={{ height: "300px", background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", animation: "shimmer 1.5s infinite" }} />
      </div>
    </div>
  );
}

export function SuperAdminDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await apiClient.get("/dashboard/super-admin");
      setData(res.data?.data || res.data);
    } catch (err) {
      console.error("Failed to fetch super admin dashboard", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchDashboard(); };

  if (loading) return <LoadingSkeleton />;

  const fleet = data?.fleet;
  const health = data?.systemHealth;
  const recentSchools = data?.recentSchools || [];
  const recentLogs = data?.recentActivityLogs || [];

  const apiLatencyMs = health?.apiLatencyMs;
  const latencyColor =
    apiLatencyMs === undefined ? "var(--text-tertiary)" :
    apiLatencyMs < 100 ? "var(--status-success)" :
    apiLatencyMs < 500 ? "var(--status-warning)" : "var(--status-danger)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Enterprise Platform Header */}
      <div style={{
        background: "linear-gradient(135deg, #0A192F 0%, #0F3460 50%, #16213E 100%)",
        borderRadius: "var(--radius-2xl)",
        padding: "2rem 2.25rem",
        color: "#FFFFFF",
        boxShadow: "var(--shadow-xl), 0 0 32px rgba(15, 52, 96, 0.3)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "240px", height: "240px", borderRadius: "50%", background: "radial-gradient(circle, rgba(96, 165, 250, 0.25) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ zIndex: 1, maxWidth: "680px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(147, 197, 253, 0.3)", borderRadius: "var(--radius-full)", padding: "0.25rem 0.75rem", marginBottom: "0.75rem" }}>
            <Globe size={13} style={{ color: "#93C5FD" }} />
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "#BFDBFE", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Enterprise Platform Control
            </span>
          </div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", marginBottom: "0.5rem" }}>
            Multi-Tenant Fleet Telemetry
          </h2>
          <p style={{ color: "#94A3B8", fontSize: "var(--text-sm)", lineHeight: 1.6, margin: 0 }}>
            Unified real-time visibility across all onboarded school campuses, infrastructure reliability, autonomous agent task pipelines, and global governance logs.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", zIndex: 1 }}>
          <button
            onClick={handleRefresh}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", color: "#FFFFFF", padding: "0.625rem 1rem", borderRadius: "var(--radius-lg)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer" }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Sync Telemetry
          </button>
          <Button variant="primary" onClick={() => router.push('/users')} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)" }}>
            <Plus size={16} />
            Onboard New School
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        <DashboardKpiCard
          label="Total Campuses"
          value={fleet?.totalSchools ?? "—"}
          icon={Building2}
          color="#2563EB"
          subText={fleet ? `${fleet.activeSchools} Active • 100% Operational` : "No data yet"}
        />
        <DashboardKpiCard
          label="Platform Users"
          value={fleet ? fleet.totalUsers.toLocaleString() : "—"}
          icon={Users}
          color="#10B981"
          subText={fleet ? `${fleet.totalStudents} Students • ${fleet.totalTeachers} Faculty` : undefined}
        />
        <DashboardKpiCard
          label="Autonomous Agents"
          value={health ? `${health.activeAgents} Online` : "—"}
          icon={Sparkles}
          color="#8B5CF6"
          subText="Attendance, Fees & Anomaly Sentinel"
          trend="up"
          trendLabel="All Active"
        />
        <DashboardKpiCard
          label="System Reliability"
          value={health?.uptime ?? "—"}
          icon={Server}
          color="#06B6D4"
          subText={
            health ? (
              <span>
                API: <span style={{ color: latencyColor, fontWeight: 700 }}>{health.apiLatencyMs}ms</span>
                &nbsp;•&nbsp;<span style={{ color: "var(--status-success)", fontWeight: 600 }}>DB Healthy</span>
              </span>
            ) : "Awaiting data"
          }
        />
      </div>

      {/* Main Grid: Campuses List & Global Audit Log */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
        {/* Onboarded School Campuses */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Onboarded School Campuses</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Active enterprise institutions under management</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => router.push('/users')} style={{ fontSize: "var(--text-xs)" }}>
              Manage All <ArrowRight size={13} style={{ marginLeft: "0.25rem" }} />
            </Button>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {recentSchools.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {recentSchools.map((school: any) => (
                  <div
                    key={school.id}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-app)", border: "1px solid var(--border-default)", transition: "all 0.2s ease" }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{school.name}</span>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "var(--radius-full)", background: school.isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", color: school.isActive ? "var(--status-success)" : "var(--status-danger)" }}>
                          {school.isActive ? "Active" : "Suspended"}
                        </span>
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        Code: <strong>{school.code}</strong> • {school.city || "—"} • {school.boardType || "CBSE"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--brand-primary)" }}>
                        {school._count?.students ?? "—"} Students
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                        Joined {formatDate(school.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2.5rem", textAlign: "center" }}>
                <Database size={32} color="var(--text-tertiary)" style={{ marginBottom: "0.75rem" }} />
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>No schools onboarded yet. Click "Onboard New School" to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Security & Audit Stream */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Global Governance Audit Stream</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Real-time privilege actions across tenants</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "var(--text-xs)", color: "var(--status-success)" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--status-success)", display: "inline-block" }} />
              Live Feed
            </div>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {recentLogs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {recentLogs.map((log: any) => (
                  <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.875rem", borderRadius: "var(--radius-lg)", background: "var(--bg-app)", border: "1px solid var(--border-default)" }}>
                    <div style={{ padding: "0.35rem", borderRadius: "var(--radius-md)", background: log.action === "LOGIN" ? "rgba(16, 185, 129, 0.1)" : "rgba(37, 99, 235, 0.1)", color: log.action === "LOGIN" ? "var(--status-success)" : "var(--brand-primary)", marginTop: "0.15rem" }}>
                      <Activity size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : "System Agent"}
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{formatTimeAgo(log.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: "0.2rem 0 0", wordBreak: "break-word" }}>{log.description}</p>
                      {log.school && (
                        <span style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "0.2rem", display: "inline-block" }}>Campus: {log.school.name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2.5rem", textAlign: "center" }}>
                <ShieldCheck size={32} color="var(--text-tertiary)" style={{ marginBottom: "0.75rem" }} />
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>No audit events recorded yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
