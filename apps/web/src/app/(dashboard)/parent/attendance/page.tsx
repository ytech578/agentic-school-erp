"use client";
import React, { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { useParentData } from "@/hooks/useParentData";
import { Sk, Card, CardHeader, Badge, PageHeader, statusColor } from "../_ui";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AttendancePage() {
  const { child, loading } = useParentData();
  const [view, setView] = useState("Overview");
  const att = child?.attendance;

  const overall = att?.overall ?? 0;
  const totalDays = att?.totalDays ?? 0;
  const presentDays = att?.presentDays ?? 0;
  const absentDays = att?.absentDays ?? 0;
  const lateDays = att?.lateDays ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <style>{`@keyframes shimmer{0%,100%{background-position:200% 0}50%{background-position:-200% 0}}`}</style>
      <PageHeader title="Attendance" subtitle={`Attendance record for ${child?.firstName ?? "your child"}`} icon={<CalendarCheck size={22} />} />

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        {[
          { label: "Overall Attendance", value: `${overall}%`, badge: overall >= 85 ? "Excellent" : "Needs Attention", bc: overall >= 85 ? "var(--risk-low)":"var(--risk-medium)", bb: overall >= 85 ? "var(--risk-low-bg)":"var(--risk-medium-bg)" },
          { label: "Present Days", value: `${presentDays}`, badge: "", bc: "var(--risk-low)", bb: "var(--risk-low-bg)" },
          { label: "Absent Days", value: `${absentDays}`, badge: "", bc: "var(--risk-high)", bb: "var(--risk-high-bg)" },
          { label: "Late Days", value: `${lateDays}`, badge: "", bc: "var(--risk-medium)", bb: "var(--risk-medium-bg)" },
        ].map(k => (
          <Card key={k.label} style={{ padding: "1.25rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.5rem" }}>{k.label}</div>
            {loading ? <Sk w="60%" h="2.25rem" /> : <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>{k.value}</div>}
            {k.badge && <div style={{ display: "inline-block", marginTop: "0.5rem", background: k.bb, color: k.bc, padding: "0.15rem 0.5rem", borderRadius: "2rem", fontSize: "0.7rem", fontWeight: 700 }}>{k.badge}</div>}
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Card>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-default)", padding: "0 1.5rem" }}>
          {["Overview","Daily","Monthly","Yearly"].map(t => (
            <button key={t} onClick={() => setView(t)} style={{ padding: "0.875rem 1rem", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", border: "none", background: "none", borderBottom: view === t ? "2px solid var(--risk-low)":"2px solid transparent", color: view === t ? "var(--risk-low)":"var(--text-secondary)" }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: "1.5rem" }}>
          {view === "Overview" && (
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", alignItems: "center" }}>
              {/* Donut */}
              <div style={{ position: "relative", width: 160, height: 160 }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--risk-low)" strokeWidth="3"
                    strokeDasharray={`${overall} ${100 - overall}`} strokeLinecap="round" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  {loading ? <Sk w="50px" h="1.5rem" /> : <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)" }}>{overall}%</span>}
                  <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 600 }}>Present</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[{label:"Present",val:presentDays,c:"var(--risk-low)",bg:"var(--risk-low-bg)"},{label:"Absent",val:absentDays,c:"var(--risk-high)",bg:"var(--risk-high-bg)"},{label:"Late",val:lateDays,c:"var(--risk-medium)",bg:"var(--risk-medium-bg)"},{label:"Total Working Days",val:totalDays,c:"var(--text-secondary)",bg:"var(--bg-surface-hover)"}].map(r=>(
                  <div key={r.label} style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:r.c,flexShrink:0}}/>
                    <span style={{fontSize:"0.875rem",color:"var(--text-secondary)",minWidth:160}}>{r.label}</span>
                    {loading?<Sk w="30px"/>:<strong style={{color:r.c}}>{r.val}</strong>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "Daily" && (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {loading ? Array(30).fill(0).map((_,i) => <Sk key={i} w="2rem" h="2rem" r="0.375rem"/>) :
                  (att?.recent || []).map((a: any, i: number) => {
                    const { color, bg } = statusColor(a.status);
                    return (
                      <div key={i} title={`${new Date(a.date).toLocaleDateString("en-IN")} – ${a.status}`} style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.375rem", background: bg, border: `1px solid ${color}20`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color }}>{a.status[0]}</span>
                      </div>
                    );
                  })}
              </div>
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontSize: "0.75rem" }}>
                {[{l:"P = Present",c:"var(--risk-low)"},{l:"A = Absent",c:"var(--risk-high)"},{l:"L = Late",c:"var(--risk-medium)"}].map(x=>(
                  <span key={x.l} style={{display:"flex",alignItems:"center",gap:"0.25rem"}}><span style={{width:8,height:8,borderRadius:2,background:x.c,display:"inline-block"}}/>{x.l}</span>
                ))}
              </div>
            </div>
          )}

          {view === "Monthly" && (
            <div>
              {loading ? <Sk h="200px" /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {(att?.byMonth || []).map((m: any) => {
                    const pct = m.total > 0 ? Math.round(((m.present + m.late) / m.total) * 100) : 0;
                    return (
                      <div key={m.month} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span style={{ minWidth: 60, fontSize: "0.813rem", color: "var(--text-secondary)", fontWeight: 600 }}>{m.month}</span>
                        <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: "2rem", height: 12, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 85 ? "var(--risk-low)" : pct >= 70 ? "#f59e0b" : "var(--risk-high)", borderRadius: "2rem", transition: "width 1s" }} />
                        </div>
                        <span style={{ minWidth: 40, textAlign: "right", fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)" }}>{pct}%</span>
                        <Badge text={`${m.present + m.late}/${m.total}`} color="var(--text-secondary)" bg="var(--bg-surface-hover)" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {view === "Yearly" && (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-tertiary)" }}>
              Yearly attendance report will be available at the end of the academic year.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
