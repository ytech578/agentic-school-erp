"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  BookOpen, Users, CalendarCheck, Clock, Sparkles, CheckCircle2, 
  ArrowRight, FileText, Check, AlertCircle, Edit3, MessageSquare, 
  Mail, ExternalLink, Award
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { DashboardKpiCard } from "@/components/ui/DashboardKpiCard";
import { formatDate } from "@/lib/formatters";

export function TeacherDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await apiClient.get("/dashboard/teacher");
        setData(res.data?.data || res.data);
      } catch (err) {
        console.error("Failed to fetch teacher dashboard", err);
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

  const classes = data?.classes || [];
  const todaySchedule = data?.todaySchedule || [];
  const pendingAssignments = data?.pendingAssignments || [];
  const totalStudents = data?.totalStudentsTaught ?? null;
  const classesTodayCount = data?.classesTodayCount ?? classes.length;
  const pendingGradingCount = data?.pendingGradingCount ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Teacher Workspace Hero with CoPilot Launcher */}
      <div style={{
        background: "linear-gradient(135deg, #064E3B 0%, #065F46 50%, #047857 100%)",
        borderRadius: "var(--radius-2xl)",
        padding: "2rem 2.25rem",
        color: "#FFFFFF",
        boxShadow: "var(--shadow-xl), 0 0 24px rgba(6, 95, 70, 0.25)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Glow orb decoration */}
        <div style={{
          position: "absolute",
          top: "-40px",
          right: "-40px",
          width: "220px",
          height: "220px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(110, 231, 183, 0.2) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ zIndex: 1, maxWidth: "620px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(16, 185, 129, 0.25)", border: "1px solid rgba(167, 243, 208, 0.3)", borderRadius: "var(--radius-full)", padding: "0.25rem 0.75rem", marginBottom: "0.5rem" }}>
            <Sparkles size={13} style={{ color: "#A7F3D0" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#D1FAE5", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Teacher Workspace & AI CoPilot
            </span>
          </div>
          <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "#FFFFFF", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
            Welcome, {user?.firstName || "Teacher"}
          </h2>
          <p style={{ color: "#D1FAE5", fontSize: "var(--text-sm)", lineHeight: 1.6, margin: 0 }}>
            You have <strong>{classesTodayCount} classes</strong> scheduled today. Use integrated AI CoPilot to prepare lesson plans, draft student remarks, and grade assignments effortlessly.
          </p>
        </div>

        {/* CoPilot Fast Launcher Buttons */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", zIndex: 1 }}>
          <Button
            variant="secondary"
            onClick={() => router.push('/teacher-copilot')}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255, 255, 255, 0.15)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Sparkles size={15} /> Lesson Planner
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push('/teacher-copilot/marks')}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255, 255, 255, 0.15)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Edit3 size={15} /> Bulk Marks Entry
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push('/teacher-copilot/assignments')}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255, 255, 255, 0.15)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              backdropFilter: "blur(8px)",
            }}
          >
            <FileText size={15} /> Assignments Hub
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        <DashboardKpiCard
          label="Periods Today"
          value={`${todaySchedule.length} Periods`}
          icon={Clock}
          color="#10B981"
          subText={`Across ${classes.length} Assigned Classes`}
          onClick={() => router.push('/timetable')}
        />
        <DashboardKpiCard
          label="Students Under Care"
          value={totalStudents ?? "—"}
          icon={Users}
          color="#2563EB"
          trend="up"
          trendLabel="Active Enrolled Students"
          onClick={() => router.push('/students')}
        />
        <DashboardKpiCard
          label="Pending Grading"
          value={`${pendingGradingCount} Submissions`}
          icon={FileText}
          color={pendingGradingCount > 0 ? "#F59E0B" : "#10B981"}
          subText="Awaiting teacher review"
          onClick={() => router.push('/teacher-copilot/assignments')}
        />
        <DashboardKpiCard
          label="Attendance Status"
          value={`${classes.filter((c: any) => c.attendanceMarked).length} / ${classes.length} Marked`}
          icon={CalendarCheck}
          color="#8B5CF6"
          subText="Today's homeroom rolls"
          onClick={() => router.push('/attendance')}
        />
      </div>

      {/* Main Grid: Today's Live Schedule Timeline & Pending Grading Queue */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: "1.5rem" }}>
        {/* Today's Teaching Schedule Timeline */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Today's Teaching Schedule</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Period timeline and room assignments</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => router.push('/timetable')} style={{ fontSize: "var(--text-xs)" }}>
              Full Timetable <ArrowRight size={13} style={{ marginLeft: "0.25rem" }} />
            </Button>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {todaySchedule.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {todaySchedule.map((slot: any, idx: number) => (
                  <div
                    key={slot.id || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.875rem 1rem",
                      borderRadius: "var(--radius-lg)",
                      background: idx === 0 ? "var(--brand-blue-subtle)" : "var(--bg-app)",
                      border: idx === 0 ? "1px solid var(--brand-blue)" : "1px solid var(--border-default)",
                      transition: "all 0.2s ease",
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
                          {slot.className}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                          {slot.subject} • {slot.room}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-primary)" }}>
                          {slot.startTime} - {slot.endTime}
                        </div>
                        {idx === 0 && (
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--brand-primary)", textTransform: "uppercase" }}>
                            Current / Next
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={idx === 0 ? "primary" : "outline"}
                        onClick={() => router.push('/attendance')}
                        style={{ fontSize: "11px", padding: "0.35rem 0.65rem" }}
                      >
                        Roll Call
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                No periods scheduled for today.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Grading Queue */}
        <Card>
          <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle style={{ fontSize: "var(--text-base)" }}>Assignments Grading Queue</CardTitle>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Student submissions awaiting marks & feedback</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => router.push('/teacher-copilot/assignments')} style={{ fontSize: "var(--text-xs)" }}>
              View All <ArrowRight size={13} style={{ marginLeft: "0.25rem" }} />
            </Button>
          </CardHeader>
          <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
            {pendingAssignments.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pendingAssignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
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
                        {assignment.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                        {assignment.className} • {assignment.subject}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "var(--radius-full)",
                        background: "rgba(245, 158, 11, 0.15)",
                        color: "#D97706",
                      }}>
                        {assignment.pendingSubmissions} Submissions
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push('/teacher-copilot/assignments')}
                        style={{ fontSize: "11px", padding: "0.3rem 0.6rem" }}
                      >
                        Grade
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                <CheckCircle2 size={24} color="var(--status-success)" style={{ margin: "0 auto 0.5rem" }} />
                <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>All submissions have been graded.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assigned Classes Quick Roll Call Cards */}
      <Card>
        <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <CardTitle style={{ fontSize: "var(--text-base)" }}>Assigned Academic Classes</CardTitle>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0 }}>Direct attendance roll call and student examination marks entry</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push('/attendance')}>
            Attendance History
          </Button>
        </CardHeader>
        <CardContent style={{ padding: "0 1.25rem 1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {classes.map((c: any) => (
              <div
                key={c.id}
                style={{
                  padding: "1.25rem",
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                        {c.className} — {c.section}
                      </h4>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                        {c.subject} • {c.studentsCount} Students Enrolled
                      </p>
                    </div>
                    {c.attendanceMarked ? (
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "var(--radius-full)", background: "rgba(16, 185, 129, 0.1)", color: "var(--status-success)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Check size={11} /> Marked
                      </span>
                    ) : (
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "var(--radius-full)", background: "rgba(245, 158, 11, 0.15)", color: "#D97706", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Clock size={11} /> Pending
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button
                    size="sm"
                    variant={c.attendanceMarked ? "outline" : "primary"}
                    onClick={() => router.push('/attendance')}
                    style={{ flex: 1, fontSize: "11px" }}
                  >
                    {c.attendanceMarked ? "View Attendance" : "Take Attendance"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => router.push('/exams')}
                    style={{ fontSize: "11px" }}
                  >
                    Enter Marks
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
