"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  BookOpen,
  Layers,
  Sparkles,
  Plus,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Check,
  X,
  GraduationCap,
  Users,
  ChevronRight,
  FileSpreadsheet,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";

interface Board {
  id: string;
  code: string;
  name: string;
  category: "CBSE" | "CISCE" | "STATE";
  stateCode: string | null;
  country: string;
  description: string | null;
  curriculums: Curriculum[];
}

interface Curriculum {
  id: string;
  code: string;
  name: string;
  version: string;
  description: string | null;
  boardId: string;
}

interface SchoolSubjectOffering {
  id: string;
  schoolId: string;
  curriculumId: string;
  academicYearId: string;
  curriculumSubjectId: string | null;
  globalSubjectId: string;
  legacySubjectId: string | null;
  customName: string | null;
  customCode: string | null;
  source: "CURRICULUM" | "SCHOOL_CUSTOM";
  gradeFrom: number;
  gradeTo: number;
  periodsPerWeek: number;
  isOffered: boolean;
  subjectType: string;
  selectionType: string;
  theoryEnabled: boolean;
  practicalEnabled: boolean;
  internalAssessmentEnabled: boolean;
  examEnabled: boolean;
  maxMarks: number;
  passMarks: number;
  globalSubject: { id: string; name: string; code: string; category: string };
  curriculumSubject?: {
    id: string;
    displayName: string;
    subjectCode: string;
    subjectGroup?: { id: string; name: string; code: string };
  };
}

interface CurriculumSummary {
  schoolName: string;
  board: Board | null;
  curriculum: Curriculum | null;
  totalOfferings: number;
  customOfferingsCount: number;
  gradeOfferingsCount: Record<number, number>;
  isConfigured: boolean;
}

