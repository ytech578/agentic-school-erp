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
  BookOpen
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
  status: "PENDING" | "SUBMITTED" | "EVALUATED";
  marksObtained?: number | null;
  feedback?: string | null;
}

export default function StudentAssignmentsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get("/dashboard/student");
        setData(res.data?.data || res.data);
      } catch (err) {
        console.error("Failed to load student assignments", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const assignments: Assignment[] = data?.activeAssignments || [];

  const pendingList = assignments.filter((a) => a.status === "PENDING");
  const completedList = assignments.filter((a) => a.status === "SUBMITTED" || a.status === "EVALUATED");

  const displayedList = activeTab === "ACTIVE" ? pendingList : completedList;

  const handleSimulateSubmit = (id: string, title: string) => {
    setSubmittingId(id);
    setTimeout(() => {
      setSubmittingId(null);
      setToastMessage(`Assignment "${title}" submitted successfully! Marked for teacher review.`);
      setTimeout(() => setToastMessage(null), 4000);
    }, 1000);
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

                  {assignment.feedback && (
                    <div style={{
                      marginTop: "0.85rem",
                      padding: "0.75rem",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-surface-hover)",
                      fontSize: "0.813rem",
                      color: "var(--text-secondary)",
                    }}>
                      <strong>Teacher Feedback:</strong> {assignment.feedback}
                    </div>
                  )}
                </div>

                {assignment.status === "PENDING" && (
                  <Button
                    onClick={() => handleSimulateSubmit(assignment.id, assignment.title)}
                    isLoading={submittingId === assignment.id}
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
    </div>
  );
}
