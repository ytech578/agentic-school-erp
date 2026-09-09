"use client";
import React, { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useParentData } from "@/hooks/useParentData";
import { Card, PageHeader, Badge } from "../_ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { child } = useParentData();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar logic
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const handlePrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Aggregate events (exams + hardcoded for demo)
  const events: any[] = [];
  child?.upcomingExams?.forEach((e: any) => {
    e.subjects?.forEach((s: any) => {
      if (s.date) events.push({ date: new Date(s.date).getDate(), m: new Date(s.date).getMonth(), title: `${s.subject} Exam`, type: "Exam", color: "var(--brand-blue)", bg: "var(--brand-blue-subtle)" });
    });
  });
  
  // Add some dummy events for the current month just to show UI capability
  if (events.length === 0) {
    events.push({ date: 8, m: month, title: "Math Test", type: "Exam", color: "var(--brand-blue)", bg: "var(--brand-blue-subtle)" });
    events.push({ date: 14, m: month, title: "PTM", type: "Meeting", color: "var(--risk-low)", bg: "var(--risk-low-bg)" });
    events.push({ date: 22, m: month, title: "Science Expo", type: "Event", color: "var(--brand-blue)", bg: "var(--brand-blue-subtle)" });
    events.push({ date: 25, m: month, title: "Holiday", type: "Holiday", color: "var(--risk-high)", bg: "var(--risk-high-bg)" });
  }

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ day: prevMonthDays - firstDayOfMonth + i + 1, isCurrent: false });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, isCurrent: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - firstDayOfMonth - daysInMonth + 1, isCurrent: false });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader title="Calendar" subtitle="Events, exams, and holidays" icon={<CalendarIcon size={22} />} />

      <Card>
        {/* Header Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem", borderBottom: "1px solid var(--bg-elevated)", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", width: "160px" }}>
              {currentDate.toLocaleString("default", { month: "long" })} {year}
            </h2>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button onClick={handlePrev} style={{ padding: "0.5rem", background: "var(--bg-surface-hover)", border: "1px solid var(--border-default)", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center" }}><ChevronLeft size={16} /></button>
              <button onClick={handleToday} style={{ padding: "0.5rem 1rem", background: "var(--bg-surface-hover)", border: "1px solid var(--border-default)", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600, fontSize: "0.813rem", color: "var(--text-secondary)" }}>Today</button>
              <button onClick={handleNext} style={{ padding: "0.5rem", background: "var(--bg-surface-hover)", border: "1px solid var(--border-default)", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center" }}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: "0.5rem", padding: "0.25rem" }}>
            {["Month", "Week", "List"].map((v, i) => (
              <button key={v} style={{ padding: "0.4rem 1rem", background: i === 0 ? "var(--bg-surface)" : "transparent", border: "none", borderRadius: "0.375rem", fontSize: "0.813rem", fontWeight: i === 0 ? 700 : 600, color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,0.05)" : "none", cursor: "pointer" }}>{v}</button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "1.5rem", padding: "1rem 1.5rem", background: "var(--bg-surface-hover)", borderBottom: "1px solid var(--bg-elevated)", fontSize: "0.75rem", fontWeight: 600, flexWrap: "wrap" }}>
          {[
            { l: "Exams", c: "var(--brand-blue)" }, { l: "Events", c: "var(--brand-blue)" },
            { l: "Meetings", c: "var(--risk-low)" }, { l: "Holidays", c: "var(--risk-high)" }, { l: "Assignments", c: "var(--risk-medium)" }
          ].map(x => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "#4b5563" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: x.c }} /> {x.l}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ padding: "1.5rem", overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", borderTop: "1px solid var(--border-default)", borderLeft: "1px solid var(--border-default)", minWidth: "800px" }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600, color: i === 0 ? "var(--risk-high)" : "#4b5563", fontSize: "0.875rem", borderBottom: "1px solid var(--border-default)", borderRight: "1px solid var(--border-default)", background: "var(--bg-surface-hover)" }}>{d}</div>
            ))}
            {cells.map((c, i) => {
              const dayEvents = c.isCurrent ? events.filter(e => e.date === c.day && e.m === month) : [];
              const isToday = c.isCurrent && c.day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              return (
                <div key={i} style={{ minHeight: "120px", padding: "0.5rem", borderBottom: "1px solid var(--border-default)", borderRight: "1px solid var(--border-default)", background: c.isCurrent ? "var(--bg-surface)" : "var(--bg-surface-hover)", display: "flex", flexDirection: "column" }}>
                  <div style={{ textAlign: "right", marginBottom: "0.5rem" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "50%", background: isToday ? "var(--risk-low)" : "transparent", color: isToday ? "var(--bg-surface)" : c.isCurrent ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: isToday ? 700 : 500, fontSize: "0.875rem" }}>{c.day}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
                    {dayEvents.map((e, j) => (
                      <div key={j} style={{ padding: "0.25rem 0.5rem", background: e.bg, color: e.color, fontSize: "0.7rem", fontWeight: 700, borderRadius: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={e.title}>
                        {e.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
