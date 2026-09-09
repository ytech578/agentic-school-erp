"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  GraduationCap, BookOpen, Clock, CalendarCheck, CheckCircle2, 
  AlertTriangle, DollarSign, Sparkles, ArrowRight, Award, 
  FileText, Check, HelpCircle, Send
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { DashboardKpiCard } from "@/components/ui/DashboardKpiCard";
import { formatCurrencyINR, formatDate, getGradeBadge } from "@/lib/formatters";

export function StudentDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await apiClient.get("/dashboard/student");
        setData(res.data?.data || res.data);
      } catch (err) {
        console.error("Failed to fetch student dashboard", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ height: "140px", background: "var(--bg-surface)", borderRadius: "var(--radius-2xl)", animation: "shimmer 1.5s infinite" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ height: "120px", background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", animation: "shimmer 1.5s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  const studentInfo = data?.studentInfo || {
    name: `${user?.firstName || "Student"} ${user?.lastName || ""}`.trim(),
    className: data?.className || null,
    rollNumber: data?.rollNumber || null,
    admissionNumber: data?.admissionNumber || null,
  };

  const attendancePct = data?.attendancePct ?? null;
  const pendingFees = data?.pendingFees ?? 0;
  const todaySchedule = data?.todaySchedule || [];
  const activeAssignments = data?.activeAssignments || [];
  const recentMarks = data?.recentMarks || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Student Academic Hero Banner */}
      <div style={{
        background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #0284C7 100%)",
        borderRadius: "var(--radius-2xl)",
        padding: "2rem 2.25rem",
        color: "#FFFFFF",
        boxShadow: "var(--shadow-xl), 0 0 24px rgba(37, 99, 235, 0.25)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ambient background decoration */}
        <div style={{
          position: "absolute",
          top: "-30px",
          right: "-30px",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ zIndex: 1, maxWidth: "600px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255, 255, 255, 0.2)", border: "1px solid rgba(255, 255, 255, 0.3)", borderRadius: "var(--radius-full)", padding: "0.25rem 0.75rem", marginBottom: "0.5rem" }}>
            <GraduationCap size={14} style={{ color: "#E0F2FE" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Student Academic Portal
            </span>
          </div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "#FFFFFF", marginBottom: "0.35rem", letterSpacing: "-0.02em" }}>
            {studentInfo.name}
          </h2>
          <p style={{ color: "#BAE6FD", fontSize: "var(--text-sm)", margin: 0 }}>
            {studentInfo.className} • Roll No: <strong>{studentInfo.rollNumber}</strong> • Adm: <strong>{studentInfo.admissionNumber}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", zIndex: 1 }}>
          <Button
            variant="secondary"
            onClick={() => router.push('/settings')}
            style={{ background: "rgba(255, 255, 255, 0.15)", color: "#FFFFFF", border: "1px solid rgba(255, 255, 255, 0.3)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            My Profile
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        <DashboardKpiCard
          label="My Attendance"
          value={attendancePct !== null ? `${attendancePct}%` : "—"}
          icon={CalendarCheck}
          color={attendancePct === null ? "#6B7280" : attendancePct >= 75 ? "#10B981" : "#EF4444"}
          trend={attendancePct !== null && attendancePct >= 75 ? "up" : attendancePct !== null ? "down" : undefined}
          trendLabel={attendancePct !== null ? (attendancePct >= 75 ? "Above 75% Criteria" : "Below Required Threshold") : undefined}
          onClick={() => router.push('/attendance')}
        />
        <DashboardKpiCard
          label="Active Homework"
          value={`${activeAssignments.filter((a: any) => a.status === 'PENDING').length} Pending`}
          icon={FileText}
          color="#2563EB"
          subText={`${activeAssignments.length} Assignments Assigned`}
        />
        <DashboardKpiCard
          label="Fee Balance"
          value={pendingFees > 0 ? formatCurrencyINR(pendingFees) : "All Cleared"}
          icon={DollarSign}
          color={pendingFees > 0 ? "#F59E0B" : "#10B981"}
          subText={pendingFees > 0 ? "Outstanding Dues for Current Term" : "No pending dues"}
        />
        <DashboardKpiCard
          label="Periods Today"
          value={`${todaySchedule.length} Periods`}
          icon={Clock}
          color="#8B5CF6"
          subText="Standard Daily Timetable"
          onClick={() => router.push('/timetable')}
        />
      </div>

      {/* Main Grid: Today's Timetable & Active Homework Radar */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: "1.5rem" }}>
        {/* Today's Timetable Schedule */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Today's Class Schedule</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Periods, teachers, and classroom locations</p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "var(--radius-full)", background: "rgba(37, 99, 235, 0.1)", color: "var(--brand-primary)" }}>
              Live Schedule
            </span>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {todaySchedule.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {todaySchedule.map((slot: any, idx: number) => (
                  <div
                    key={slot.id || idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.875rem 1rem",
                      borderRadius: "var(--radius-lg)",
                      background: idx === 0 ? "var(--brand-blue-subtle)" : "var(--bg-app)",
                      border: idx === 0 ? "1px solid var(--brand-blue)" : "1px solid var(--border-default)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "var(--radius-md)",
                        background: idx === 0 ? "var(--brand-primary)" : "var(--bg-surface)",
                        color: idx === 0 ? "#FFFFFF" : "var(--text-secondary)",
                        border: idx === 0 ? "none" : "1px solid var(--border-default)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "var(--text-xs)",
                      }}>
                        P{slot.period}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                          {slot.subject}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                          {slot.teacher} • {slot.room}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-primary)" }}>
                        {slot.startTime} - {slot.endTime}
                      </div>
                      {idx === 0 && (
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--brand-primary)", textTransform: "uppercase" }}>
                          Next Up
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                No classes scheduled for today.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Homework & Assignments Radar */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Assignments & Homework</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Upcoming deadlines and submission status</p>
            </div>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {activeAssignments.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {activeAssignments.map((a: any) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "0.875rem 1rem",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                        {a.subject} • Due: {formatDate(a.dueDate)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "0.2rem 0.5rem",
                      borderRadius: "var(--radius-full)",
                      background: a.status === 'SUBMITTED' ? "rgba(16, 185, 129, 0.15)" : a.status === 'OVERDUE' ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: a.status === 'SUBMITTED' ? "var(--status-success)" : a.status === 'OVERDUE' ? "var(--status-danger)" : "#D97706",
                    }}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                <CheckCircle2 size={24} color="var(--status-success)" style={{ margin: "0 auto 0.5rem" }} />
                <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>No pending homework assignments.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Marks & Examination Performance */}
      <Card>
        <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <CardTitle style={{ fontSize: "var(--text-base)" }}>Recent Assessment Scores</CardTitle>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Latest graded unit assessments and examinations</p>
          </div>
        </CardHeader>
        <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
          {recentMarks.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              {recentMarks.map((mark: any, idx: number) => {
                const badge = getGradeBadge(mark.score, mark.maxScore);
                return (
                  <div
                    key={mark.id || idx}
                    style={{
                      padding: "1rem",
                      borderRadius: "var(--radius-xl)",
                      background: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                        {mark.examName || "Term Exam"}
                      </div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                        {mark.subject}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{mark.score}</span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>/ {mark.maxScore}</span>
                      </div>
                      <span style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: "var(--radius-full)",
                        fontSize: "11px",
                        fontWeight: 800,
                        background: badge.bg,
                        color: badge.color,
                      }}>
                        {badge.grade}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
              No assessment marks released yet this term.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
