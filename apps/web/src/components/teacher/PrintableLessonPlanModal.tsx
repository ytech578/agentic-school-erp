"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { Printer, X, FileText, CheckCircle, Sparkles, BookOpen, Layers, Users, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";

import { parseLessonPlanSections } from "@/lib/lesson-plan-parser";

interface PrintableLessonPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonPlanContent: string;
  topic?: string;
  grade?: string;
  subject?: string;
  duration?: string;
  curriculum?: string;
  schoolName?: string;
}

type PlanViewMode = "full" | "worksheet" | "tlm_kit";

export default function PrintableLessonPlanModal({
  isOpen,
  onClose,
  lessonPlanContent,
  topic = "Lesson Topic",
  grade = "Grade 8",
  subject = "Science",
  duration = "45 mins",
  curriculum = "CBSE / NCERT Core",
  schoolName = "Sunrise Public School",
}: PrintableLessonPlanModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [customSchoolName, setCustomSchoolName] = useState(schoolName || "Sunrise Public School");
  const [viewMode, setViewMode] = useState<PlanViewMode>("full");
  const [copiedWorksheet, setCopiedWorksheet] = useState(false);

  useEffect(() => {
    if (schoolName) {
      setCustomSchoolName(schoolName);
    }
  }, [schoolName]);

  // Clean body content: extract title and body
  const { cleanPlanContent, studentWorksheetContent, tlmKitContent } = useMemo(() => {
    return parseLessonPlanSections(lessonPlanContent);
  }, [lessonPlanContent]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWorksheet = () => {
    const textToCopy = studentWorksheetContent || cleanPlanContent;
    navigator.clipboard.writeText(textToCopy);
    setCopiedWorksheet(true);
    toast.success("Student Activity Handout copied to clipboard!");
    setTimeout(() => setCopiedWorksheet(false), 2000);
  };

  const handleDownloadText = () => {
    const element = document.createElement("a");
    const file = new Blob([lessonPlanContent], { type: "text/markdown;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `Lesson_Plan_${topic.replace(/\s+/g, "_")}_${grade.replace(/\s+/g, "_")}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Lesson plan downloaded successfully!");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
      className="print-modal-overlay"
      onClick={onClose}
    >
      {/* Print-specific CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-sheet, .printable-sheet * {
            visibility: visible;
          }
          .printable-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: #111827 !important;
          }
          .no-print, .print-modal-header, .print-view-selector {
            display: none !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #d1d5db !important;
            padding: 6px 10px !important;
            font-size: 11pt !important;
          }
          th {
            background-color: #f3f4f6 !important;
          }
        }
      `}</style>

      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-default)",
          width: "100%",
          maxWidth: "960px",
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="print-modal-header"
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-app)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, #2563eb, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <BookOpen size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                Printable Lesson Plan &amp; TLM Master Kit
              </h3>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                Official institutional format with separate student-facing worksheet
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {studentWorksheetContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyWorksheet}
                style={{ gap: "0.375rem" }}
              >
                {copiedWorksheet ? <Check size={14} style={{ color: "var(--brand-success)" }} /> : <Copy size={14} />}
                {copiedWorksheet ? "Copied!" : "Copy Worksheet"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadText}
              style={{ gap: "0.375rem" }}
            >
              <Download size={14} />
              Export .md
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              style={{ gap: "0.375rem" }}
            >
              <Printer size={15} />
              Print / Save PDF
            </Button>

            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                padding: "0.5rem",
                cursor: "pointer",
                borderRadius: "var(--radius-md)",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* View Mode Segmented Controls */}
        <div
          className="print-view-selector"
          style={{
            padding: "0.625rem 1.5rem",
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "0.375rem", background: "var(--bg-app)", padding: "0.25rem", borderRadius: "var(--radius-lg)" }}>
            <button
              type="button"
              onClick={() => setViewMode("full")}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "none",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                background: viewMode === "full" ? "var(--bg-surface)" : "transparent",
                color: viewMode === "full" ? "var(--brand-primary)" : "var(--text-secondary)",
                boxShadow: viewMode === "full" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <BookOpen size={13} /> Complete Lesson Plan &amp; TLM
            </button>

            {studentWorksheetContent && (
              <button
                type="button"
                onClick={() => setViewMode("worksheet")}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  background: viewMode === "worksheet" ? "var(--bg-surface)" : "transparent",
                  color: viewMode === "worksheet" ? "var(--brand-primary)" : "var(--text-secondary)",
                  boxShadow: viewMode === "worksheet" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <Users size={13} /> Student Handout Only
              </button>
            )}

            {tlmKitContent && (
              <button
                type="button"
                onClick={() => setViewMode("tlm_kit")}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  background: viewMode === "tlm_kit" ? "var(--bg-surface)" : "transparent",
                  color: viewMode === "tlm_kit" ? "var(--brand-primary)" : "var(--text-secondary)",
                  boxShadow: viewMode === "tlm_kit" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <Layers size={13} /> TLM Material Prep List
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>School Letterhead:</span>
            <input
              type="text"
              value={customSchoolName}
              onChange={(e) => setCustomSchoolName(e.target.value)}
              style={{
                fontSize: "var(--text-xs)",
                padding: "0.25rem 0.5rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-app)",
                color: "var(--text-primary)",
                width: "220px",
              }}
            />
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "2rem",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* A4 Sheet Simulation */}
          <div
            ref={contentRef}
            className="printable-sheet"
            style={{
              width: "100%",
              maxWidth: "800px",
              backgroundColor: "#ffffff",
              color: "#0f172a",
              padding: "2.75rem 3rem",
              borderRadius: "4px",
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.08)",
              minHeight: "1000px",
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              lineHeight: 1.6,
            }}
          >
            {/* Formal Institutional Header */}
            <div
              style={{
                textAlign: "center",
                borderBottom: "2.5px solid #0f172a",
                paddingBottom: "1.25rem",
                marginBottom: "1.75rem",
              }}
            >
              <h1
                style={{
                  margin: "0 0 0.25rem 0",
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  color: "#0f172a",
                }}
              >
                {customSchoolName}
              </h1>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#475569",
                  marginBottom: "0.5rem",
                }}
              >
                Department of Academic Instruction • Academic Session 2026–27
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "0.2rem 1rem",
                  background: "#f1f5f9",
                  borderRadius: "9999px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  color: "#1e3a8a",
                }}
              >
                {viewMode === "worksheet"
                  ? "STUDENT CLASSROOM ACTIVITY WORKSHEET"
                  : viewMode === "tlm_kit"
                  ? "TEACHING LEARNING MATERIAL (TLM) PREPARATION KIT"
                  : "OFFICIAL TEACHER INSTRUCTIONAL LESSON PLAN & TLM GUIDE"}
              </div>
            </div>

            {/* Metadata Parameters Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.75rem",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.875rem 1.25rem",
                marginBottom: "2rem",
                fontSize: "0.85rem",
              }}
            >
              <div>
                <span style={{ display: "block", color: "#64748b", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>
                  Subject
                </span>
                <strong style={{ color: "#0f172a" }}>{subject}</strong>
              </div>
              <div>
                <span style={{ display: "block", color: "#64748b", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>
                  Grade / Class
                </span>
                <strong style={{ color: "#0f172a" }}>{grade}</strong>
              </div>
              <div>
                <span style={{ display: "block", color: "#64748b", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>
                  Duration
                </span>
                <strong style={{ color: "#0f172a" }}>{duration}</strong>
              </div>
              <div>
                <span style={{ display: "block", color: "#64748b", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>
                  Curriculum Board
                </span>
                <strong style={{ color: "#0f172a" }}>{curriculum}</strong>
              </div>
            </div>

            {/* Document Content Rendered via Markdown */}
            <div className="markdown-printable-content">
              {viewMode === "worksheet" && studentWorksheetContent ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {studentWorksheetContent}
                </ReactMarkdown>
              ) : viewMode === "tlm_kit" && tlmKitContent ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {tlmKitContent}
                </ReactMarkdown>
              ) : (
                <>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {cleanPlanContent}
                  </ReactMarkdown>

                  {studentWorksheetContent && (
                    <div className="page-break" style={{ marginTop: "2.5rem", paddingTop: "2rem", borderTop: "2px dashed #cbd5e1" }}>
                      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                          ✂️ [ Classroom Distribution Handout - Print Separately for Students ]
                        </span>
                      </div>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {studentWorksheetContent}
                      </ReactMarkdown>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Formal Institutional Endorsement Block */}
            <div
              style={{
                marginTop: "3rem",
                paddingTop: "2rem",
                borderTop: "1.5px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "2rem",
                textAlign: "center",
                fontSize: "0.8rem",
                color: "#475569",
              }}
            >
              <div>
                <div style={{ height: "40px", borderBottom: "1px dashed #94a3b8", marginBottom: "0.5rem" }} />
                <strong>Lesson Planned By</strong>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Subject Teacher Signature</div>
              </div>
              <div>
                <div style={{ height: "40px", borderBottom: "1px dashed #94a3b8", marginBottom: "0.5rem" }} />
                <strong>Pedagogical Review</strong>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Academic Coordinator</div>
              </div>
              <div>
                <div style={{ height: "40px", borderBottom: "1px dashed #94a3b8", marginBottom: "0.5rem" }} />
                <strong>Approved By</strong>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Principal / Head of School</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
