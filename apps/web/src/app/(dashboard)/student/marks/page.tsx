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
  BarChart3,
  Brain,
  RotateCcw,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { getGradeBadge } from "@/lib/formatters";
import AdaptivePracticeModal from "@/components/student/AdaptivePracticeModal";

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

  // Agent 4: Adaptive Remedial State
  const [remedialData, setRemedialData] = useState<any>(null);
  const [remedialLoading, setRemedialLoading] = useState(true);
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [practiceTarget, setPracticeTarget] = useState<{ subject: string; topic: string } | null>(null);

  const fetchRemedial = async () => {
    setRemedialLoading(true);
    try {
      const res = await apiClient.get("/ai/student/remedial");
      setRemedialData(res.data?.data || res.data);
    } catch (err) {
      console.error("Failed to load remedial plan", err);
    } finally {
      setRemedialLoading(false);
    }
  };

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
    fetchRemedial();
  }, []);

  const handleOpenPractice = (subject: string, topic: string) => {
    setPracticeTarget({ subject, topic });
    setPracticeModalOpen(true);
  };

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

      {/* ═══════════════════════════════════════════════════════════════
          AGENT 4: ADAPTIVE STUDENT REMEDIAL & REVISION TUTOR
      ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-default)",
          overflow: "hidden",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div
          style={{
            padding: "1.25rem 1.5rem",
            background: "linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(124, 58, 237, 0.06) 100%)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 3px 10px rgba(79, 70, 229, 0.3)",
              }}
            >
              <Brain size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  AI Adaptive Remedial & Revision Tutor
                </h2>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(99, 102, 241, 0.15)",
                    color: "#4F46E5",
                  }}
                >
                  Bloom's Gap Diagnostics
                </span>
              </div>
              <p style={{ margin: "0.15rem 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                Personalized weak topic analysis derived from exam marks with interactive micro-quizzes
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchRemedial}
              disabled={remedialLoading}
              style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <RotateCcw size={13} className={remedialLoading ? "animate-spin" : ""} />
              Refresh Diagnostics
            </Button>
          </div>
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Strategy & Advice Banner */}
          {remedialData?.revisionStrategy && (
            <div
              style={{
                padding: "1rem 1.25rem",
                borderRadius: "var(--radius-lg)",
                background: "rgba(99, 102, 241, 0.04)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <Sparkles size={18} color="#6366F1" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Tutor Pedagogical Strategy
                </span>
                <p style={{ margin: "0.25rem 0 0", fontSize: "var(--text-sm)", color: "var(--text-primary)", lineHeight: 1.6 }}>
                  {remedialData.revisionStrategy}
                </p>
              </div>
            </div>
          )}

          {/* Identified Learning Gaps / Remedial Topic Cards */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Target Learning Gaps ({remedialData?.learningGaps?.length || 0})
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Click any topic to launch adaptive practice quiz with step-by-step hints
              </span>
            </div>

            {remedialLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                Analyzing recent exam telemetry and diagnostic gaps...
              </div>
            ) : (!remedialData?.learningGaps || remedialData.learningGaps.length === 0) ? (
              <div
                style={{
                  padding: "1.5rem",
                  borderRadius: "var(--radius-lg)",
                  background: "rgba(16, 185, 129, 0.06)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <CheckCircle2 size={24} color="#10B981" />
                <div>
                  <h4 style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "#065F46" }}>
                    All Evaluated Topics Above Benchmark!
                  </h4>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                    No critical conceptual gaps detected. You can still launch self-paced practice on any core subject below.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
                {remedialData.learningGaps.map((gap: any, gidx: number) => {
                  return (
                    <div
                      key={gidx}
                      style={{
                        padding: "1.1rem 1.25rem",
                        borderRadius: "var(--radius-lg)",
                        background: "var(--bg-app)",
                        border: "1px solid var(--border-default)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand-primary)", textTransform: "uppercase" }}>
                            {gap.subject}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "0.1rem 0.45rem",
                              borderRadius: "var(--radius-full)",
                              background: "rgba(239, 68, 68, 0.1)",
                              color: "var(--status-danger)",
                            }}
                          >
                            Score: {gap.currentScore}%
                          </span>
                        </div>
                        <h4 style={{ margin: "0 0 0.35rem", fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                          {gap.topic}
                        </h4>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                          {gap.recommendedAction}
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px dashed var(--border-subtle)" }}>
                        {gap.bloomLevel ? (
                          <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>
                            Target: {gap.bloomLevel}
                          </span>
                        ) : <span />}

                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleOpenPractice(gap.subject, gap.topic)}
                          style={{
                            fontSize: "11px",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                            color: "#FFFFFF",
                            border: "none",
                          }}
                        >
                          <Sparkles size={12} />
                          Practice & Master Topic
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenPractice(m.subject, `${m.subject} Revision Topics`)}
                      style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <Brain size={12} /> Practice
                    </Button>
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

      {/* Adaptive Practice & Remedial Modal */}
      {practiceTarget && (
        <AdaptivePracticeModal
          isOpen={practiceModalOpen}
          onClose={() => setPracticeModalOpen(false)}
          subject={practiceTarget.subject}
          topic={practiceTarget.topic}
          grade="Class 10"
          onComplete={() => {
            fetchRemedial();
          }}
        />
      )}
    </div>
  );
}
