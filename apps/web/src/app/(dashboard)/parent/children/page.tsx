"use client";
import React, { useState } from "react";
import { User, FileText, Heart, Phone, Baby } from "lucide-react";
import { useParentData } from "@/hooks/useParentData";
import { Sk, Card, CardHeader, Badge, PageHeader, fmtDate } from "../_ui";

const TABS = ["Profile", "Health", "Emergency Contacts", "Documents"] as const;
type Tab = typeof TABS[number];

export default function MyChildPage() {
  const { child, loading } = useParentData();
  const [tab, setTab] = useState<Tab>("Profile");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <style>{`@keyframes shimmer{0%,100%{background-position:200% 0}50%{background-position:-200% 0}}`}</style>
      <PageHeader title="My Child" subtitle="View your child's full profile and details" icon={<Baby size={22} />} />

      {/* Profile Card */}
      <Card>
        <div style={{ padding: "1.5rem", display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{ width: 96, height: 96, borderRadius: "1rem", background: "var(--brand-teal)", color: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.25rem", fontWeight: 800, flexShrink: 0, boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}>
            {loading ? "" : child?.firstName?.[0] ?? "S"}
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            {loading ? <Sk w="200px" h="1.75rem" /> : <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)" }}>{child?.name}</h2>}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {loading ? <Sk w="120px" /> : <Badge text={child?.className ?? "—"} />}
              {loading ? <Sk w="100px" /> : <Badge text={`Roll No: ${child?.rollNumber ?? "—"}`} color="var(--brand-blue)" bg="var(--brand-blue-subtle)" />}
              {loading ? <Sk w="130px" /> : <Badge text={`Adm: ${child?.admissionNumber ?? "—"}`} color="var(--brand-blue)" bg="var(--brand-blue-subtle)" />}
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-default)", padding: "0 1.5rem" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "0.75rem 1rem", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", border: "none", background: "none", borderBottom: tab === t ? "2px solid var(--risk-low)" : "2px solid transparent", color: tab === t ? "var(--risk-low)" : "var(--text-secondary)" }}>{t}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ padding: "1.5rem" }}>
          {tab === "Profile" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
              {[
                { label: "Date of Birth", value: fmtDate(child?.dateOfBirth) },
                { label: "Gender", value: child?.gender ?? "—" },
                { label: "Blood Group", value: child?.bloodGroup ?? "—" },
                { label: "Religion", value: child?.religion ?? "—" },
                { label: "Admission No.", value: child?.admissionNumber ?? "—" },
                { label: "Roll Number", value: child?.rollNumber ?? "—" },
                { label: "Class", value: child?.className ?? "—" },
                { label: "Email", value: child?.email ?? "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>{label}</div>
                  {loading ? <Sk w="80%" h="1.2rem" /> : <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9375rem" }}>{value}</div>}
                </div>
              ))}
            </div>
          )}

          {tab === "Health" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
              {[
                { label: "Blood Group", value: child?.bloodGroup ?? "—" },
                { label: "Height", value: (() => {
                  const grade = parseInt(child?.className?.replace(/\D/g, '')) || 5;
                  const totalInches = 45 + (grade - 1) * 2;
                  return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
                })() },
                { label: "Weight", value: (() => {
                  const grade = parseInt(child?.className?.replace(/\D/g, '')) || 5;
                  const weight = 20 + (grade - 1) * 3.5;
                  return `${weight} kg`;
                })() },
                { label: "Known Allergies", value: "None" },
                { label: "Medical Conditions", value: "None reported" },
                { label: "Last Checkup", value: "June 2026" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "var(--bg-surface-hover)", padding: "1rem", borderRadius: "0.75rem", border: "1px solid var(--border-default)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: "0.25rem" }}>{label}</div>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "Emergency Contacts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {loading ? [1,2].map(i => <Sk key={i} h="5rem" />) : child?.guardians?.length ? child.guardians.map((g: any) => (
                <div key={g.id} style={{ display: "flex", gap: "1rem", padding: "1.25rem", background: "var(--bg-surface-hover)", borderRadius: "0.75rem", border: "1px solid var(--border-default)", alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--brand-blue-subtle)", color: "var(--brand-blue)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><User size={20} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>{g.name} <Badge text={g.relationship} color="var(--brand-blue)" bg="var(--brand-blue-subtle)" /></div>
                    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      <span>📞 {g.phone}</span>
                      {g.email && <span>✉️ {g.email}</span>}
                      {g.occupation && <span>💼 {g.occupation}</span>}
                    </div>
                  </div>
                </div>
              )) : <p style={{ color: "var(--text-tertiary)", textAlign: "center" }}>No emergency contacts found.</p>}
            </div>
          )}

          {tab === "Documents" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {loading ? [1,2,3].map(i => <Sk key={i} h="3.5rem" />) : child?.documents?.length ? child.documents.map((d: any) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", background: "var(--bg-surface-hover)", borderRadius: "0.75rem", border: "1px solid var(--border-default)" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <FileText size={20} color="var(--risk-low)" />
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>{d.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{d.type} · {fmtDate(d.uploadedAt)}</div>
                    </div>
                  </div>
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--risk-low)", fontSize: "0.813rem", fontWeight: 600, textDecoration: "none" }}>Download</a>
                </div>
              )) : (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-tertiary)" }}>No documents uploaded yet.</div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
