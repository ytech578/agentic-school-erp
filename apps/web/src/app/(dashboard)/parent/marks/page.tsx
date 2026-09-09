"use client";
import React, { useEffect, useState } from "react";
import { BookMarked, Download } from "lucide-react";
import { useParentData } from "@/hooks/useParentData";
import { apiClient } from "@/lib/axios";
import { Sk, Card, CardHeader, Badge, PageHeader } from "../_ui";

export default function MarksPage() {
  const { child, loading: parentLoading } = useParentData();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Assessments");

  useEffect(() => {
    if (!child?.id) return;
    apiClient.get(`/exams/student/${child.id}/results`)
      .then(r => setResults(r.data?.data || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [child?.id]);

  const isLoading = parentLoading || loading;

  // Flatten to individual marks
  const allMarks = results.flatMap((exam: any) =>
    (exam.subjects || exam.marks || []).map((s: any) => ({
      exam: exam.name || exam.examName || "Assessment",
      date: exam.startDate || exam.date || exam.createdAt,
      subject: s.subjectName || s.subject || "—",
      score: Number(s.marksObtained ?? s.score ?? 0),
      max: Number(s.maxMarks ?? s.totalMarks ?? 100),
      grade: s.grade || (Number(s.marksObtained ?? 0) / Number(s.maxMarks ?? 100) >= 0.9 ? "A+" : Number(s.marksObtained ?? 0) / Number(s.maxMarks ?? 100) >= 0.8 ? "A" : "B+"),
    }))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <style>{`@keyframes shimmer{0%,100%{background-position:200% 0}50%{background-position:-200% 0}}`}</style>
      <PageHeader title="Marks & Assessments" subtitle={`Academic results for ${child?.firstName ?? "your child"}`} icon={<BookMarked size={22} />} />

      <Card>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-default)", padding: "0 1.5rem" }}>
          {["Assessments", "Marksheet", "Reports"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "0.875rem 1rem", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", border: "none", background: "none", borderBottom: tab === t ? "2px solid var(--risk-low)" : "2px solid transparent", color: tab === t ? "var(--risk-low)" : "var(--text-secondary)" }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: "1.5rem" }}>
          {tab === "Assessments" && (
            isLoading ? [1,2,3,4].map(i => <Sk key={i} h="3.5rem" style={{ marginBottom:"0.75rem" }} />) :
            allMarks.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: "600px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-surface-hover)", borderBottom: "2px solid var(--border-default)" }}>
                      {["Assessment", "Subject", "Date", "Score", "Out of", "Grade"].map(h => (
                        <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allMarks.map((m, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--bg-elevated)" }}>
                        <td style={{ padding: "0.875rem 1rem", fontWeight: 600, color: "var(--text-primary)" }}>{m.exam}</td>
                        <td style={{ padding: "0.875rem 1rem", color: "var(--text-secondary)" }}>{m.subject}</td>
                        <td style={{ padding: "0.875rem 1rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{m.date ? new Date(m.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</td>
                        <td style={{ padding: "0.875rem 1rem", fontWeight: 700, color: "var(--text-primary)" }}>{m.score}</td>
                        <td style={{ padding: "0.875rem 1rem", color: "var(--text-secondary)" }}>{m.max}</td>
                        <td style={{ padding: "0.875rem 1rem" }}><Badge text={m.grade} color={m.score / m.max >= 0.75 ? "var(--risk-low)" : "var(--risk-medium)"} bg={m.score / m.max >= 0.75 ? "var(--risk-low-bg)" : "var(--risk-medium-bg)"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>No assessment records found yet.</div>
            )
          )}

          {tab === "Marksheet" && (
            isLoading ? <Sk h="300px" /> :
            results.length > 0 ? results.map((exam: any) => (
              <div key={exam.id} style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)" }}>{exam.name || exam.examName}</h3>
                  <button style={{ background: "var(--risk-low)", color: "var(--bg-surface)", border: "none", borderRadius: "0.5rem", padding: "0.4rem 0.875rem", fontSize: "0.813rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Download size={14} /> Download
                  </button>
                </div>
                <div style={{ background: "var(--bg-surface-hover)", borderRadius: "0.75rem", overflow: "hidden", border: "1px solid var(--border-default)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ background: "var(--risk-low)", color: "var(--bg-surface)" }}>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "left" }}>Subject</th>
                        <th style={{ padding: "0.75rem 1rem" }}>Max Marks</th>
                        <th style={{ padding: "0.75rem 1rem" }}>Obtained</th>
                        <th style={{ padding: "0.75rem 1rem" }}>%</th>
                        <th style={{ padding: "0.75rem 1rem" }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(exam.subjects || exam.marks || []).map((s: any, i: number) => {
                        const score = Number(s.marksObtained ?? s.score ?? 0);
                        const max = Number(s.maxMarks ?? s.totalMarks ?? 100);
                        const pct = Math.round((score / max) * 100);
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border-default)", background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-surface-hover)" }}>
                            <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{s.subjectName || s.subject}</td>
                            <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>{max}</td>
                            <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700 }}>{score}</td>
                            <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>{pct}%</td>
                            <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}><Badge text={s.grade || (pct >= 90 ? "A+" : pct >= 80 ? "A" : "B+")} color={pct >= 75 ? "var(--risk-low)" : "var(--risk-medium)"} bg={pct >= 75 ? "var(--risk-low-bg)" : "var(--risk-medium-bg)"} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )) : <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>No marksheets available yet.</div>
          )}

          {tab === "Reports" && (
            <div style={{ textAlign: "center", padding: "3rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
              <h3 style={{ color: "var(--text-primary)", fontWeight: 700 }}>Progress Reports</h3>
              <p style={{ color: "var(--text-secondary)" }}>Formal progress reports are issued at the end of each term. Your next report will be available in November 2026.</p>
              <button style={{ marginTop: "1rem", background: "var(--risk-low)", color: "var(--bg-surface)", border: "none", borderRadius: "0.75rem", padding: "0.75rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>Request Interim Report</button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
