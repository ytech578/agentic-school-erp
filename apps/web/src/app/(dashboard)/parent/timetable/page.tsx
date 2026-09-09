"use client";
import React, { useEffect, useState } from "react";
import { CalendarDays, Download } from "lucide-react";
import { useParentData } from "@/hooks/useParentData";
import { apiClient } from "@/lib/axios";
import { Sk, Card, PageHeader } from "../_ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLORS = ["var(--risk-low)","var(--brand-blue)","var(--risk-medium)","var(--brand-blue)","var(--risk-high)","#0891b2","#d946ef","#65a30d"];

export default function TimetablePage() {
  const { child, loading: parentLoading } = useParentData();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!child?.sectionId) { setLoading(false); return; }
    apiClient.get(`/timetable?sectionId=${child.sectionId}`)
      .then(r => {
        const d = r.data?.data || r.data || [];
        setSlots(Array.isArray(d) ? d : d.slots || []);
      })
      .catch(() => {
        // fall back to data from parent-detail hook
        if (child?.weeklyTimetable) setSlots(child.weeklyTimetable);
      })
      .finally(() => setLoading(false));
  }, [child?.sectionId]);

  const effectiveSlots = slots.length > 0 ? slots : (child?.weeklyTimetable || []);

  // Build grid: periods x days
  const periods: number[] = (Array.from(new Set(effectiveSlots.map((s: any) => Number(s.periodNumber ?? s.period)))) as number[]).sort((a, b) => a - b);

  const subjectColors: Record<string, string> = {};
  let colorIdx = 0;

  const getColor = (subject: string) => {
    if (!subjectColors[subject]) subjectColors[subject] = COLORS[colorIdx++ % COLORS.length];
    return subjectColors[subject];
  };

  const getSlot = (day: number, period: number) =>
    effectiveSlots.find((s: any) => (s.dayOfWeek ?? s.day) === day && (s.periodNumber ?? s.period) === period);

  const todayDay = new Date().getDay(); // 1=Mon, 6=Sat
  const isLoading = parentLoading || loading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <style>{`@keyframes shimmer{0%,100%{background-position:200% 0}50%{background-position:-200% 0}}`}</style>
      <PageHeader title="Class Timetable" subtitle={`Weekly schedule for ${child?.className ?? "your child's class"}`} icon={<CalendarDays size={22} />} />

      {/* Today's Classes */}
      {!isLoading && child?.todayTimetable?.length > 0 && (
        <Card style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem" }}>Today's Classes</h3>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {child.todayTimetable.map((slot: any) => (
              <div key={slot.id} style={{ padding: "0.75rem 1.25rem", background: "var(--risk-low-bg)", borderRadius: "0.75rem", border: "1px solid var(--border-default)" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 600 }}>{slot.startTime} – {slot.endTime}</div>
                <div style={{ fontWeight: 700, color: "var(--risk-low)", marginTop: "0.125rem" }}>{slot.subject}</div>
                {slot.teacher && <div style={{ fontSize: "0.7rem", color: "var(--risk-low)" }}>{slot.teacher}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weekly Grid */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--bg-elevated)" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Class {child?.className ?? ""} — Weekly Timetable</h3>
          <button style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "var(--risk-low)", color: "var(--bg-surface)", border: "none", borderRadius: "0.5rem", padding: "0.4rem 0.875rem", fontSize: "0.813rem", fontWeight: 600, cursor: "pointer" }}>
            <Download size={14} /> Download
          </button>
        </div>
        <div style={{ padding: "1.25rem", overflowX: "auto" }}>
          {isLoading ? <Sk h="300px" /> : effectiveSlots.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>No timetable has been published for your child's class yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.813rem", minWidth: "700px" }}>
              <thead>
                <tr>
                  <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600, background: "var(--bg-surface-hover)", borderRadius: "0.5rem 0 0 0" }}>Time</th>
                  {DAYS.map((d, i) => (
                    <th key={d} style={{ padding: "0.625rem 0.75rem", textAlign: "center", color: todayDay === i + 1 ? "var(--risk-low)" : "var(--text-secondary)", fontWeight: 700, background: todayDay === i + 1 ? "var(--risk-low-bg)" : "var(--bg-surface-hover)", borderBottom: todayDay === i + 1 ? "2px solid var(--risk-low)" : "none" }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.length > 0 ? periods.map(period => {
                  const sample = effectiveSlots.find((s: any) => (s.periodNumber ?? s.period) === period);
                  return (
                    <tr key={period} style={{ borderBottom: "1px solid var(--bg-elevated)" }}>
                      <td style={{ padding: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                        {sample ? `${sample.startTime} – ${sample.endTime}` : `Period ${period}`}
                      </td>
                      {[1,2,3,4,5,6].map(day => {
                        const slot = getSlot(day, period);
                        const color = slot?.subject ? getColor(slot.subject) : "var(--text-tertiary)";
                        return (
                          <td key={day} style={{ padding: "0.5rem", textAlign: "center", background: todayDay === day ? "var(--risk-low-bg)" : "transparent" }}>
                            {slot ? (
                              <div style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: "0.5rem", padding: "0.5rem 0.375rem" }}>
                                <div style={{ fontWeight: 700, color, fontSize: "0.75rem" }}>{slot.subject}</div>
                                {slot.teacher && <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: "0.125rem" }}>{slot.teacher.split(" ").slice(-1)[0]}</div>}
                              </div>
                            ) : (
                              <div style={{ color: "var(--border-strong)", fontSize: "0.75rem" }}>—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>Timetable data is loading…</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
