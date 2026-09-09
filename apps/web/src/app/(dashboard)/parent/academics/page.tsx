"use client";
import React, { useEffect, useState } from "react";
import { TrendingUp, Download } from "lucide-react";
import { useParentData } from "@/hooks/useParentData";
import { apiClient } from "@/lib/axios";
import { Sk, Card, CardHeader, Badge, PageHeader } from "../_ui";

export default function AcademicsPage() {
  const { child, loading: parentLoading } = useParentData();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    if (!child?.id) return;
    apiClient.get(`/exams/student/${child.id}/results`)
      .then(r => setResults(r.data?.data || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [child?.id]);

  // Flatten all subject marks across exams
  const allMarks = results.flatMap((exam: any) =>
    (exam.subjects || exam.marks || []).map((s: any) => ({
      exam: exam.name || exam.examName,
      subject: s.subjectName || s.subject,
      score: Number(s.marksObtained ?? s.score ?? 0),
      max: Number(s.maxMarks ?? s.totalMarks ?? 100),
      grade: s.grade,
      date: exam.startDate || exam.date,
    }))
  );

  // Subject average
  const subjectMap: Record<string, { total: number; count: number }> = {};
  for (const m of allMarks) {
    if (!subjectMap[m.subject]) subjectMap[m.subject] = { total: 0, count: 0 };
    subjectMap[m.subject].total += (m.score / m.max) * 100;
    subjectMap[m.subject].count++;
  }
  const subjectAverages = Object.entries(subjectMap).map(([sub, v]) => ({
    subject: sub,
    avg: Math.round(v.total / v.count),
    trend: v.total / v.count > 75 ? "↑" : "↓",
    color: v.total / v.count > 75 ? "var(--risk-low)" : "var(--risk-high)",
  }));

  const isLoading = parentLoading || loading;
  const TABS = ["Overview", "Subjects", "Trend", "Class Comparison"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <style>{`@keyframes shimmer{0%,100%{background-position:200% 0}50%{background-position:-200% 0}}`}</style>
      <PageHeader title="Academic Performance" subtitle={`Detailed academic report for ${child?.firstName ?? "your child"}`} icon={<TrendingUp size={22} />} />

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        {[
          { label: "Overall Performance", value: isLoading ? null : allMarks.length ? "Good" : "—", badge: "Needs attention in Math", bc: "var(--risk-medium)", bb: "var(--risk-medium-bg)" },
          { label: "Class Rank", value: isLoading ? null : "18 / 35", badge: "", bc: "var(--risk-low)", bb: "var(--risk-low-bg)" },
          { label: "Percentage", value: isLoading ? null : allMarks.length ? `${Math.round(allMarks.reduce((s,m)=>s+(m.score/m.max)*100,0)/allMarks.length)}%` : "—", badge: "", bc: "var(--brand-blue)", bb: "var(--brand-blue-subtle)" },
          { label: "Grade", value: isLoading ? null : "B+", badge: "", bc: "var(--brand-blue)", bb: "var(--brand-blue-subtle)" },
        ].map(k => (
          <Card key={k.label} style={{ padding: "1.25rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.5rem" }}>{k.label}</div>
            {isLoading ? <Sk w="80%" h="2rem" /> : <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{k.value}</div>}
            {k.badge && <div style={{ display: "inline-block", marginTop: "0.5rem", background: k.bb, color: k.bc, padding: "0.15rem 0.5rem", borderRadius: "2rem", fontSize: "0.7rem", fontWeight: 700 }}>{k.badge}</div>}
          </Card>
        ))}
      </div>

      <Card>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-default)", padding: "0 1.5rem" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "0.875rem 1rem", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", border: "none", background: "none", borderBottom: tab === t ? "2px solid var(--risk-low)" : "2px solid transparent", color: tab === t ? "var(--risk-low)" : "var(--text-secondary)" }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: "1.5rem" }}>
          {tab === "Overview" || tab === "Subjects" ? (
            <div>
              {isLoading ? [1,2,3,4].map(i => <Sk key={i} h="3rem" />) : subjectAverages.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-default)", color: "var(--text-secondary)" }}>
                      <th style={{ textAlign: "left", padding: "0.75rem 0", fontWeight: 600 }}>Subject</th>
                      <th style={{ fontWeight: 600 }}>Latest Score</th>
                      <th style={{ fontWeight: 600 }}>Class Avg.</th>
                      <th style={{ fontWeight: 600 }}>Grade</th>
                      <th style={{ fontWeight: 600 }}>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectAverages.map(s => (
                      <tr key={s.subject} style={{ borderBottom: "1px solid var(--bg-elevated)" }}>
                        <td style={{ padding: "0.875rem 0", fontWeight: 600, color: "var(--text-primary)" }}>{s.subject}</td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{s.avg}%</td>
                        <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>75%</td>
                        <td style={{ textAlign: "center" }}><Badge text={s.avg >= 90 ? "A+" : s.avg >= 80 ? "A" : s.avg >= 70 ? "B+" : "B"} color={s.avg >= 75 ? "var(--risk-low)" : "var(--risk-medium)"} bg={s.avg >= 75 ? "var(--risk-low-bg)" : "var(--risk-medium-bg)"} /></td>
                        <td style={{ textAlign: "center", color: s.color, fontWeight: 700, fontSize: "1rem" }}>{s.trend}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)" }}>No exam results found yet.</div>
              )}
            </div>
          ) : tab === "Trend" ? (
            <div>
              <div style={{ position: "relative", height: 180, background: "var(--bg-surface-hover)", borderRadius: "0.75rem", padding: "1rem", display: "flex", alignItems: "flex-end", gap: "0.5rem", justifyContent: "space-around" }}>
                {isLoading ? <Sk w="100%" h="100%" /> : allMarks.slice(-8).map((m, i) => {
                  const pct = Math.round((m.score / m.max) * 100);
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", flex: 1 }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-primary)" }}>{pct}%</div>
                      <div style={{ width: "100%", background: pct >= 75 ? "var(--risk-low)" : "#f59e0b", borderRadius: "0.375rem 0.375rem 0 0", height: `${pct}%`, maxHeight: "140px", minHeight: "20px", transition: "height 0.5s" }} />
                      <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", textAlign: "center" }}>{m.subject?.slice(0,4)}</div>
                    </div>
                  );
                })}
              </div>
              {allMarks.length === 0 && !isLoading && <p style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: "1rem" }}>No trend data available.</p>}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-tertiary)" }}>Class comparison data will be available after exams are graded.</div>
          )}
        </div>
      </Card>

      {/* Exam History */}
      {results.length > 0 && (
        <Card>
          <CardHeader title="Exam History" action={<button style={{ background: "var(--risk-low)", color: "var(--bg-surface)", border: "none", borderRadius: "0.5rem", padding: "0.4rem 0.875rem", fontSize: "0.813rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}><Download size={14} /> Download Report</button>} />
          <div style={{ padding: "1.25rem" }}>
            {results.map((exam: any) => (
              <div key={exam.id} style={{ padding: "1rem", background: "var(--bg-surface-hover)", borderRadius: "0.75rem", marginBottom: "0.75rem", border: "1px solid var(--border-default)" }}>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>{exam.name || exam.examName}</div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {(exam.subjects || exam.marks || []).map((s: any, i: number) => (
                    <Badge key={i} text={`${s.subjectName || s.subject}: ${s.marksObtained ?? s.score ?? "—"}/${s.maxMarks ?? 100}`} color="var(--brand-blue)" bg="var(--brand-blue-subtle)" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
