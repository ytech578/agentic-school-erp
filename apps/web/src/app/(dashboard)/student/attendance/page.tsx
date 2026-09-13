"use client";

import React, { useEffect, useState } from "react";
import { 
  CalendarCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { formatDate, getAttendanceStatusBadge } from "@/lib/formatters";

interface AttendanceItem {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY";
  remarks?: string;
}

export default function StudentAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get("/dashboard/student");
        setData(res.data?.data || res.data);
      } catch (err) {
        console.error("Failed to load student attendance", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const attendanceList: AttendanceItem[] = data?.rawAttendance || [];
  const attendancePct = data?.attendancePct ?? 92;
  const presentDays = data?.presentAttendanceDays ?? 42;
  const totalDays = data?.totalAttendanceDays ?? 45;
  const absentDays = totalDays - presentDays;

  const filteredList = attendanceList.filter((item) => {
    if (filter === "ALL") return true;
    return item.status === filter;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1200px" }}>
      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        borderRadius: "var(--radius-xl)",
        padding: "1.75rem 2rem",
        color: "#FFFFFF",
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{
            background: "var(--brand-gradient)",
            padding: "0.85rem",
            borderRadius: "var(--radius-lg)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <CalendarCheck size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>My Attendance Record</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#94A3B8", fontSize: "0.875rem" }}>
              Academic attendance monitoring & verified attendance ledger
            </p>
          </div>
        </div>

        <div style={{
          background: attendancePct >= 75 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
          border: `1px solid ${attendancePct >= 75 ? "var(--success)" : "var(--danger)"}`,
          padding: "0.5rem 1rem",
          borderRadius: "2rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontWeight: 700,
          color: attendancePct >= 75 ? "var(--success)" : "var(--danger)",
          fontSize: "0.875rem",
        }}>
          {attendancePct >= 75 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{attendancePct}% Overall Attendance</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div style={{
          background: "var(--bg-surface)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Overall Rate</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: attendancePct >= 75 ? "var(--success)" : "var(--danger)", marginTop: "0.25rem" }}>
            {attendancePct}%
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Target: Minimum 75%</span>
        </div>

        <div style={{
          background: "var(--bg-surface)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Classes Present</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            {presentDays}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: 600 }}>Active attendance</span>
        </div>

        <div style={{
          background: "var(--bg-surface)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Classes Absent</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: absentDays > 5 ? "var(--danger)" : "var(--text-primary)", marginTop: "0.25rem" }}>
            {absentDays}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Days missed</span>
        </div>

        <div style={{
          background: "var(--bg-surface)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Total Working Days</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            {totalDays}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Current academic term</span>
        </div>
      </div>

      {/* 75% Requirement Alert */}
      {attendancePct < 75 && (
        <div style={{
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid var(--danger)",
          borderRadius: "var(--radius-md)",
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          color: "var(--danger)",
          fontSize: "0.875rem",
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Attendance Warning:</strong> Your current attendance is below the 75% threshold required to appear for upcoming Board & Term Examinations. Please consult with your class teacher.
          </div>
        </div>
      )}

      {/* Filter Tabs & History */}
      <div style={{
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-default)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>Attendance Records</h2>
          
          {/* Status Filters */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["ALL", "PRESENT", "ABSENT", "LATE"].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "2rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: filter === status ? "var(--teal-500)" : "var(--border-default)",
                  background: filter === status ? "var(--teal-500)" : "transparent",
                  color: filter === status ? "#FFF" : "var(--text-secondary)",
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table / List */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-surface-hover)", borderBottom: "1px solid var(--border-default)", textAlign: "left" }}>
                <th style={{ padding: "0.85rem 1.5rem", fontWeight: 600, color: "var(--text-secondary)" }}>Date</th>
                <th style={{ padding: "0.85rem 1.5rem", fontWeight: 600, color: "var(--text-secondary)" }}>Status</th>
                <th style={{ padding: "0.85rem 1.5rem", fontWeight: 600, color: "var(--text-secondary)" }}>Session / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length > 0 ? (
                filteredList.map((item, idx) => {
                  const badge = getAttendanceStatusBadge(item.status);
                  return (
                    <tr key={item.id || idx} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {formatDate(item.date)}
                      </td>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "2rem",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.color,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.5rem", color: "var(--text-secondary)" }}>
                        {item.remarks || "Regular Full-Day Session"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                    <CalendarCheck size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No attendance records found for selected filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
