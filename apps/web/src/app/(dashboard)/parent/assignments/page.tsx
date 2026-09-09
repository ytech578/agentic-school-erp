"use client";
import React, { useState } from "react";
import { ClipboardList, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useParentData } from "@/hooks/useParentData";
import { Sk, Card, CardHeader, Badge, PageHeader, fmtDate } from "../_ui";

// Assignments are now fetched from child.assignments

const statusIcon: Record<string, any> = {
  "Submitted": CheckCircle,
  "Due Tomorrow": Clock,
  "Due Yesterday": AlertTriangle,
  "Missing": AlertTriangle,
};

export default function AssignmentsPage() {
  const { child, loading } = useParentData();
  const [tab, setTab] = useState("This Week");

  const assignments = child?.assignments || [];
  const pending = assignments.filter((a: any) => a.status !== "Submitted");
  const completed = assignments.filter((a: any) => a.status === "Submitted");

  const displayed = tab === "This Week" ? assignments : tab === "Pending" ? pending : completed;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <style>{`@keyframes shimmer{0%,100%{background-position:200% 0}50%{background-position:-200% 0}}`}</style>
      <PageHeader title="Assignments & Homework" subtitle={`Track ${child?.firstName ?? "your child"}'s assignments and homework`} icon={<ClipboardList size={22} />} />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        {[
          { label: "Total Assignments", value: assignments.length, color: "var(--brand-blue)", bg: "var(--brand-blue-subtle)" },
          { label: "Submitted", value: completed.length, color: "var(--risk-low)", bg: "var(--risk-low-bg)" },
          { label: "Pending", value: pending.length, color: "var(--risk-medium)", bg: "var(--risk-medium-bg)" },
          { label: "Missing", value: assignments.filter((a: any) => a.status === "Missing").length, color: "var(--risk-high)", bg: "var(--risk-high-bg)" },
        ].map(k => (
          <Card key={k.label} style={{ padding: "1.25rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginTop: "0.25rem" }}>{k.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-default)", padding: "0 1.5rem" }}>
          {[`This Week (${assignments.length})`, `Pending (${pending.length})`, `Completed (${completed.length})`].map((t, i) => {
            const key = ["This Week", "Pending", "Completed"][i];
            return (
              <button key={key} onClick={() => setTab(key)} style={{ padding: "0.875rem 1rem", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", border: "none", background: "none", borderBottom: tab === key ? "2px solid var(--risk-low)" : "2px solid transparent", color: tab === key ? "var(--risk-low)" : "var(--text-secondary)" }}>{t}</button>
            );
          })}
        </div>

        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {loading ? [1,2,3].map(i => <Sk key={i} h="4.5rem" />) : displayed.map((a: any) => {
            const Icon = statusIcon[a.status] || Clock;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem", background: "var(--bg-surface-hover)", borderRadius: "0.75rem", border: "1px solid var(--border-default)", borderLeft: `4px solid ${a.statusColor}` }}>
                <div style={{ width: 40, height: 40, borderRadius: "0.5rem", background: a.statusBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={20} color={a.statusColor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.9375rem" }}>{a.subject}</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", flexShrink: 0 }}>
                  <Badge text={a.status} color={a.statusColor} bg={a.statusBg} />
                  <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>Due: {fmtDate(a.dueDate)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
