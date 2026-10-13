"use client";

import React, { useEffect, useState } from "react";
import { 
  ClipboardList, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  UploadCloud,
  Send,
  Sparkles,
  BookOpen,
  X,
  ShieldCheck,
  Link as LinkIcon
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/Button";

interface Assignment {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  maxMarks: number;
  status: "PENDING" | "SUBMITTED" | "EVALUATED" | "GRADED" | "OVERDUE";
  marksObtained?: number | null;
  feedback?: string | null;
  submissionText?: string | null;
  originalityReport?: {
    similarityScore: number;
    flagLevel: string;
    summary: string;
  } | null;
}

export default function StudentAssignmentsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Student Solution Submission Modal State
  const [activeAssignmentToSubmit, setActiveAssignmentToSubmit] = useState<Assignment | null>(null);
  const [submissionContent, setSubmissionContent] = useState("");
  const [submissionAttachmentUrl, setSubmissionAttachmentUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await apiClient.get("/dashboard/student");
      setData(res.data?.data || res.data);
    } catch (err) {
      console.error("Failed to load student assignments", err);
    } finally {
      setLoading(false);
    }
  };

  const assignments: Assignment[] = data?.activeAssignments || [];

  const pendingList = assignments.filter((a) => a.status === "PENDING" || a.status === "OVERDUE");
  const completedList = assignments.filter((a) => a.status === "SUBMITTED" || a.status === "EVALUATED" || a.status === "GRADED");

  const displayedList = activeTab === "ACTIVE" ? pendingList : completedList;

  const handleSubmitSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignmentToSubmit || !submissionContent.trim()) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/assignments/${activeAssignmentToSubmit.id}/submit`, {
        content: submissionContent.trim(),
        attachmentUrl: submissionAttachmentUrl.trim() || undefined,
      });
      setToastMessage(`Assignment "${activeAssignmentToSubmit.title}" submitted successfully! Originality analysis recorded.`);
      setActiveAssignmentToSubmit(null);
      setSubmissionContent("");
      setSubmissionAttachmentUrl("");
      loadData();
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err: any) {
      console.error("Submission failed:", err);
      alert(err?.response?.data?.message || "Failed to submit assignment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1200px" }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "2rem",
          right: "2rem",
          background: "var(--success)",
          color: "#FFF",
          padding: "1rem 1.5rem",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          zIndex: 1000,
          fontWeight: 600,
        }}>
          <CheckCircle2 size={20} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)",
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
            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            padding: "0.85rem",
            borderRadius: "var(--radius-lg)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Homework & Assignments</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#A7F3D0", fontSize: "0.875rem" }}>
              Track tasks, submit solutions, and review teacher assessments
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div style={{
            background: "rgba(16, 185, 129, 0.2)",
            border: "1px solid rgba(167, 243, 208, 0.3)",
            padding: "0.5rem 1rem",
            borderRadius: "2rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#D1FAE5",
          }}>
            {pendingList.length} Pending Submission
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "0.5rem" }}>
        <button
          onClick={() => setActiveTab("ACTIVE")}
          style={{
            padding: "0.65rem 1.25rem",
            borderRadius: "var(--radius-lg)",
            fontWeight: 700,
            fontSize: "0.875rem",
            cursor: "pointer",
            border: "none",
            background: activeTab === "ACTIVE" ? "var(--teal-500)" : "transparent",
            color: activeTab === "ACTIVE" ? "#FFF" : "var(--text-secondary)",
          }}
        >
          Active Tasks ({pendingList.length})
        </button>
        <button
          onClick={() => setActiveTab("COMPLETED")}
          style={{
            padding: "0.65rem 1.25rem",
            borderRadius: "var(--radius-lg)",
            fontWeight: 700,
            fontSize: "0.875rem",
            cursor: "pointer",
            border: "none",
            background: activeTab === "COMPLETED" ? "var(--teal-500)" : "transparent",
            color: activeTab === "COMPLETED" ? "#FFF" : "var(--text-secondary)",
          }}
        >
          Submitted & Graded ({completedList.length})
        </button>
      </div>

      {/* Assignments Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        {displayedList.length > 0 ? (
          displayedList.map((assignment) => {
            const dueDate = new Date(assignment.dueDate);
            const isOverdue = dueDate < new Date() && assignment.status === "PENDING";

            return (
              <div
                key={assignment.id}
                style={{
                  background: "var(--bg-surface)",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--border-default)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1.25rem",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <span style={{
                      background: "rgba(59, 130, 246, 0.1)",
                      color: "var(--primary-600)",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "2rem",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}>
                      {assignment.subject}
                    </span>

                    <span style={{
                      background: assignment.status === "EVALUATED" 
                        ? "rgba(16, 185, 129, 0.15)" 
                        : assignment.status === "SUBMITTED" 
                        ? "rgba(59, 130, 246, 0.15)" 
                        : isOverdue 
                        ? "rgba(239, 68, 68, 0.15)" 
                        : "rgba(245, 158, 11, 0.15)",
                      color: assignment.status === "EVALUATED" 
                        ? "var(--success)" 
                        : assignment.status === "SUBMITTED" 
                        ? "var(--primary-600)" 
                        : isOverdue 
                        ? "var(--danger)" 
                        : "var(--warning)",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "2rem",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}>
                      {assignment.status === "EVALUATED" 
                        ? `Graded: ${assignment.marksObtained}/${assignment.maxMarks}` 
                        : assignment.status === "SUBMITTED" 
                        ? "Submitted" 
                        : isOverdue 
                        ? "Overdue" 
                        : "Pending"}
                    </span>
                  </div>

                  <h3 style={{ margin: "0.85rem 0 0.5rem", fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {assignment.title}
                  </h3>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.813rem", color: isOverdue ? "var(--danger)" : "var(--text-muted)" }}>
                    <Clock size={14} />
                    <span>Due: {formatDate(assignment.dueDate)}</span>
                  </div>

                  {assignment.submissionText && (
                    <div style={{
                      marginTop: "0.85rem",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(0,0,0,0.02)",
                      border: "1px dashed var(--border-default)",
                      fontSize: "0.813rem",
                      color: "var(--text-secondary)",
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.25rem", color: "var(--text-primary)" }}>Your Submission:</div>
                      <p style={{ margin: 0, fontStyle: "italic", whiteSpace: "pre-line", maxHeight: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        "{assignment.submissionText.length > 180 ? assignment.submissionText.slice(0, 180) + "..." : assignment.submissionText}"
                      </p>
                    </div>
                  )}

                  {assignment.originalityReport && (
                    <div style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: assignment.originalityReport.similarityScore > 40 ? "var(--warning)" : "var(--teal-600)",
                    }}>
                      <ShieldCheck size={14} />
                      <span>Originality: {Math.max(0, 100 - assignment.originalityReport.similarityScore)}% Unique ({assignment.originalityReport.similarityScore}% peer match)</span>
                    </div>
                  )}

                  {assignment.feedback && (
                    <div style={{
                      marginTop: "0.85rem",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      fontSize: "0.813rem",
                      color: "var(--text-secondary)",
                    }}>
                      <strong style={{ color: "var(--teal-700)" }}>Teacher Feedback:</strong> {assignment.feedback}
                    </div>
                  )}
                </div>

                {(assignment.status === "PENDING" || assignment.status === "OVERDUE") && (
                  <Button
                    onClick={() => {
                      setActiveAssignmentToSubmit(assignment);
                      setSubmissionContent("");
                      setSubmissionAttachmentUrl("");
                    }}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <UploadCloud size={16} style={{ marginRight: "0.5rem" }} />
                    Submit Solution
                  </Button>
                )}
              </div>
            );
          })
        ) : (
          <div style={{
            gridColumn: "1 / -1",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-default)",
            padding: "3.5rem 2rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}>
            <CheckCircle2 size={48} style={{ margin: "0 auto 1rem", opacity: 0.4, color: "var(--success)" }} />
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.125rem" }}>All Caught Up!</h3>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
              {activeTab === "ACTIVE" 
                ? "You have no pending assignments at this time." 
                : "No completed assignments found."}
            </p>
          </div>
        )}
      </div>

      {/* Student Solution Submission Modal */}
      {activeAssignmentToSubmit && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem",
        }}>
          <div style={{
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-2xl, 1.25rem)",
            border: "1px solid var(--border-default)",
            width: "100%",
            maxWidth: "680px",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            animation: "modalSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-surface-hover, rgba(0,0,0,0.02))",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <span style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "var(--teal-600, #059669)",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "1rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}>
                    {activeAssignmentToSubmit.subject}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Due: {formatDate(activeAssignmentToSubmit.dueDate)}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Submit Assignment: {activeAssignmentToSubmit.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveAssignmentToSubmit(null)}
                disabled={isSubmitting}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "0.4rem",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitSolution} style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
              <div style={{ padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                
                {/* AI Originality Notice */}
                <div style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: "var(--radius-lg)",
                  padding: "0.85rem 1rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                }}>
                  <ShieldCheck size={20} style={{ color: "var(--teal-600, #059669)", flexShrink: 0, marginTop: "2px" }} />
                  <div style={{ fontSize: "0.813rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    <strong style={{ color: "var(--text-primary)" }}>Automated Originality Check Enabled:</strong> Upon submission, your work is analyzed for peer overlap and originality. High similarity across submissions is flagged for teacher review.
                  </div>
                </div>

                {/* Submission Content Textarea */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      Your Answer / Solution Text <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {submissionContent.trim().split(/\s+/).filter(Boolean).length} words · {submissionContent.length} chars
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    required
                    value={submissionContent}
                    onChange={(e) => setSubmissionContent(e.target.value)}
                    placeholder="Type or paste your complete assignment solution, essay, or work here..."
                    style={{
                      width: "100%",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      padding: "0.85rem 1rem",
                      fontSize: "0.875rem",
                      fontFamily: "inherit",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      resize: "vertical",
                      minHeight: "160px",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Attachment / Cloud URL */}
                <div>
                  <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                    <LinkIcon size={14} /> Optional Resource Link / Document URL
                  </label>
                  <input
                    type="url"
                    value={submissionAttachmentUrl}
                    onChange={(e) => setSubmissionAttachmentUrl(e.target.value)}
                    placeholder="https://drive.google.com/... or https://github.com/..."
                    style={{
                      width: "100%",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      padding: "0.65rem 0.85rem",
                      fontSize: "0.875rem",
                      fontFamily: "inherit",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                    Provide a public Google Drive, OneDrive, GitHub, or Figma link if your work includes diagrams, slides, or large files.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: "1rem 1.5rem",
                borderTop: "1px solid var(--border-default)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                background: "var(--bg-surface-hover, rgba(0,0,0,0.02))",
              }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveAssignmentToSubmit(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!submissionContent.trim() || isSubmitting}
                  isLoading={isSubmitting}
                >
                  <Send size={16} style={{ marginRight: "0.5rem" }} />
                  Submit Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
