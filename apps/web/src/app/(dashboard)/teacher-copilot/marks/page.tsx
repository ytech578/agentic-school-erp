"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Save, CheckCircle2, AlertTriangle, Loader2, ArrowLeft, 
  Users, Sparkles, Check, ExternalLink, Info
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface StudentItem {
  studentId: string;
  rollNumber: string;
  name: string;
  mark?: {
    marksObtained?: number | null;
    isAbsent?: boolean;
    grade?: string;
    remarks?: string;
  } | null;
}

interface ExamSubjectItem {
  id: string;
  classId?: string;
  subjectId: string;
  maxMarks: number;
  passMarks: number;
  subject?: { id: string; name: string; code?: string };
}

// Grade calculation according to standard school scale
function getGrade(score: number, max: number): { grade: string; color: string; bg: string } {
  if (max <= 0) return { grade: "-", color: "var(--text-tertiary)", bg: "var(--bg-app)" };
  const pct = (score / max) * 100;
  if (pct >= 90) return { grade: "A+", color: "#059669", bg: "#ECFDF5" };
  if (pct >= 80) return { grade: "A", color: "#10B981", bg: "#D1FAE5" };
  if (pct >= 70) return { grade: "B", color: "#2563EB", bg: "#EFF6FF" };
  if (pct >= 60) return { grade: "C", color: "#0891B2", bg: "#ECFEFF" };
  if (pct >= 50) return { grade: "D", color: "#D97706", bg: "#FFFBEB" };
  if (pct >= 35) return { grade: "E", color: "#EA580C", bg: "#FFF7ED" };
  return { grade: "F", color: "#DC2626", bg: "#FEF2F2" };
}

