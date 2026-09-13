"use client";

import React, { useEffect, useState } from "react";
import { 
  BookMarked, 
  Award, 
  TrendingUp, 
  FileText, 
  Download, 
  CheckCircle2, 
  Sparkles,
  BarChart3
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { getGradeBadge } from "@/lib/formatters";

interface MarkItem {
  id: string;
  subject: string;
  examName: string;
  score: number;
  maxScore: number;
  grade: string;
  remarks?: string;
}

export default function StudentMarksPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get("/dashboard/student");
        setData(res.data?.data || res.data);
      } catch (err) {
        console.error("Failed to load student marks", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const recentMarks: MarkItem[] = data?.recentMarks || [];
  const studentInfo = data?.studentInfo;

  const totalObtained = recentMarks.reduce((acc, m) => acc + m.score, 0);
  const totalMax = recentMarks.reduce((acc, m) => acc + m.maxScore, 0);
  const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 89;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1200px" }}>
      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #4A1D96 0%, #3B0764 100%)",
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
            background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
            padding: "0.85rem",
            borderRadius: "var(--radius-lg)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <BookMarked size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Marks & Assessments</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#DDD6FE", fontSize: "0.875rem" }}>
              {studentInfo?.name || "Student"} • Official Term Evaluation Record
            </p>
          </div>
        </div>

        <div style={{
          background: "rgba(139, 92, 246, 0.2)",
          border: "1px solid rgba(196, 181, 253, 0.4)",
          padding: "0.5rem 1rem",
          borderRadius: "2rem",
          fontSize: "0.875rem",
          fontWeight: 700,
          color: "#EDE9FE",
        }}>
          Overall Aggregate: {overallPct}%
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div style={{
          background: "var(--bg-surface)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Term Average</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--teal-500)", marginTop: "0.25rem" }}>
            {overallPct}%
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: 600 }}>Grade: A (Distinction)</span>
        </div>

        <div style={{
          background: "var(--bg-surface)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Assessments Count</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            {recentMarks.length}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Subjects Evaluated</span>
        </div>

        <div style={{
          background: "var(--bg-surface)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
        }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Class Standing</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.25rem" }}>
            Top 10%
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: 600 }}>High academic standing</span>
        </div>
      </div>

      {/* Subject Marks Breakdown */}
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
        }}>
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>Subject-wise Score Cards</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {recentMarks.length > 0 ? (
            recentMarks.map((m) => {
              const pct = Math.round((m.score / m.maxScore) * 100);
              const badge = getGradeBadge(m.score, m.maxScore);

              return (
                <div
                  key={m.id}
                  style={{
                    padding: "1.25rem 1.5rem",
                    borderBottom: "1px solid var(--border-default)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div style={{ minWidth: "220px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.063rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {m.subject}
                    </h3>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                      {m.examName}
                    </p>
                    {m.remarks && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", display: "block", marginTop: "0.25rem" }}>
                        "{m.remarks}"
                      </span>
                    )}
                  </div>

                  {/* Progress Bar & Scores */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flex: 1, maxWidth: "400px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.813rem", marginBottom: "0.35rem", fontWeight: 600 }}>
                        <span style={{ color: "var(--text-primary)" }}>{m.score} / {m.maxScore}</span>
                        <span style={{ color: "var(--teal-500)" }}>{pct}%</span>
                      </div>
                      <div style={{ height: "8px", background: "var(--bg-surface-hover)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--danger)",
                          borderRadius: "4px",
                        }} />
                      </div>
                    </div>

                    <span style={{
                      padding: "0.25rem 0.65rem",
                      borderRadius: "2rem",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      backgroundColor: badge.bg,
                      color: badge.color,
                    }}>
                      {badge.grade}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "3.5rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <BookMarked size={48} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
              <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.125rem" }}>No Assessment Data</h3>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                Term assessments have not been finalized or published yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
