"use client";

import React, { useEffect, useState } from "react";
import { 
  CalendarDays, 
  Clock, 
  User, 
  MapPin, 
  BookOpen, 
  Sparkles,
  Calendar,
  Layers
} from "lucide-react";
import { apiClient } from "@/lib/axios";

interface TimetableSlot {
  id: string;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
}

const DAYS = [
  { dayNumber: 1, label: "Monday" },
  { dayNumber: 2, label: "Tuesday" },
  { dayNumber: 3, label: "Wednesday" },
  { dayNumber: 4, label: "Thursday" },
  { dayNumber: 5, label: "Friday" },
  { dayNumber: 6, label: "Saturday" },
];

export default function StudentTimetablePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 1 : d > 6 ? 1 : d;
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get("/dashboard/student");
        setData(res.data?.data || res.data);
      } catch (err) {
        console.error("Failed to load student schedule", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const todaySchedule: TimetableSlot[] = data?.todaySchedule || [];
  const studentInfo = data?.studentInfo;
  const className = studentInfo?.className || "Class 10 - Section A";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1200px" }}>
      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
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
            background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
            padding: "0.85rem",
            borderRadius: "var(--radius-lg)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <CalendarDays size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Class Timetable</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#C7D2FE", fontSize: "0.875rem" }}>
              {className} • Academic Year 2026-27 Schedule
            </p>
          </div>
        </div>

        <div style={{
          background: "rgba(99, 102, 241, 0.2)",
          border: "1px solid rgba(165, 180, 252, 0.4)",
          padding: "0.5rem 1rem",
          borderRadius: "2rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "#E0E7FF",
        }}>
          {DAYS.find((d) => d.dayNumber === selectedDay)?.label} Schedule
        </div>
      </div>

      {/* Day Selector Tabs */}
      <div style={{
        display: "flex",
        gap: "0.5rem",
        overflowX: "auto",
        paddingBottom: "0.25rem",
      }}>
        {DAYS.map((day) => {
          const isSelected = selectedDay === day.dayNumber;
          return (
            <button
              key={day.dayNumber}
              onClick={() => setSelectedDay(day.dayNumber)}
              style={{
                padding: "0.65rem 1.25rem",
                borderRadius: "var(--radius-lg)",
                fontWeight: 700,
                fontSize: "0.875rem",
                cursor: "pointer",
                border: "1px solid",
                borderColor: isSelected ? "var(--teal-500)" : "var(--border-default)",
                background: isSelected ? "var(--teal-500)" : "var(--bg-surface)",
                color: isSelected ? "#FFF" : "var(--text-secondary)",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      {/* Period Schedule Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {todaySchedule.length > 0 ? (
          todaySchedule.map((slot, index) => (
            <div
              key={slot.id || index}
              style={{
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--border-default)",
                padding: "1.25rem 1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                {/* Period Badge */}
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-surface-hover)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "1.125rem",
                  color: "var(--teal-500)",
                }}>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", lineHeight: 1 }}>Period</span>
                  {slot.period}
                </div>

                {/* Subject & Teacher Details */}
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {slot.subject}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.35rem", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <User size={14} />
                      {slot.teacher}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <MapPin size={14} />
                      {slot.room}
                    </span>
                  </div>
                </div>
              </div>

              {/* Time Timing Pill */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "var(--bg-surface-hover)",
                padding: "0.5rem 0.85rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}>
                <Clock size={16} style={{ color: "var(--teal-500)" }} />
                <span>{slot.startTime} – {slot.endTime}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-default)",
            padding: "3.5rem 2rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}>
            <CalendarDays size={48} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.125rem" }}>No Scheduled Classes</h3>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
              There are no classes configured for {DAYS.find((d) => d.dayNumber === selectedDay)?.label}. Enjoy your study break!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
