"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { SuperAdminDashboard } from "./components/SuperAdminDashboard";
import { SchoolAdminDashboard } from "./components/SchoolAdminDashboard";
import { PrincipalDashboard } from "./components/PrincipalDashboard";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { StudentDashboard } from "./components/StudentDashboard";
import { ParentDashboard } from "./components/ParentDashboard";
import { getGreeting } from "@/lib/formatters";
import { Shield, Sparkles, Building2, GraduationCap, Users, Calendar, Clock } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setCurrentDate(now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" }));
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  const role = (user?.role || "").toUpperCase();

  const getRoleBadge = () => {
    switch (role) {
      case "SUPER_ADMIN":
        return { label: "Super Admin", icon: Shield, bg: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" };
      case "SCHOOL_ADMIN":
        return { label: "School Admin", icon: Building2, bg: "rgba(37, 99, 235, 0.15)", color: "var(--brand-primary)", border: "rgba(37, 99, 235, 0.3)" };
      case "PRINCIPAL":
        return { label: "Principal Command", icon: Sparkles, bg: "rgba(99, 102, 241, 0.15)", color: "#4F46E5", border: "rgba(99, 102, 241, 0.3)" };
      case "TEACHER":
        return { label: "Faculty Member", icon: Users, bg: "rgba(16, 185, 129, 0.15)", color: "var(--status-success)", border: "rgba(16, 185, 129, 0.3)" };
      case "STUDENT":
        return { label: "Student Scholar", icon: GraduationCap, bg: "rgba(6, 182, 212, 0.15)", color: "#0891B2", border: "rgba(6, 182, 212, 0.3)" };
      case "PARENT":
        return { label: "Parent Portal", icon: Users, bg: "rgba(245, 158, 11, 0.15)", color: "#D97706", border: "rgba(245, 158, 11, 0.3)" };
      default:
        return { label: "User", icon: Users, bg: "var(--bg-app)", color: "var(--text-secondary)", border: "var(--border-default)" };
    }
  };

  const badge = getRoleBadge();
  const Icon = badge.icon;
  const greeting = getGreeting();

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Universal Breadcrumb / Role Header Bar (for non-parent roles) */}
      {role !== "PARENT" && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h1 style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                {greeting}, {user?.firstName || "User"}
              </h1>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.2rem 0.65rem",
                borderRadius: "var(--radius-full)",
                background: badge.bg,
                color: badge.color,
                border: `1px solid ${badge.border}`,
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}>
                <Icon size={12} />
                {badge.label}
              </span>
            </div>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
              {role === "SUPER_ADMIN" && "Multi-tenant platform infrastructure, tenant fleet management, and governance."}
              {role === "SCHOOL_ADMIN" && "Campus operations, monthly fee collections, staff attendance, and admissions."}
              {role === "PRINCIPAL" && "Academic leadership, teacher substitutions, and student intervention telemetry."}
              {role === "TEACHER" && "Daily periods schedule, automated lesson planning, and homework grading."}
              {role === "STUDENT" && "Personalized schedule, homework deadlines, and academic performance tracking."}
            </p>
          </div>

          {/* Real-time Clock & Date Widget */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            background: "var(--bg-surface)",
            padding: "0.5rem 1rem",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              <Calendar size={13} color="var(--brand-primary)" />
              <span>{currentDate || "Today"}</span>
            </div>
            <div style={{ width: "1px", height: "14px", background: "var(--border-default)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-primary)" }}>
              <Clock size={13} color="var(--brand-primary)" />
              <span>{currentTime || "09:00 AM"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Role-Dedicated Dashboard Routing */}
      {role === "SUPER_ADMIN" ? (
        <SuperAdminDashboard user={user} />
      ) : role === "SCHOOL_ADMIN" ? (
        <SchoolAdminDashboard user={user} />
      ) : role === "PRINCIPAL" ? (
        <PrincipalDashboard user={user} />
      ) : role === "TEACHER" ? (
        <TeacherDashboard user={user} />
      ) : role === "STUDENT" ? (
        <StudentDashboard user={user} />
      ) : role === "PARENT" ? (
        <ParentDashboard user={user} />
      ) : (
        <SchoolAdminDashboard user={user} />
      )}
    </div>
  );
}
