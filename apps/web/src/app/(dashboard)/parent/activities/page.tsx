"use client";
import React, { useState } from "react";
import { Award, Star } from "lucide-react";
import { useParentData } from "@/hooks/useParentData";
import { Sk, Card, PageHeader, fmtDate } from "../_ui";

export default function ActivitiesPage() {
  const { child, loading } = useParentData();
  const [tab, setTab] = useState("Activities");

  const activities = child?.activities || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <style>{`@keyframes shimmer{0%,100%{background-position:200% 0}50%{background-position:-200% 0}}`}</style>
      <PageHeader title="Activities & Achievements" subtitle={`Co-curricular and extracurricular performance for ${child?.firstName ?? "your child"}`} icon={<Award size={22} />} />

      <Card>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-default)", padding: "0 1.5rem" }}>
          {["Activities", "Achievements"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "0.875rem 1rem", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", border: "none", background: "none", borderBottom: tab === t ? "2px solid var(--risk-low)" : "2px solid transparent", color: tab === t ? "var(--risk-low)" : "var(--text-secondary)" }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: "1.5rem" }}>
          {tab === "Activities" && (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎨</div>
              <h3 style={{ color: "var(--text-primary)", fontWeight: 700, margin: "0 0 0.5rem" }}>Extracurricular Activities</h3>
              <p style={{ margin: 0 }}>Enrollment for this term's clubs and activities opens next month.</p>
            </div>
          )}

          {tab === "Achievements" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {loading ? [1,2,3].map(i => <Sk key={i} h="4.5rem" />) : activities.length > 0 ? activities.map((a: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", padding: "1.25rem", background: "var(--risk-medium-bg)", borderRadius: "0.75rem", border: "1px solid var(--risk-medium-bg)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--risk-medium-bg)", color: "var(--risk-medium)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Star size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem", marginBottom: "0.25rem" }}>{a.title}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>{a.event}</div>
                  </div>
                  <div style={{ color: "var(--text-tertiary)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                    {fmtDate(a.date)}
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-tertiary)" }}>No achievements recorded yet.</div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
