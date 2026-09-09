"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Check, Search, Calendar, FileText, CheckCircle2, 
  AlertTriangle, Clock, Trash2, ArrowLeft, Users, 
  Filter, Loader2, X, Save
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface Assignment {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  maxMarks?: number;
  classId: string;
  sectionId?: string;
  subjectId: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  subject?: { id: string; name: string; code?: string };
  _count?: { submissions: number };
  createdAt: string;
}

interface ClassItem {
  id: string;
  name: string;
  sections?: { id: string; name: string }[];
}

interface SubjectItem {
  id: string;
  name: string;
  code?: string;
}

interface SubmissionItem {
  studentId: string;
  rollNumber?: string;
  studentName: string;
  status: "PENDING" | "SUBMITTED" | "GRADED" | "LATE";
  marksObtained: number | null;
  feedback: string;
  submittedAt: string | null;
}

export default function TeacherAssignmentsPage() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "OVERDUE">("ALL");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    classId: "",
    sectionId: "",
    subjectId: "",
    title: "",
    description: "",
    dueDate: "",
    maxMarks: 100,
  });

  // Submissions Modal State
  const [selectedAssignmentForSubmissions, setSelectedAssignmentForSubmissions] = useState<Assignment | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [submissionStats, setSubmissionStats] = useState<{ totalStudents: number; submittedCount: number; gradedCount: number; pendingCount: number } | null>(null);
  const [gradingMarks, setGradingMarks] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);

  // Delete Modal State
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [assnRes, clsRes, subRes] = await Promise.all([
        apiClient.get("/assignments"),
        apiClient.get("/classes"),
        apiClient.get("/subjects"),
      ]);
      setAssignments(assnRes.data?.data || assnRes.data || []);
      setClasses(clsRes.data?.data || clsRes.data || []);
      setSubjects(subRes.data?.data || subRes.data || []);
    } catch (err) {
      console.error("Failed to load assignments data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Open Submissions Modal & Fetch Roster
  const handleOpenSubmissions = async (assignment: Assignment) => {
    setSelectedAssignmentForSubmissions(assignment);
    setSubmissionsLoading(true);
    try {
      const res = await apiClient.get(`/assignments/${assignment.id}/submissions`);
      const data = res.data?.data || res.data;
      const roster: SubmissionItem[] = data.submissions || [];
      setSubmissions(roster);
      setSubmissionStats(data.stats || null);

      const gradesMap: Record<string, { marks: string; feedback: string }> = {};
      roster.forEach((sub) => {
        gradesMap[sub.studentId] = {
          marks: sub.marksObtained !== null ? sub.marksObtained.toString() : "",
          feedback: sub.feedback || "",
        };
      });
      setGradingMarks(gradesMap);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  // Save Single Grade
  const handleSaveGrade = async (studentId: string) => {
    if (!selectedAssignmentForSubmissions) return;
    setSavingGradeId(studentId);
    try {
      const g = gradingMarks[studentId];
      const marksVal = g?.marks ? parseFloat(g.marks) : undefined;
      await apiClient.post(
        `/assignments/${selectedAssignmentForSubmissions.id}/submissions/${studentId}`,
        {
          marksObtained: marksVal,
          feedback: g?.feedback || "",
          status: marksVal !== undefined ? "GRADED" : "SUBMITTED",
        }
      );
      // Refresh list
      handleOpenSubmissions(selectedAssignmentForSubmissions);
    } catch (err) {
      console.error("Failed to save grade:", err);
    } finally {
      setSavingGradeId(null);
    }
  };

  // Handle Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiClient.post("/assignments", formData);
      setShowCreateModal(false);
      setFormData({
        classId: "",
        sectionId: "",
        subjectId: "",
        title: "",
        description: "",
        dueDate: "",
        maxMarks: 100,
      });
      fetchInitialData();
    } catch (err) {
      console.error("Failed to create assignment:", err);
      alert("Failed to create assignment. Please verify all inputs.");
    } finally {
      setCreating(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!assignmentToDelete) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/assignments/${assignmentToDelete.id}`);
      setAssignmentToDelete(null);
      fetchInitialData();
    } catch (err) {
      console.error("Failed to delete assignment:", err);
      alert("Failed to delete assignment.");
    } finally {
      setDeleting(false);
    }
  };

  // Quick preset helper for due dates
  const setQuickDueDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(17, 0, 0, 0); // 5:00 PM
    const isoString = d.toISOString().slice(0, 16);
    setFormData((prev) => ({ ...prev, dueDate: isoString }));
  };

  // Filtered list
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !q || 
        a.title.toLowerCase().includes(q) || 
        a.subject?.name?.toLowerCase().includes(q) ||
        a.class?.name?.toLowerCase().includes(q);

      // Class
      const matchesClass = selectedClassFilter === "ALL" || a.classId === selectedClassFilter;

      // Status
      const isPast = new Date(a.dueDate) < new Date();
      const matchesStatus = 
        statusFilter === "ALL" || 
        (statusFilter === "ACTIVE" && !isPast) || 
        (statusFilter === "OVERDUE" && isPast);

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [assignments, searchQuery, selectedClassFilter, statusFilter]);

  // Quick Stats
  const totalCount = assignments.length;
  const activeCount = assignments.filter((a) => new Date(a.dueDate) >= new Date()).length;
  const overdueCount = assignments.filter((a) => new Date(a.dueDate) < new Date()).length;
  const totalSubmissions = assignments.reduce((acc, a) => acc + (a._count?.submissions || 0), 0);

  const selectedClass = classes.find((c) => c.id === formData.classId);
  const availableSections = selectedClass?.sections || [];

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <Link
              href="/teacher-copilot"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                color: "var(--text-tertiary)",
                textDecoration: "none",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={14} /> Teacher CoPilot
            </Link>
            <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>/</span>
            <span style={{ color: "var(--brand-primary)", fontSize: "var(--text-xs)", fontWeight: 600 }}>Assignments</span>
          </div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <FileText size={26} style={{ color: "var(--brand-primary)" }} />
            Assignment Manager
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: "0.25rem" }}>
            Publish homework tasks, track student submissions, and record grades with instant feedback.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #0891B2 100%)",
              color: "#FFFFFF",
              borderRadius: "var(--radius-xl)",
              padding: "0.625rem 1.25rem",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
            }}
            leftIcon={<Plus size={18} />}
          >
            Create Assignment
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {[
          { label: "Total Assignments", val: totalCount, icon: FileText, color: "var(--brand-blue)", bg: "var(--brand-blue-subtle)" },
          { label: "Active & Ongoing", val: activeCount, icon: Clock, color: "var(--success)", bg: "var(--success-light)" },
          { label: "Overdue Submissions", val: overdueCount, icon: AlertTriangle, color: "var(--danger)", bg: "var(--danger-light)" },
          { label: "Total Submissions", val: totalSubmissions, icon: CheckCircle2, color: "var(--brand-teal)", bg: "var(--brand-teal-subtle)" },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              style={{
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-xl)",
                padding: "1.25rem 1.5rem",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-lg)",
                background: kpi.bg,
                color: kpi.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={24} />
              </div>
              <div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>
                  {kpi.val}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500, marginTop: "0.25rem" }}>
                  {kpi.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-xl)",
        padding: "1rem 1.25rem",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
      }}>
        {/* Search Input */}
        <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
          <Search size={16} style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <input
            type="text"
            placeholder="Search assignments by title, subject, or class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.875rem 0.5rem 2.5rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-app)",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              outline: "none",
            }}
          />
        </div>

        {/* Class Filter Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Filter size={16} style={{ color: "var(--text-tertiary)" }} />
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            style={{
              padding: "0.5rem 0.875rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-app)",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Status Pills */}
        <div style={{ display: "flex", background: "var(--bg-app)", padding: "0.25rem", borderRadius: "var(--radius-lg)", gap: "0.25rem" }}>
          {(["ALL", "ACTIVE", "OVERDUE"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                border: "none",
                padding: "0.35rem 0.75rem",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                cursor: "pointer",
                background: statusFilter === st ? "var(--bg-surface)" : "transparent",
                color: statusFilter === st ? "var(--brand-primary)" : "var(--text-secondary)",
                boxShadow: statusFilter === st ? "var(--shadow-sm)" : "none",
                transition: "all var(--duration-fast)",
              }}
            >
              {st === "ALL" ? "All Status" : st === "ACTIVE" ? "Active" : "Overdue"}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: "110px", borderRadius: "var(--radius-xl)", background: "var(--bg-surface)", opacity: 0.6, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-2xl)",
            border: "1px dashed var(--border-default)",
            padding: "3.5rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "var(--brand-blue-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brand-primary)",
            }}>
              <FileText size={30} />
            </div>
            <div>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                No Assignments Found
              </h3>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "420px" }}>
                {searchQuery || selectedClassFilter !== "ALL" || statusFilter !== "ALL"
                  ? "No assignments matched your active search and filter parameters."
                  : "No assignments have been published yet. Get started by creating your first homework task."}
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              style={{
                borderRadius: "var(--radius-xl)",
                padding: "0.5rem 1.25rem",
                fontWeight: 600,
              }}
              leftIcon={<Plus size={16} />}
            >
              Create New Assignment
            </Button>
          </div>
        ) : (
          filteredAssignments.map((a) => {
            const dueDate = new Date(a.dueDate);
            const isOverdue = dueDate < new Date();
            const timeDiffDays = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <div
                key={a.id}
                style={{
                  background: "var(--bg-surface)",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--border-default)",
                  padding: "1.25rem 1.5rem",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                  transition: "all var(--duration-fast)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--brand-blue-light)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                }}
              >
                {/* Left: Info */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1, minWidth: "300px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{
                      background: "var(--brand-blue-subtle)",
                      color: "var(--brand-primary)",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                    }}>
                      {a.subject?.name || "General Subject"}
                    </span>
                    <span style={{
                      background: "var(--bg-app)",
                      color: "var(--text-secondary)",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                    }}>
                      {a.class?.name || "Class"} {a.section?.name ? `· Sec ${a.section.name}` : "· All Sections"}
                    </span>
                    <span style={{
                      background: "var(--bg-app)",
                      color: "var(--text-tertiary)",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                    }}>
                      Max Marks: {a.maxMarks || 100}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.125rem" }}>
                    {a.title}
                  </h3>

                  {a.description && (
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineClamp: 2, WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {a.description}
                    </p>
                  )}
                </div>

                {/* Right: Due Date & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      padding: "0.2rem 0.6rem",
                      borderRadius: "var(--radius-full)",
                      background: isOverdue ? "var(--danger-light)" : "var(--success-light)",
                      color: isOverdue ? "var(--danger)" : "var(--success)",
                    }}>
                      {isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                      {isOverdue 
                        ? `Overdue (${Math.abs(timeDiffDays)} days ago)` 
                        : timeDiffDays === 0 
                        ? "Due Today" 
                        : `Due in ${timeDiffDays} days`}
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Calendar size={12} />
                      {new Date(a.dueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Submission Counter & Action */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenSubmissions(a)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.5rem 0.875rem",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all var(--duration-fast)",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "var(--brand-primary)";
                        e.currentTarget.style.color = "#FFFFFF";
                        e.currentTarget.style.borderColor = "var(--brand-primary)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "var(--bg-app)";
                        e.currentTarget.style.color = "var(--text-primary)";
                        e.currentTarget.style.borderColor = "var(--border-default)";
                      }}
                    >
                      <Users size={14} />
                      Submissions ({a._count?.submissions || 0})
                    </button>

                    <button
                      type="button"
                      title="Delete Assignment"
                      onClick={() => setAssignmentToDelete(a)}
                      style={{
                        padding: "0.5rem",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-app)",
                        color: "var(--text-tertiary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all var(--duration-fast)",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = "var(--danger)";
                        e.currentTarget.style.borderColor = "var(--danger)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = "var(--text-tertiary)";
                        e.currentTarget.style.borderColor = "var(--border-default)";
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================
          CREATE ASSIGNMENT MODAL
          Strict Solid Background + 12px Backdrop Blur
          ======================================================== */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "var(--bg-overlay)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          animation: "fadeIn 0.2s ease-out",
        }}>
          <div style={{
            background: "var(--bg-surface-solid)",
            backgroundColor: "var(--bg-surface-solid)",
            opacity: 1,
            borderRadius: "var(--radius-2xl)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--modal-shadow)",
            maxWidth: "36rem",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            animation: "zoomIn 0.2s ease-out",
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "1.5rem 1.75rem",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              background: "var(--bg-surface-solid)",
              zIndex: 10,
            }}>
              <div>
                <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)" }}>
                  Create New Assignment
                </h2>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Students and parents will receive instant portal notifications upon creation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  padding: "0.25rem",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreate} style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Target Class *
                  </label>
                  <select
                    required
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value, sectionId: "" })}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Section (Optional)
                  </label>
                  <select
                    value={formData.sectionId}
                    onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                    disabled={!formData.classId}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  >
                    <option value="">All Sections</option>
                    {availableSections.map((s) => (
                      <option key={s.id} value={s.id}>Section {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                  Subject *
                </label>
                <select
                  required
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-default)",
                    backgroundColor: "var(--bg-app)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    outline: "none",
                  }}
                >
                  <option value="">Select Subject</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {sub.code ? `(${sub.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                  Assignment Title *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Chapter 4 Practice Problems & Short Essay"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-default)",
                    backgroundColor: "var(--bg-app)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                  Instructions & Guidelines
                </label>
                <textarea
                  rows={3}
                  placeholder="Specific tasks for students, reference pages, or submission format instructions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-default)",
                    backgroundColor: "var(--bg-app)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1rem" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                      Due Date & Time *
                    </label>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button
                        type="button"
                        onClick={() => setQuickDueDate(1)}
                        style={{ border: "none", background: "var(--brand-blue-subtle)", color: "var(--brand-primary)", fontSize: "0.7rem", fontWeight: 600, borderRadius: "var(--radius-xs)", padding: "0.15rem 0.4rem", cursor: "pointer" }}
                      >
                        +Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDueDate(7)}
                        style={{ border: "none", background: "var(--brand-blue-subtle)", color: "var(--brand-primary)", fontSize: "0.7rem", fontWeight: 600, borderRadius: "var(--radius-xs)", padding: "0.15rem 0.4rem", cursor: "pointer" }}
                      >
                        +7 Days
                      </button>
                    </div>
                  </div>
                  <input
                    required
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: "0.375rem" }}>
                    Max Marks *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.maxMarks}
                    onChange={(e) => setFormData({ ...formData, maxMarks: parseInt(e.target.value, 10) || 100 })}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border-default)" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "0.625rem 1.25rem",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-app)",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    fontSize: "var(--text-sm)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: "0.625rem 1.5rem",
                    borderRadius: "var(--radius-lg)",
                    fontWeight: 600,
                  }}
                  leftIcon={creating ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                >
                  {creating ? "Creating..." : "Publish Assignment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          VIEW SUBMISSIONS & GRADING MODAL
          Strict Solid Background + 12px Backdrop Blur
          ======================================================== */}
      {selectedAssignmentForSubmissions && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "var(--bg-overlay)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          animation: "fadeIn 0.2s ease-out",
        }}>
          <div style={{
            background: "var(--bg-surface-solid)",
            backgroundColor: "var(--bg-surface-solid)",
            opacity: 1,
            borderRadius: "var(--radius-2xl)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--modal-shadow)",
            maxWidth: "52rem",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            animation: "zoomIn 0.2s ease-out",
          }}>
            {/* Submissions Header */}
            <div style={{
              padding: "1.5rem 1.75rem",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              position: "sticky",
              top: 0,
              background: "var(--bg-surface-solid)",
              zIndex: 10,
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, background: "var(--brand-blue-subtle)", color: "var(--brand-primary)", padding: "0.2rem 0.5rem", borderRadius: "var(--radius-full)" }}>
                    {selectedAssignmentForSubmissions.subject?.name}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                    {selectedAssignmentForSubmissions.class?.name} · Max: {selectedAssignmentForSubmissions.maxMarks || 100} pts
                  </span>
                </div>
                <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)" }}>
                  {selectedAssignmentForSubmissions.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAssignmentForSubmissions(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  padding: "0.25rem",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Submissions Summary Stats */}
            {submissionStats && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.75rem",
                padding: "1rem 1.75rem",
                background: "var(--bg-app)",
                borderBottom: "1px solid var(--border-default)",
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)" }}>{submissionStats.totalStudents}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Total Roster</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--brand-primary)" }}>{submissionStats.submittedCount}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Turned In</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--success)" }}>{submissionStats.gradedCount}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Graded</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--warning)" }}>{submissionStats.pendingCount}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Pending</div>
                </div>
              </div>
            )}

            {/* Submissions Roster List */}
            <div style={{ padding: "1.25rem 1.75rem", flex: 1, overflowY: "auto" }}>
              {submissionsLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", color: "var(--text-secondary)", gap: "0.75rem" }}>
                  <Loader2 className="animate-spin" size={24} style={{ color: "var(--brand-primary)" }} />
                  <span>Loading class roster and submissions...</span>
                </div>
              ) : submissions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                  No active students enrolled in this class or section.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {submissions.map((sub) => {
                    const gradeState = gradingMarks[sub.studentId] || { marks: "", feedback: "" };
                    const isSaving = savingGradeId === sub.studentId;

                    return (
                      <div
                        key={sub.studentId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.875rem 1rem",
                          borderRadius: "var(--radius-lg)",
                          border: "1px solid var(--border-default)",
                          background: sub.status === "GRADED" ? "var(--success-light)" : sub.status === "SUBMITTED" ? "var(--brand-blue-subtle)" : "var(--bg-surface)",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Student Name & Status */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: "180px" }}>
                          <span style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: "var(--brand-blue-subtle)",
                            color: "var(--brand-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "var(--text-xs)",
                            fontWeight: 700,
                          }}>
                            {sub.rollNumber || "•"}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                              {sub.studentName}
                            </div>
                            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                              {sub.status === "GRADED" ? "Graded" : sub.status === "SUBMITTED" ? "Submitted" : "Pending Submission"}
                            </div>
                          </div>
                        </div>

                        {/* Marks & Feedback Inline Inputs */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "260px" }}>
                          <div style={{ width: "90px" }}>
                            <input
                              type="number"
                              placeholder={`/ ${selectedAssignmentForSubmissions.maxMarks || 100}`}
                              min="0"
                              max={selectedAssignmentForSubmissions.maxMarks || 100}
                              value={gradeState.marks}
                              onChange={(e) => setGradingMarks((prev) => ({
                                ...prev,
                                [sub.studentId]: { ...prev[sub.studentId], marks: e.target.value }
                              }))}
                              style={{
                                width: "100%",
                                padding: "0.4rem 0.6rem",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--border-default)",
                                backgroundColor: "var(--bg-app)",
                                color: "var(--text-primary)",
                                fontSize: "var(--text-xs)",
                                outline: "none",
                              }}
                            />
                          </div>

                          <div style={{ flex: 1 }}>
                            <input
                              type="text"
                              placeholder="Feedback / Remarks (optional)..."
                              value={gradeState.feedback}
                              onChange={(e) => setGradingMarks((prev) => ({
                                ...prev,
                                [sub.studentId]: { ...prev[sub.studentId], feedback: e.target.value }
                              }))}
                              style={{
                                width: "100%",
                                padding: "0.4rem 0.6rem",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--border-default)",
                                backgroundColor: "var(--bg-app)",
                                color: "var(--text-primary)",
                                fontSize: "var(--text-xs)",
                                outline: "none",
                              }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSaveGrade(sub.studentId)}
                            disabled={isSaving}
                            style={{
                              padding: "0.4rem 0.75rem",
                              borderRadius: "var(--radius-md)",
                              border: "none",
                              background: "var(--brand-primary)",
                              color: "#FFFFFF",
                              fontSize: "var(--text-xs)",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              flexShrink: 0,
                            }}
                          >
                            {isSaving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRMATION MODAL
          Strict Solid Background + 12px Backdrop Blur
          ======================================================== */}
      {assignmentToDelete && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "var(--bg-overlay)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          animation: "fadeIn 0.2s ease-out",
        }}>
          <div style={{
            background: "var(--bg-surface-solid)",
            backgroundColor: "var(--bg-surface-solid)",
            opacity: 1,
            borderRadius: "var(--radius-2xl)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--modal-shadow)",
            maxWidth: "28rem",
            width: "100%",
            padding: "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            animation: "zoomIn 0.2s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--danger)" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--danger-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)" }}>
                  Delete Assignment
                </h3>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  Are you sure you want to remove this assignment?
                </p>
              </div>
            </div>

            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Deleting <strong>&quot;{assignmentToDelete.title}&quot;</strong> will also delete all student submissions and marks recorded for it. This action cannot be reversed.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setAssignmentToDelete(null)}
                style={{
                  padding: "0.625rem 1.25rem",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-app)",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: "0.625rem 1.25rem",
                  borderRadius: "var(--radius-lg)",
                  border: "none",
                  background: "var(--danger)",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                {deleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                {deleting ? "Deleting..." : "Delete Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