export function CurriculumManager({ onToast }: { onToast?: (msg: string, type: "success" | "error") => void }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CurriculumSummary | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [offerings, setOfferings] = useState<SchoolSubjectOffering[]>([]);
  const [classList, setClassList] = useState<any[]>([]);

  // Sub-Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<"OFFERINGS" | "CLASS_MAPPING" | "STUDENT_ELECTIVES">("OFFERINGS");

  // Selection states for Offerings Matrix
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // States for Student Electives
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [sectionData, setSectionData] = useState<any>(null);
  const [loadingSection, setLoadingSection] = useState(false);
  const [syncingClassId, setSyncingClassId] = useState<string | null>(null);

  // Modals
  const [initModalOpen, setInitModalOpen] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  // Custom subject form
  const [customForm, setCustomForm] = useState({
    customName: "",
    customCode: "",
    subjectType: "ADDITIONAL",
    selectionType: "MANDATORY",
    gradeFrom: 6,
    gradeTo: 8,
    periodsPerWeek: 2,
    theoryEnabled: true,
    practicalEnabled: false,
    internalAssessmentEnabled: false,
    examEnabled: true,
    maxMarks: 50,
    passMarks: 18,
  });

  const triggerToast = (text: string, type: "success" | "error" = "success") => {
    if (onToast) onToast(text, type);
  };

  // ── Fetch Initial Data ───────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, boardsRes, offRes, classesRes] = await Promise.all([
        apiClient.get("/curriculum/summary"),
        apiClient.get("/curriculum/boards"),
        apiClient.get("/curriculum/school-offerings"),
        apiClient.get("/classes"),
      ]);

      const sumData = sumRes.data?.data || sumRes.data;
      const rawBoards = boardsRes.data?.data || boardsRes.data;
      const boardsData: Board[] = Array.isArray(rawBoards) ? rawBoards : [];
      const rawOfferings = offRes.data?.data || offRes.data;
      const offData: SchoolSubjectOffering[] = Array.isArray(rawOfferings) ? rawOfferings : [];
      const classesData = classesRes.data?.data || classesRes.data || [];

      setSummary(sumData);
      setBoards(boardsData);
      setOfferings(offData);
      setClassList(classesData);

      if (classesData.length > 0 && !selectedClassId) {
        setSelectedClassId(classesData[0].id);
        if (classesData[0].sections?.length > 0) {
          setSelectedSectionId(classesData[0].sections[0].id);
        }
      }

      if (sumData?.board?.id) {
        setSelectedBoardId(sumData.board.id);
        const currList = boardsData.find((b: Board) => b.id === sumData.board.id)?.curriculums || [];
        setCurriculums(currList);
      }
      if (sumData?.curriculum?.id) {
        setSelectedCurriculumId(sumData.curriculum.id);
      }
    } catch (err) {
      console.error("Failed to load curriculum data:", err);
      triggerToast("Failed to load curriculum configuration", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load section students for elective enrollment
  const fetchSectionStudents = useCallback(async (secId: string) => {
    if (!secId) return;
    setLoadingSection(true);
    try {
      const res = await apiClient.get(`/curriculum/sections/${secId}/student-enrollments`);
      setSectionData(res.data?.data || res.data);
    } catch {
      triggerToast("Failed to load section students", "error");
    } finally {
      setLoadingSection(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSectionId && activeSubTab === "STUDENT_ELECTIVES") {
      fetchSectionStudents(selectedSectionId);
    }
  }, [selectedSectionId, activeSubTab, fetchSectionStudents]);

  // When board selection changes in the dropdown
  const handleBoardChange = (boardId: string) => {
    setSelectedBoardId(boardId);
    const board = boards.find((b) => b.id === boardId);
    const currs = board?.curriculums || [];
    setCurriculums(currs);
    if (currs.length > 0) {
      setSelectedCurriculumId(currs[0].id);
    } else {
      setSelectedCurriculumId("");
    }
  };

  // ── Load Recommended Curriculum ──────────────────────────────────
  const handleLoadRecommended = async () => {
    if (!selectedBoardId || !selectedCurriculumId) {
      triggerToast("Please select a Board and Curriculum version", "error");
      return;
    }
    setInitializing(true);
    try {
      const res = await apiClient.post("/curriculum/initialize-school", {
        boardId: selectedBoardId,
        curriculumId: selectedCurriculumId,
      });

      triggerToast(res.data?.message || "Recommended curriculum loaded successfully!", "success");
      setInitModalOpen(false);
      await fetchData();
    } catch (err: any) {
      triggerToast(err?.response?.data?.message || "Failed to initialize curriculum", "error");
    } finally {
      setInitializing(false);
    }
  };

  // ── Toggle Offering Status ───────────────────────────────────────
  const handleToggleOffering = async (offering: SchoolSubjectOffering) => {
    try {
      const newStatus = !offering.isOffered;
      await apiClient.patch(`/curriculum/school-offerings/${offering.id}`, {
        isOffered: newStatus,
      });

      setOfferings((prev) =>
        prev.map((o) => (o.id === offering.id ? { ...o, isOffered: newStatus } : o))
      );
      triggerToast(
        `Subject "${offering.curriculumSubject?.displayName || offering.globalSubject.name}" ${newStatus ? "enabled" : "deactivated"}`,
        "success"
      );
    } catch {
      triggerToast("Failed to update offering status", "error");
    }
  };

  // ── Update Periods Per Week ──────────────────────────────────────
  const handleUpdatePeriods = async (id: string, periods: number) => {
    if (periods < 1 || periods > 20) return;
    try {
      await apiClient.patch(`/curriculum/school-offerings/${id}`, {
        periodsPerWeek: periods,
      });
      setOfferings((prev) =>
        prev.map((o) => (o.id === id ? { ...o, periodsPerWeek: periods } : o))
      );
    } catch {
      triggerToast("Failed to update periods", "error");
    }
  };

  // ── Add Custom Subject ───────────────────────────────────────────
  const handleCreateCustomSubject = async () => {
    if (!customForm.customName) {
      triggerToast("Subject name is required", "error");
      return;
    }
    setSavingCustom(true);
    try {
      await apiClient.post("/curriculum/school-offerings", {
        source: "SCHOOL_CUSTOM",
        customName: customForm.customName,
        customCode: customForm.customCode || undefined,
        gradeFrom: Number(customForm.gradeFrom),
        gradeTo: Number(customForm.gradeTo),
        periodsPerWeek: Number(customForm.periodsPerWeek),
        subjectType: customForm.subjectType,
        selectionType: customForm.selectionType,
        theoryEnabled: customForm.theoryEnabled,
        practicalEnabled: customForm.practicalEnabled,
        internalAssessmentEnabled: customForm.internalAssessmentEnabled,
        examEnabled: customForm.examEnabled,
        maxMarks: Number(customForm.maxMarks),
        passMarks: Number(customForm.passMarks),
      });

      triggerToast(`Custom subject "${customForm.customName}" created!`, "success");
      setCustomModalOpen(false);
      setCustomForm({
        customName: "",
        customCode: "",
        subjectType: "ADDITIONAL",
        selectionType: "MANDATORY",
        gradeFrom: 6,
        gradeTo: 8,
        periodsPerWeek: 2,
        theoryEnabled: true,
        practicalEnabled: false,
        internalAssessmentEnabled: false,
        examEnabled: true,
        maxMarks: 50,
        passMarks: 18,
      });
      await fetchData();
    } catch (err: any) {
      triggerToast(err?.response?.data?.message || "Failed to add custom subject", "error");
    } finally {
      setSavingCustom(false);
    }
  };

  // ── Toggle Student Elective Offering ─────────────────────────────
  const handleToggleStudentOffering = async (studentId: string, offeringId: string, currentEnrolled: string[]) => {
    const isEnrolled = currentEnrolled.includes(offeringId);
    const newOfferingIds = isEnrolled
      ? currentEnrolled.filter((id) => id !== offeringId)
      : [...currentEnrolled, offeringId];

    try {
      await apiClient.post(`/curriculum/students/${studentId}/enrollments`, {
        offeringIds: newOfferingIds,
      });
      setSectionData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          students: prev.students.map((s: any) =>
            s.id === studentId ? { ...s, enrolledOfferingIds: newOfferingIds } : s
          ),
        };
      });
      triggerToast("Student subject enrollment updated", "success");
    } catch (e: any) {
      triggerToast(e?.response?.data?.message || "Failed to update enrollment", "error");
    }
  };

  // ── Sync Class Subjects ──────────────────────────────────────────
  const handleSyncClassSubjects = async (classId: string) => {
    setSyncingClassId(classId);
    try {
      const res = await apiClient.post(`/curriculum/classes/${classId}/sync-subjects`);
      triggerToast(res.data?.data?.message || res.data?.message || "Class subjects synced successfully!", "success");
      await fetchData();
    } catch {
      triggerToast("Failed to sync class subjects", "error");
    } finally {
      setSyncingClassId(null);
    }
  };

  // ── Filtering Offerings for Active View ───────────────────────────
  const safeOfferings = Array.isArray(offerings) ? offerings : [];

  const filteredOfferings = safeOfferings.filter((o) => {
    const matchesGrade = o.gradeFrom <= selectedGrade && o.gradeTo >= selectedGrade;
    const groupName = o.curriculumSubject?.subjectGroup?.name || "General";
    const matchesGroup = selectedGroup === "ALL" || groupName.toLowerCase().includes(selectedGroup.toLowerCase());
    const name = (o.curriculumSubject?.displayName || o.customName || o.globalSubject?.name || "").toLowerCase();
    const code = (o.curriculumSubject?.subjectCode || o.customCode || o.globalSubject?.code || "").toLowerCase();
    const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || code.includes(searchQuery.toLowerCase());
    return matchesGrade && matchesGroup && matchesSearch;
  });

  const availableGroups = Array.from(
    new Set(
      safeOfferings
        .filter((o) => o.gradeFrom <= selectedGrade && o.gradeTo >= selectedGrade)
        .map((o) => o.curriculumSubject?.subjectGroup?.name || "Core Subjects")
    )
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* ── Summary & Board Card ─────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          padding: "1.75rem",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, var(--brand-primary), #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
              }}
            >
              <BookOpen size={24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)" }}>
                  Curriculum & Board Configuration
                </h3>
                {summary?.isConfigured && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      background: "rgba(16, 185, 129, 0.12)",
                      color: "var(--success)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.6rem",
                      borderRadius: "var(--radius-full)",
                    }}
                  >
                    <CheckCircle2 size={12} /> Active Framework
                  </span>
                )}
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Select your board (CBSE, CISCE/ICSE, AP SSC, TS SSC), load standard Classes 1–10 subjects, and customize offerings.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Plus size={15} /> Add Custom Subject
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setInitModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "linear-gradient(135deg, var(--brand-primary), #6366f1)",
              }}
            >
              <Sparkles size={15} /> Load Recommended Curriculum
            </Button>
          </div>
        </div>

        {/* ── Active Board & Curriculum Selectors ──────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
            padding: "1.25rem",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-app)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.4rem" }}>
              Board / Affiliation
            </label>
            <select
              value={selectedBoardId}
              onChange={(e) => handleBoardChange(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <option value="" disabled>Select Board</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.category}{b.stateCode ? ` - ${b.stateCode}` : ""})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.4rem" }}>
              Curriculum Version
            </label>
            <select
              value={selectedCurriculumId}
              onChange={(e) => setSelectedCurriculumId(e.target.value)}
              disabled={curriculums.length === 0}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <option value="" disabled>Select Version</option>
              {curriculums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.version})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
              Active Curriculum Status
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                {safeOfferings.filter((o) => o.isOffered).length} Active Subjects
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>•</span>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--brand-primary)" }}>
                {summary?.customOfferingsCount || 0} Custom
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ─────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "0.5rem" }}>
        <button
          onClick={() => setActiveSubTab("OFFERINGS")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1rem",
            borderRadius: "var(--radius-lg)",
            border: "none",
            cursor: "pointer",
            background: activeSubTab === "OFFERINGS" ? "var(--brand-primary)" : "transparent",
            color: activeSubTab === "OFFERINGS" ? "#fff" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "var(--text-sm)",
            transition: "all 0.15s ease",
          }}
        >
          <BookOpen size={16} /> Subject Offerings Matrix
        </button>
        <button
          onClick={() => setActiveSubTab("CLASS_MAPPING")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1rem",
            borderRadius: "var(--radius-lg)",
            border: "none",
            cursor: "pointer",
            background: activeSubTab === "CLASS_MAPPING" ? "var(--brand-primary)" : "transparent",
            color: activeSubTab === "CLASS_MAPPING" ? "#fff" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "var(--text-sm)",
            transition: "all 0.15s ease",
          }}
        >
          <Layers size={16} /> Class Subject Mapping & Sync
        </button>
        <button
          onClick={() => setActiveSubTab("STUDENT_ELECTIVES")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1rem",
            borderRadius: "var(--radius-lg)",
            border: "none",
            cursor: "pointer",
            background: activeSubTab === "STUDENT_ELECTIVES" ? "var(--brand-primary)" : "transparent",
            color: activeSubTab === "STUDENT_ELECTIVES" ? "#fff" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "var(--text-sm)",
            transition: "all 0.15s ease",
          }}
        >
          <Users size={16} /> Student Elective Enrollments
        </button>
      </div>

      {/* ── TAB 1: SUBJECT OFFERINGS MATRIX ──────────────────────── */}
      {activeSubTab === "OFFERINGS" && (
        <>
          {/* Grade Level Selector & Filter Bar */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xl)",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Select Academic Grade (Classes 1–10)
                </h4>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ position: "relative", minWidth: "220px" }}>
                  <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                  <input
                    type="text"
                    placeholder="Search subject or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.75rem 0.45rem 2.2rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-app)",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Grade Tabs (1 to 10) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                overflowX: "auto",
                paddingBottom: "0.25rem",
              }}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((grade) => {
                const isSelected = selectedGrade === grade;
                const countForGrade = safeOfferings.filter(
                  (o) => o.isOffered && o.gradeFrom <= grade && o.gradeTo >= grade
                ).length;

                return (
                  <button
                    key={grade}
                    onClick={() => {
                      setSelectedGrade(grade);
                      setSelectedGroup("ALL");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 0.85rem",
                      borderRadius: "var(--radius-lg)",
                      border: isSelected ? "1px solid var(--brand-primary)" : "1px solid var(--border-default)",
                      background: isSelected ? "rgba(99, 102, 241, 0.1)" : "var(--bg-app)",
                      color: isSelected ? "var(--brand-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "var(--text-sm)",
                      fontWeight: isSelected ? 700 : 500,
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Class {grade}
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.1rem 0.45rem",
                        borderRadius: "var(--radius-full)",
                        background: isSelected ? "var(--brand-primary)" : "var(--border-default)",
                        color: isSelected ? "#fff" : "var(--text-secondary)",
                        fontWeight: 700,
                      }}
                    >
                      {countForGrade}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Group Filter Pills */}
            {availableGroups.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid var(--border-light)" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Filter Group:
                </span>
                <button
                  onClick={() => setSelectedGroup("ALL")}
                  style={{
                    padding: "0.25rem 0.65rem",
                    borderRadius: "var(--radius-full)",
                    border: "none",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: selectedGroup === "ALL" ? "var(--brand-primary)" : "var(--bg-app)",
                    color: selectedGroup === "ALL" ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  All Subjects
                </button>
                {availableGroups.map((grp) => (
                  <button
                    key={grp}
                    onClick={() => setSelectedGroup(grp)}
                    style={{
                      padding: "0.25rem 0.65rem",
                      borderRadius: "var(--radius-full)",
                      border: "none",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: selectedGroup === grp ? "var(--brand-primary)" : "var(--bg-app)",
                      color: selectedGroup === grp ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {grp}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subjects Offerings Table */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h4 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                  Subject Offerings for Class {selectedGrade}
                </h4>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  Toggle subjects to activate/deactivate school offering, adjust periods per week and assessment rules.
                </p>
              </div>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)" }}>
                Showing {filteredOfferings.length} subjects
              </span>
            </div>

            {filteredOfferings.length === 0 ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                <FileSpreadsheet size={40} style={{ margin: "0 auto 1rem", color: "var(--text-tertiary)", opacity: 0.6 }} />
                <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--text-base)" }}>
                  No subjects found for Class {selectedGrade}
                </p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                  Load the recommended curriculum template above or add a custom school subject.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ padding: "0.85rem 1.25rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Subject & Code
                      </th>
                      <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Group / Category
                      </th>
                      <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Selection Type
                      </th>
                      <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Periods / Wk
                      </th>
                      <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Assessment Breakdown
                      </th>
                      <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Source
                      </th>
                      <th style={{ padding: "0.85rem 1.25rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>
                        Offering Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOfferings.map((offering) => {
                      const displayName =
                        offering.curriculumSubject?.displayName || offering.customName || offering.globalSubject?.name;
                      const code =
                        offering.curriculumSubject?.subjectCode || offering.customCode || offering.globalSubject?.code;
                      const groupName =
                        offering.curriculumSubject?.subjectGroup?.name ||
                        (offering.source === "SCHOOL_CUSTOM" ? "School Additional" : "Core Academic");

                      const isCustom = offering.source === "SCHOOL_CUSTOM";

                      return (
                        <tr
                          key={offering.id}
                          style={{
                            borderBottom: "1px solid var(--border-light)",
                            opacity: offering.isOffered ? 1 : 0.5,
                            transition: "background 0.15s ease",
                          }}
                        >
                          <td style={{ padding: "0.85rem 1.25rem" }}>
                            <div>
                              <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                                {displayName}
                              </p>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                                Code: {code}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: "0.85rem 1rem" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.55rem",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: "var(--bg-app)",
                                border: "1px solid var(--border-light)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {groupName}
                            </span>
                          </td>

                          <td style={{ padding: "0.85rem 1rem" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.55rem",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                letterSpacing: "0.03em",
                                textTransform: "uppercase",
                                background:
                                  offering.selectionType === "MANDATORY"
                                    ? "rgba(16, 185, 129, 0.1)"
                                    : offering.selectionType === "ELECTIVE"
                                    ? "rgba(99, 102, 241, 0.1)"
                                    : "rgba(245, 158, 11, 0.1)",
                                color:
                                  offering.selectionType === "MANDATORY"
                                    ? "var(--success)"
                                    : offering.selectionType === "ELECTIVE"
                                    ? "var(--brand-primary)"
                                    : "var(--warning)",
                              }}
                            >
                              {offering.selectionType}
                            </span>
                          </td>

                          <td style={{ padding: "0.85rem 1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <button
                                onClick={() => handleUpdatePeriods(offering.id, offering.periodsPerWeek - 1)}
                                disabled={!offering.isOffered || offering.periodsPerWeek <= 1}
                                style={{
                                  width: "24px",
                                  height: "24px",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--border-default)",
                                  background: "var(--bg-surface)",
                                  cursor: offering.isOffered ? "pointer" : "not-allowed",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                -
                              </button>
                              <span style={{ fontWeight: 700, minWidth: "20px", textAlign: "center" }}>
                                {offering.periodsPerWeek}
                              </span>
                              <button
                                onClick={() => handleUpdatePeriods(offering.id, offering.periodsPerWeek + 1)}
                                disabled={!offering.isOffered || offering.periodsPerWeek >= 20}
                                style={{
                                  width: "24px",
                                  height: "24px",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--border-default)",
                                  background: "var(--bg-surface)",
                                  cursor: offering.isOffered ? "pointer" : "not-allowed",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td style={{ padding: "0.85rem 1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                              {offering.theoryEnabled && (
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.4rem", borderRadius: "3px", background: "rgba(59, 130, 246, 0.1)", color: "#2563eb" }}>
                                  Theory
                                </span>
                              )}
                              {offering.practicalEnabled && (
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.4rem", borderRadius: "3px", background: "rgba(168, 85, 247, 0.1)", color: "#9333ea" }}>
                                  Practical
                                </span>
                              )}
                              {offering.internalAssessmentEnabled && (
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.4rem", borderRadius: "3px", background: "rgba(234, 88, 12, 0.1)", color: "#ea580c" }}>
                                  Internal
                                </span>
                              )}
                              <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginLeft: "0.2rem" }}>
                                ({offering.maxMarks}M / Pass {offering.passMarks}M)
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: "0.85rem 1rem" }}>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "0.2rem 0.5rem",
                                borderRadius: "var(--radius-sm)",
                                background: isCustom ? "rgba(236, 72, 153, 0.1)" : "var(--bg-app)",
                                color: isCustom ? "#db2777" : "var(--text-tertiary)",
                              }}
                            >
                              {isCustom ? "School Custom" : "Board Curriculum"}
                            </span>
                          </td>

                          <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                            <button
                              onClick={() => handleToggleOffering(offering)}
                              style={{
                                width: "44px",
                                height: "24px",
                                borderRadius: "12px",
                                border: "none",
                                cursor: "pointer",
                                position: "relative",
                                transition: "background 0.2s",
                                background: offering.isOffered ? "var(--success)" : "var(--border-default)",
                                display: "inline-block",
                              }}
                            >
                              <span
                                style={{
                                  position: "absolute",
                                  top: "2px",
                                  left: offering.isOffered ? "22px" : "2px",
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  background: "#fff",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                  transition: "left 0.2s",
                                }}
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB 2: CLASS SUBJECT MAPPING & SYNC ───────────────────── */}
      {activeSubTab === "CLASS_MAPPING" && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            padding: "1.5rem",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div>
            <h4 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
              Class & Section Subject Mappings
            </h4>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              Sync active curriculum subject offerings into class subjects to schedule timetables and exams.
            </p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-light)" }}>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>Class Name</th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>Sections</th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>Applicable Offerings</th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classList.map((cls) => {
                  let gradeLevel = 1;
                  const m = cls.name.match(/\d+/);
                  if (m) gradeLevel = parseInt(m[0], 10);
                  const applicableCount = safeOfferings.filter(
                    (o) => o.isOffered && o.gradeFrom <= gradeLevel && o.gradeTo >= gradeLevel
                  ).length;
                  const isSyncing = syncingClassId === cls.id;

                  return (
                    <tr key={cls.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <GraduationCap size={16} style={{ color: "var(--brand-primary)" }} />
                          <span style={{ fontWeight: 700 }}>{cls.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>
                        {(cls.sections || []).map((s: any) => s.name).join(", ") || "None"}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--brand-primary)" }}>
                          {applicableCount} Subjects
                        </span>
                      </td>
                      <td style={{ padding: "1rem", textAlign: "right" }}>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSyncing}
                          onClick={() => handleSyncClassSubjects(cls.id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                        >
                          {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                          Sync to Class Subjects
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: STUDENT ELECTIVE ENROLLMENT ────────────────────── */}
      {activeSubTab === "STUDENT_ELECTIVES" && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            padding: "1.5rem",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div>
            <h4 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
              Student Elective & Language Enrollments
            </h4>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              Assign individual language and skill elective choices (e.g. IT vs AI, Hindi vs Telugu vs Sanskrit) for each student.
            </p>
          </div>

          {/* Class & Section Selector */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ minWidth: "180px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: "0.3rem" }}>
                Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  const cls = classList.find((c) => c.id === e.target.value);
                  if (cls?.sections?.length > 0) {
                    setSelectedSectionId(cls.sections[0].id);
                  } else {
                    setSelectedSectionId("");
                  }
                }}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                }}
              >
                {classList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: "180px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: "0.3rem" }}>
                Section
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                }}
              >
                {classList
                  .find((c) => c.id === selectedClassId)
                  ?.sections?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Section Student Elective Grid */}
          {loadingSection ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem" }} />
              Loading students and enrolled subjects...
            </div>
          ) : !sectionData?.students?.length ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
              No students enrolled in this section.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-light)" }}>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", minWidth: "220px" }}>
                      Student
                    </th>
                    <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Assigned Subjects & Electives (Click to Toggle)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sectionData.students.map((st: any) => (
                    <tr key={st.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "1rem" }}>
                        <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>{st.name}</p>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                          Adm: {st.admissionNumber} {st.rollNumber ? `· Roll: ${st.rollNumber}` : ""}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          {(sectionData.availableOfferings || []).map((off: any) => {
                            const isEnrolled = (st.enrolledOfferingIds || []).includes(off.id);
                            const name = off.curriculumSubject?.displayName || off.customName || off.globalSubject?.name;
                            const isElective = off.selectionType !== "MANDATORY";

                            return (
                              <button
                                key={off.id}
                                onClick={() => handleToggleStudentOffering(st.id, off.id, st.enrolledOfferingIds || [])}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  padding: "0.3rem 0.65rem",
                                  borderRadius: "var(--radius-full)",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  border: isEnrolled
                                    ? "1px solid var(--brand-primary)"
                                    : "1px solid var(--border-default)",
                                  background: isEnrolled ? "rgba(99, 102, 241, 0.12)" : "var(--bg-app)",
                                  color: isEnrolled ? "var(--brand-primary)" : "var(--text-secondary)",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isEnrolled ? <Check size={12} /> : null}
                                {name}
                                {isElective && (
                                  <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>
                                    ({off.selectionType})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Load Recommended Curriculum Confirmation ─────── */}
      <Modal
        isOpen={initModalOpen}
        onClose={() => setInitModalOpen(false)}
        title="Load Recommended Curriculum Template"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", width: "100%" }}>
            <Button variant="outline" onClick={() => setInitModalOpen(false)} disabled={initializing}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleLoadRecommended} disabled={initializing}>
              {initializing ? "Loading Framework..." : "Confirm & Load Framework"}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "var(--text-sm)" }}>
          <div
            style={{
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <Sparkles size={20} style={{ color: "var(--brand-primary)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                Initialize Standard Academic Framework
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                This will populate the official Classes 1–10 subject groupings, codes, and baseline assessment models for{" "}
                <strong>
                  {boards.find((b) => b.id === selectedBoardId)?.name || "the selected board"}
                </strong>.
              </p>
            </div>
          </div>

          <ul style={{ paddingLeft: "1.25rem", color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "0.85rem" }}>
            <li>Existing custom subjects and marks records will NOT be deleted.</li>
            <li>All loaded subjects can be modified, enabled, or disabled at any time.</li>
            <li>Class and Section subject mappings will reference these standard offerings.</li>
          </ul>
        </div>
      </Modal>

      {/* ── Modal: Add Custom School Subject ──────────────────────── */}
      <Modal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        title="Add Custom School Subject"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", width: "100%" }}>
            <Button variant="outline" onClick={() => setCustomModalOpen(false)} disabled={savingCustom}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateCustomSubject} disabled={savingCustom}>
              {savingCustom ? "Saving..." : "Save Subject"}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
              Subject Name *
            </label>
            <Input
              placeholder="e.g. Robotics & STEM, Spoken English, Vedic Math"
              value={customForm.customName}
              onChange={(e) => setCustomForm({ ...customForm, customName: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Subject Code (Optional)
              </label>
              <Input
                placeholder="e.g. ROB-01"
                value={customForm.customCode}
                onChange={(e) => setCustomForm({ ...customForm, customCode: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Periods Per Week
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={customForm.periodsPerWeek}
                onChange={(e) => setCustomForm({ ...customForm, periodsPerWeek: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Applicable From Grade
              </label>
              <select
                value={customForm.gradeFrom}
                onChange={(e) => setCustomForm({ ...customForm, gradeFrom: Number(e.target.value) })}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                }}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>Class {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Applicable To Grade
              </label>
              <select
                value={customForm.gradeTo}
                onChange={(e) => setCustomForm({ ...customForm, gradeTo: Number(e.target.value) })}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                }}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g} disabled={g < customForm.gradeFrom}>Class {g}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Classification
              </label>
              <select
                value={customForm.subjectType}
                onChange={(e) => setCustomForm({ ...customForm, subjectType: e.target.value })}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="ADDITIONAL">Additional Subject</option>
                <option value="CO_CURRICULAR">Co-Curricular</option>
                <option value="VOCATIONAL">Vocational / Skill</option>
                <option value="LANGUAGE">Language</option>
                <option value="CORE">Core Academic</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Selection Type
              </label>
              <select
                value={customForm.selectionType}
                onChange={(e) => setCustomForm({ ...customForm, selectionType: e.target.value })}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="MANDATORY">Mandatory</option>
                <option value="OPTIONAL">Optional</option>
                <option value="ELECTIVE">Elective</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", paddingTop: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={customForm.theoryEnabled}
                onChange={(e) => setCustomForm({ ...customForm, theoryEnabled: e.target.checked })}
              />
              Theory Enabled
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={customForm.practicalEnabled}
                onChange={(e) => setCustomForm({ ...customForm, practicalEnabled: e.target.checked })}
              />
              Practical / Lab
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={customForm.internalAssessmentEnabled}
                onChange={(e) => setCustomForm({ ...customForm, internalAssessmentEnabled: e.target.checked })}
              />
              Internal Assessment
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