export default function BulkMarksEntryPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [examSubjects, setExamSubjects] = useState<ExamSubjectItem[]>([]);
  const [selectedExamSubjectId, setSelectedExamSubjectId] = useState("");

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [marksData, setMarksData] = useState<Record<string, { marksObtained: string; isAbsent: boolean; remarks: string }>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // References for keyboard navigation (Enter / Down arrow moves to next row)
  const markInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [examsRes, classesRes] = await Promise.all([
        apiClient.get("/exams"),
        apiClient.get("/classes"),
      ]);
      setExams(examsRes.data?.data || examsRes.data || []);
      setClasses(classesRes.data?.data || classesRes.data || []);
    } catch (e) {
      console.error("Failed to fetch initial bulk marks data:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchExamSubjects = async (examId: string) => {
    if (!examId) {
      setExamSubjects([]);
      return;
    }
    try {
      const res = await apiClient.get(`/exams/${examId}`);
      const data = res.data?.data || res.data;
      setExamSubjects(data.subjects || []);
    } catch (e) {
      console.error("Failed to fetch exam subjects:", e);
    }
  };

  useEffect(() => {
    fetchExamSubjects(selectedExamId);
    setSelectedExamSubjectId("");
    setStudents([]);
    setMarksData({});
    setHasUnsavedChanges(false);
  }, [selectedExamId]);

  const handleFetchStudents = async () => {
    if (!selectedExamId || !selectedExamSubjectId || !selectedSectionId) return;
    setFetchingStudents(true);
    setMessage(null);
    try {
      const res = await apiClient.get(
        `/exams/${selectedExamId}/subjects/${selectedExamSubjectId}/students`,
        { params: { sectionId: selectedSectionId } }
      );
      const data = res.data?.data || res.data;
      const studentList: StudentItem[] = data.students || [];
      setStudents(studentList);
      
      const initialMarks: Record<string, { marksObtained: string; isAbsent: boolean; remarks: string }> = {};
      studentList.forEach((s) => {
        initialMarks[s.studentId] = {
          marksObtained: s.mark?.marksObtained !== null && s.mark?.marksObtained !== undefined ? s.mark.marksObtained.toString() : "",
          isAbsent: s.mark?.isAbsent ?? false,
          remarks: s.mark?.remarks || "",
        };
      });
      setMarksData(initialMarks);
      setHasUnsavedChanges(false);
      markInputsRef.current = new Array(studentList.length).fill(null);
    } catch (e: any) {
      console.error(e);
      setMessage({ type: "error", text: e.response?.data?.message || "Failed to fetch student roster." });
    } finally {
      setFetchingStudents(false);
    }
  };

  const handleSaveMarks = async () => {
    if (!selectedExamId || !selectedExamSubjectId) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = Object.entries(marksData).map(([studentId, data]) => ({
        studentId,
        marksObtained: data.isAbsent 
          ? undefined 
          : data.marksObtained !== "" && !isNaN(parseFloat(data.marksObtained))
          ? parseFloat(data.marksObtained)
          : undefined,
        isAbsent: data.isAbsent,
        remarks: data.remarks || undefined,
      }));

      await apiClient.post(
        `/exams/${selectedExamId}/subjects/${selectedExamSubjectId}/marks`,
        { marks: payload }
      );
      setMessage({ type: "success", text: "All marks saved and report cards updated successfully!" });
      setHasUnsavedChanges(false);
    } catch (e: any) {
      console.error(e);
      setMessage({ type: "error", text: e.response?.data?.message || "Failed to save marks." });
    } finally {
      setSaving(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const sections = selectedClass?.sections || [];
  
  // Available subjects for selected class (allow general subjects where classId is not set or default)
  const availableSubjects = useMemo(() => {
    return examSubjects.filter((es) => {
      if (!selectedClassId) return true;
      return !es.classId || es.classId === "default" || es.classId === selectedClassId;
    });
  }, [examSubjects, selectedClassId]);

  const currentSubjectInfo = availableSubjects.find((es) => es.id === selectedExamSubjectId);
  const maxMarks = currentSubjectInfo ? Number(currentSubjectInfo.maxMarks) : 100;
  const passMarks = currentSubjectInfo ? Number(currentSubjectInfo.passMarks) : 35;

  // Real-Time Analytics / Statistics
  const stats = useMemo(() => {
    if (!students.length) return null;
    let totalObtained = 0;
    let scoredCount = 0;
    let highest = -Infinity;
    let lowest = Infinity;
    let passedCount = 0;
    let absentCount = 0;

    students.forEach((s) => {
      const entry = marksData[s.studentId];
      if (!entry) return;
      if (entry.isAbsent) {
        absentCount++;
      } else if (entry.marksObtained !== "" && !isNaN(parseFloat(entry.marksObtained))) {
        const val = parseFloat(entry.marksObtained);
        scoredCount++;
        totalObtained += val;
        if (val > highest) highest = val;
        if (val < lowest) lowest = val;
        if (val >= passMarks) passedCount++;
      }
    });

    const average = scoredCount > 0 ? (totalObtained / scoredCount).toFixed(1) : "-";
    const passPercentage = scoredCount > 0 ? ((passedCount / scoredCount) * 100).toFixed(1) : "-";

    return {
      total: students.length,
      scoredCount,
      absentCount,
      average,
      highest: highest === -Infinity ? "-" : highest,
      lowest: lowest === Infinity ? "-" : lowest,
      passPercentage,
    };
  }, [students, marksData, passMarks]);

  // Quick Action: Mark All Present
  const handleMarkAllPresent = () => {
    setMarksData((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = { ...next[id], isAbsent: false };
      });
      return next;
    });
    setHasUnsavedChanges(true);
  };

  // Quick Action: Mark Remaining as Absent
  const handleMarkRemainingAbsent = () => {
    setMarksData((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (!next[id].marksObtained && !next[id].isAbsent) {
          next[id] = { ...next[id], isAbsent: true };
        }
      });
      return next;
    });
    setHasUnsavedChanges(true);
  };

  // Quick Action: Fill Passing Marks
  const handleFillPassMarks = () => {
    setMarksData((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (!next[id].marksObtained && !next[id].isAbsent) {
          next[id] = { ...next[id], marksObtained: passMarks.toString() };
        }
      });
      return next;
    });
    setHasUnsavedChanges(true);
  };

  // Keyboard navigation handler (Enter or Down arrow jumps to next student row)
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (index + 1 < students.length && markInputsRef.current[index + 1]) {
        markInputsRef.current[index + 1]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index - 1 >= 0 && markInputsRef.current[index - 1]) {
        markInputsRef.current[index - 1]?.focus();
      }
    }
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.75rem", paddingBottom: students.length > 0 ? "5rem" : "2rem" }}>
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
            <span style={{ color: "var(--brand-primary)", fontSize: "var(--text-xs)", fontWeight: 600 }}>Bulk Marks</span>
          </div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <CheckCircle2 size={26} style={{ color: "var(--brand-primary)" }} />
            Bulk Marks Entry
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: "0.25rem" }}>
            Select an exam, class, and subject to rapidly record and grade student assessments with live validation.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link
            href="/exams"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 1.125rem",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <ExternalLink size={16} />
            Exam Management
          </Link>
        </div>
      </div>

      {/* Filter Selector Card */}
      <div style={{
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-2xl)",
        padding: "1.5rem 1.75rem",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-card)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        alignItems: "flex-end",
      }}>
        {/* Exam Select */}
        <div>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            Select Exam *
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
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
            <option value="">-- Choose Exam --</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.examType?.replace(/_/g, " ")})</option>
            ))}
          </select>
        </div>

        {/* Class Select */}
        <div>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            Select Class *
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setSelectedSectionId("");
              setSelectedExamSubjectId("");
              setStudents([]);
            }}
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
            <option value="">-- Choose Class --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Section Select */}
        <div>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            Select Section *
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => {
              setSelectedSectionId(e.target.value);
              setStudents([]);
            }}
            disabled={!selectedClassId}
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-app)",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              outline: "none",
              opacity: !selectedClassId ? 0.6 : 1,
            }}
          >
            <option value="">-- Choose Section --</option>
            {sections.map((s: any) => (
              <option key={s.id} value={s.id}>Section {s.name}</option>
            ))}
          </select>
        </div>

        {/* Subject Select */}
        <div>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            Exam Subject *
          </label>
          <select
            value={selectedExamSubjectId}
            onChange={(e) => {
              setSelectedExamSubjectId(e.target.value);
              setStudents([]);
            }}
            disabled={!selectedExamId}
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-app)",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              outline: "none",
              opacity: !selectedExamId ? 0.6 : 1,
            }}
          >
            <option value="">-- Choose Subject --</option>
            {availableSubjects.map((es) => (
              <option key={es.id} value={es.id}>
                {es.subject?.name || "Subject"} (Max: {es.maxMarks}, Pass: {es.passMarks})
              </option>
            ))}
          </select>
        </div>

        {/* Load Students Button */}
        <div>
          <Button
            onClick={handleFetchStudents}
            disabled={!selectedExamId || !selectedClassId || !selectedSectionId || !selectedExamSubjectId || fetchingStudents}
            style={{
              width: "100%",
              padding: "0.65rem 1rem",
              borderRadius: "var(--radius-lg)",
              fontWeight: 600,
            }}
            leftIcon={fetchingStudents ? <Loader2 className="animate-spin" size={16} /> : <Users size={16} />}
          >
            {fetchingStudents ? "Loading..." : "Load Students"}
          </Button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius-xl)",
          background: message.type === "success" ? "var(--success-light)" : "var(--danger-light)",
          color: message.type === "success" ? "var(--success-dark)" : "var(--danger-dark)",
          border: `1px solid ${message.type === "success" ? "var(--success)" : "var(--danger)"}`,
          fontSize: "var(--text-sm)",
          fontWeight: 600,
        }}>
          {message.type === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Active Students Assessment Table & Live Analytics */}
      {students.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Live Performance KPI Bar */}
          {stats && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.875rem",
            }}>
              <div style={{ background: "var(--bg-surface)", padding: "1rem 1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Class Average</div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--brand-primary)", marginTop: "0.125rem" }}>
                  {stats.average} <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 500 }}>/ {maxMarks}</span>
                </div>
              </div>

              <div style={{ background: "var(--bg-surface)", padding: "1rem 1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Pass Rate</div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--success)", marginTop: "0.125rem" }}>
                  {stats.passPercentage}%
                </div>
              </div>

              <div style={{ background: "var(--bg-surface)", padding: "1rem 1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Top Score</div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.125rem" }}>
                  {stats.highest} <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 500 }}>pts</span>
                </div>
              </div>

              <div style={{ background: "var(--bg-surface)", padding: "1rem 1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Lowest Score</div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.125rem" }}>
                  {stats.lowest} <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 500 }}>pts</span>
                </div>
              </div>

              <div style={{ background: "var(--bg-surface)", padding: "1rem 1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>Attendance</div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.35rem" }}>
                  {stats.total - stats.absentCount} Present · <span style={{ color: "var(--danger)" }}>{stats.absentCount} Absent</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Tools Bar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            background: "var(--bg-surface)",
            padding: "0.75rem 1.25rem",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-default)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)" }}>
                Quick Batch Actions:
              </span>
              <button
                type="button"
                onClick={handleMarkAllPresent}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-app)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={handleMarkRemainingAbsent}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-app)",
                  color: "var(--danger)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Mark Empty as Absent
              </button>
              <button
                type="button"
                onClick={handleFillPassMarks}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-app)",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Auto-fill Pass Mark ({passMarks})
              </button>
            </div>

            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <Info size={14} /> Tip: Press <kbd style={{ background: "var(--bg-app)", padding: "0.1rem 0.3rem", borderRadius: "3px", border: "1px solid var(--border-default)" }}>Enter</kbd> or <kbd style={{ background: "var(--bg-app)", padding: "0.1rem 0.3rem", borderRadius: "3px", border: "1px solid var(--border-default)" }}>↓</kbd> to jump to next student.
            </div>
          </div>

          {/* Table Container */}
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-2xl)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface-hover)", borderBottom: "1px solid var(--border-default)" }}>
                    <th style={{ padding: "0.875rem 1rem", width: "70px", textAlign: "center", color: "var(--text-secondary)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                      Roll
                    </th>
                    <th style={{ padding: "0.875rem 1rem", color: "var(--text-secondary)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                      Student Name
                    </th>
                    <th style={{ padding: "0.875rem 1rem", width: "140px", color: "var(--text-secondary)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                      Marks / {maxMarks}
                    </th>
                    <th style={{ padding: "0.875rem 1rem", width: "100px", textAlign: "center", color: "var(--text-secondary)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                      Grade
                    </th>
                    <th style={{ padding: "0.875rem 1rem", width: "110px", textAlign: "center", color: "var(--text-secondary)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                      Absent?
                    </th>
                    <th style={{ padding: "0.875rem 1rem", color: "var(--text-secondary)", fontWeight: 700, fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                      Teacher Remarks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => {
                    const entry = marksData[s.studentId] || { marksObtained: "", isAbsent: false, remarks: "" };
                    const markNum = parseFloat(entry.marksObtained);
                    const isExceeding = !isNaN(markNum) && (markNum > maxMarks || markNum < 0);
                    const gradeInfo = !entry.isAbsent && !isNaN(markNum) 
                      ? getGrade(markNum, maxMarks) 
                      : entry.isAbsent 
                      ? { grade: "ABS", color: "var(--danger)", bg: "var(--danger-light)" } 
                      : { grade: "-", color: "var(--text-tertiary)", bg: "var(--bg-app)" };

                    return (
                      <tr
                        key={s.studentId}
                        style={{
                          borderBottom: "1px solid var(--border-default)",
                          background: entry.isAbsent ? "rgba(239, 68, 68, 0.03)" : idx % 2 === 0 ? "var(--bg-surface)" : "var(--bg-app)",
                          opacity: entry.isAbsent ? 0.75 : 1,
                          transition: "background var(--duration-fast)",
                        }}
                      >
                        {/* Roll Number */}
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>
                          {s.rollNumber || `${idx + 1}`}
                        </td>

                        {/* Student Name */}
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: "var(--brand-blue-subtle)",
                              color: "var(--brand-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "var(--text-xs)",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}>
                              {s.name?.slice(0, 2)?.toUpperCase() || "ST"}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                {s.name || "Student"}
                              </div>
                              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                                ID: {s.studentId.slice(-6)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Marks Input */}
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div style={{ position: "relative" }}>
                            <input
                              ref={(el) => { markInputsRef.current[idx] = el; }}
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.5"
                              placeholder={`0 - ${maxMarks}`}
                              disabled={entry.isAbsent}
                              value={entry.marksObtained}
                              onKeyDown={(e) => handleKeyDown(idx, e)}
                              onChange={(e) => {
                                setMarksData((prev) => ({
                                  ...prev,
                                  [s.studentId]: { ...prev[s.studentId], marksObtained: e.target.value }
                                }));
                                setHasUnsavedChanges(true);
                              }}
                              style={{
                                width: "100%",
                                padding: "0.5rem 0.65rem",
                                borderRadius: "var(--radius-md)",
                                border: isExceeding ? "2px solid var(--danger)" : "1px solid var(--border-default)",
                                backgroundColor: entry.isAbsent ? "var(--bg-app)" : "var(--bg-surface)",
                                color: isExceeding ? "var(--danger)" : "var(--text-primary)",
                                fontSize: "var(--text-sm)",
                                fontWeight: 700,
                                outline: "none",
                              }}
                            />
                            {isExceeding && (
                              <span style={{ fontSize: "0.65rem", color: "var(--danger)", display: "block", marginTop: "0.2rem", fontWeight: 600 }}>
                                Max: {maxMarks}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Live Grade Badge */}
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "0.25rem 0.6rem",
                            borderRadius: "var(--radius-full)",
                            fontWeight: 800,
                            fontSize: "var(--text-xs)",
                            color: gradeInfo.color,
                            background: gradeInfo.bg,
                            minWidth: "42px",
                          }}>
                            {gradeInfo.grade}
                          </span>
                        </td>

                        {/* Absent Checkbox */}
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                          <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", gap: "0.25rem" }}>
                            <input
                              type="checkbox"
                              checked={entry.isAbsent}
                              onChange={(e) => {
                                setMarksData((prev) => ({
                                  ...prev,
                                  [s.studentId]: {
                                    ...prev[s.studentId],
                                    isAbsent: e.target.checked,
                                    marksObtained: e.target.checked ? "" : prev[s.studentId]?.marksObtained || ""
                                  }
                                }));
                                setHasUnsavedChanges(true);
                              }}
                              style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "var(--danger)" }}
                            />
                            <span style={{ fontSize: "var(--text-xs)", color: entry.isAbsent ? "var(--danger)" : "var(--text-secondary)", fontWeight: 600 }}>
                              {entry.isAbsent ? "Absent" : ""}
                            </span>
                          </label>
                        </td>

                        {/* Remarks Input */}
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <input
                            type="text"
                            placeholder="Optional remark (e.g. Excellent work, Needs revision)..."
                            value={entry.remarks}
                            onChange={(e) => {
                              setMarksData((prev) => ({
                                ...prev,
                                [s.studentId]: { ...prev[s.studentId], remarks: e.target.value }
                              }));
                              setHasUnsavedChanges(true);
                            }}
                            style={{
                              width: "100%",
                              padding: "0.45rem 0.65rem",
                              borderRadius: "var(--radius-md)",
                              border: "1px solid var(--border-default)",
                              backgroundColor: "var(--bg-app)",
                              color: "var(--text-primary)",
                              fontSize: "var(--text-xs)",
                              outline: "none",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sticky Bottom Save Bar */}
          <div style={{
            position: "fixed",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 4rem)",
            maxWidth: "1280px",
            background: "var(--bg-surface-solid)",
            backgroundColor: "var(--bg-surface-solid)",
            opacity: 1,
            borderRadius: "var(--radius-2xl)",
            padding: "0.875rem 1.5rem",
            border: "1px solid var(--border-default)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
            zIndex: 100,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: hasUnsavedChanges ? "var(--warning)" : "var(--success)",
              }} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                {hasUnsavedChanges ? "Unsaved Changes Pending" : "All Marks Synchronized"}
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                ({students.length} students rostered)
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={handleFetchStudents}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-app)",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset / Reload
              </button>

              <Button
                onClick={handleSaveMarks}
                disabled={saving}
                style={{
                  padding: "0.5rem 1.5rem",
                  borderRadius: "var(--radius-lg)",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #059669 0%, #0891B2 100%)",
                  boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
                }}
                leftIcon={saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              >
                {saving ? "Saving Marks..." : "Save All Marks"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
