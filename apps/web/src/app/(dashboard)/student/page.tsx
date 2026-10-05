"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  BarChart3,
  Clock,
  Award,
  TrendingUp,
  CalendarDays,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  BookMarked,
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/auth.store";
import Link from "next/link";

interface StudentSummary {
  attendancePercentage: number;
  pendingAssignments: number;
  averageGrade: string | number;
  nextExam?: { name: string; date: string; subject?: string } | null;
  recentMarks?: { subject: string; marks: number; maxMarks: number }[];
}

const quickLinks = [
  {
    label: "My Timetable",
    href: "/student/timetable",
    icon: CalendarDays,
    color: "var(--accent-primary)",
    bg: "rgba(99,102,241,0.10)",
    description: "View your class schedule",
  },
  {
    label: "Assignments",
    href: "/student/assignments",
    icon: ClipboardList,
    color: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    description: "Pending & submitted work",
  },
  {
    label: "My Marks",
    href: "/student/marks",
    icon: BarChart3,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    description: "Exam results & grades",
  },
  {
    label: "Attendance",
    href: "/student/attendance",
    icon: Clock,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    description: "Attendance history",
  },
];

export default function StudentPortalPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const [attRes, assignRes, marksRes] = await Promise.allSettled([
          apiClient.get("/attendance/my-summary"),
          apiClient.get("/assignments/my?limit=5"),
          apiClient.get("/exams/my-marks?limit=5"),
        ]);

        const attendance =
          attRes.status === "fulfilled" ? attRes.value.data?.data : null;
        const assignments =
          assignRes.status === "fulfilled" ? assignRes.value.data?.data : null;
        const marks =
          marksRes.status === "fulfilled" ? marksRes.value.data?.data : null;

        const pending = Array.isArray(assignments)
          ? assignments.filter((a: any) => a.status === "PENDING").length
          : 0;

        const recentMarksArr = Array.isArray(marks)
          ? marks.slice(0, 3).map((m: any) => ({
              subject: m.subject || m.examSubject?.subject?.name || "—",
              marks: m.marksObtained ?? 0,
              maxMarks: m.maxMarks ?? 100,
            }))
          : [];

        setSummary({
          attendancePercentage: attendance?.attendancePercentage ?? 0,
          pendingAssignments: pending,
          averageGrade: attendance?.averageGrade ?? "—",
          recentMarks: recentMarksArr,
        });
      } catch {
        // Non-critical — dashboard still renders
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  const firstName = user?.firstName ?? "Student";
  const attendance = summary?.attendancePercentage ?? 0;
  const attendanceColor =
    attendance >= 75 ? "#10b981" : attendance >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="page-container" style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ── Welcome Banner ── */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, var(--accent-primary) 0%, #7c3aed 100%)",
          color: "#fff",
          marginBottom: 28,
          padding: "32px 36px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <Sparkles size={28} />
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
            Welcome back, {firstName}!
          </h1>
        </div>
        <p style={{ opacity: 0.88, margin: 0, fontSize: 15 }}>
          Here's a quick overview of your academic activity today.
        </p>
      </div>

      {/* ── Stats Row ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {/* Attendance */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(239,68,68,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={20} color="#ef4444" />
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Attendance</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: attendanceColor }}>
            {loading ? "—" : `${attendance.toFixed(1)}%`}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            {attendance >= 75
              ? "✅ On track"
              : attendance >= 60
              ? "⚠️ Below recommended"
              : "❌ Critical — contact admin"}
          </div>
        </div>

        {/* Pending Assignments */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(16,185,129,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ClipboardList size={20} color="#10b981" />
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Pending Work</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            {loading ? "—" : summary?.pendingAssignments ?? 0}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            assignments due soon
          </div>
        </div>

        {/* Academic Performance */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(245,158,11,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Award size={20} color="#f59e0b" />
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Avg. Performance</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            {loading ? "—" : summary?.averageGrade ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            based on recent exams
          </div>
        </div>
      </div>

      {/* ── Quick Nav ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, color: "var(--text-primary)" }}>
          Quick Access
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "none";
                  (e.currentTarget as HTMLElement).style.boxShadow = "";
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: link.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <link.icon size={22} color={link.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                    {link.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {link.description}
                  </div>
                </div>
                <ArrowRight size={16} color="var(--text-secondary)" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent Marks ── */}
      {summary?.recentMarks && summary.recentMarks.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
              Recent Results
            </h2>
            <Link href="/student/marks" style={{ fontSize: 13, color: "var(--accent-primary)", textDecoration: "none" }}>
              View all →
            </Link>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {summary.recentMarks.map((m, i) => {
              const pct = m.maxMarks > 0 ? (m.marks / m.maxMarks) * 100 : 0;
              const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 20px",
                    borderBottom: i < (summary.recentMarks?.length ?? 0) - 1 ? "1px solid var(--border-primary)" : "none",
                  }}
                >
                  <BookMarked size={18} color={color} />
                  <div style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{m.subject}</div>
                  <div style={{ fontWeight: 700, color, fontSize: 15 }}>
                    {m.marks}/{m.maxMarks}
                  </div>
                  <div
                    style={{
                      background: `${color}20`,
                      color,
                      borderRadius: 6,
                      padding: "2px 8px",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {pct.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
