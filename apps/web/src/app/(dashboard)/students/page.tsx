"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { 
  Search, Plus, Eye, Edit, ShieldAlert, GraduationCap, 
  CheckCircle2, AlertCircle, Loader2, CheckSquare, Square, ArrowRight 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";

export default function StudentsDirectoryPage() {
  const { user } = useAuthStore();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const router = useRouter();

  // Promotion & Rollover state
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [sourceClassId, setSourceClassId] = useState("");
  const [sourceSectionId, setSourceSectionId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetSectionId, setTargetSectionId] = useState("");
  const [targetAcademicYearId, setTargetAcademicYearId] = useState("");
  const [promotionStatus, setPromotionStatus] = useState<"PROMOTED" | "GRADUATED">("PROMOTED");
  const [remarks, setRemarks] = useState("");
  const [sectionStudents, setSectionStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isLoadingSectionStudents, setIsLoadingSectionStudents] = useState(false);
  const [isSubmittingPromotion, setIsSubmittingPromotion] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStudents = async (
    search = searchTerm,
    classId = selectedClassId,
    sectionId = selectedSectionId,
  ) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get("/students", {
        params: {
          search: search || undefined,
          classId: classId || undefined,
          sectionId: sectionId || undefined,
          limit: 500,
        },
      });
      const data = response.data?.data;
      setStudents(data?.items || []);
      setTotalCount(data?.total ?? (data?.items?.length || 0));
    } catch (error) {
      console.error("Failed to fetch students", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const clsRes = await apiClient.get("/classes");
        const cls = clsRes.data?.data || clsRes.data || [];
        setAllClasses(cls);
        setClassesList(cls);
      } catch (err) {
        console.error("Failed to fetch classes", err);
      }
      fetchStudents("", "", "");
    };
    loadInitial();
  }, []);

  const handleSearch = (e: React.SyntheticEvent) => {
    e.preventDefault();
    fetchStudents(searchTerm, selectedClassId, selectedSectionId);
  };

  const handleRunRiskScoring = async () => {
    setIsLoading(true);
    try {
      await apiClient.post("/students/calculate-risk");
      await fetchStudents(searchTerm);
    } catch (error) {
      console.error("Failed to run risk scoring", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPromoteModal = async () => {
    setIsPromoteModalOpen(true);
    setPromotionMessage(null);
    try {
      const [classesRes, ayRes] = await Promise.all([
        apiClient.get("/classes"),
        apiClient.get("/schools/academic-years"),
      ]);
      const cls = classesRes.data?.data || classesRes.data || [];
      const ays = ayRes.data?.data || ayRes.data || [];
      setClassesList(cls);
      setAcademicYears(ays);
      if (ays.length > 0 && !targetAcademicYearId) {
        setTargetAcademicYearId(ays[0].id);
      }
    } catch (err) {
      console.error("Failed to load classes and academic years", err);
    }
  };

  const handleSourceClassChange = (classId: string) => {
    setSourceClassId(classId);
    setSourceSectionId("");
    setSectionStudents([]);
    setSelectedStudentIds([]);
  };

  const handleSourceSectionChange = async (sectionId: string) => {
    setSourceSectionId(sectionId);
    setSelectedStudentIds([]);
    if (!sectionId) {
      setSectionStudents([]);
      return;
    }
    setIsLoadingSectionStudents(true);
    try {
      const res = await apiClient.get("/students", {
        params: { sectionId, limit: 100 },
      });
      const items = res.data?.data?.items || res.data?.items || [];
      setSectionStudents(items);
      setSelectedStudentIds(items.map((s: any) => s.id));
    } catch (err) {
      console.error("Failed to load students for section", err);
    } finally {
      setIsLoadingSectionStudents(false);
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleSelectAllStudents = () => {
    if (selectedStudentIds.length === sectionStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(sectionStudents.map((s) => s.id));
    }
  };

  const handleBatchPromoteSubmit = async () => {
    if (!sourceSectionId) {
      setPromotionMessage({ type: "error", text: "Please select a source section." });
      return;
    }
    if (selectedStudentIds.length === 0) {
      setPromotionMessage({ type: "error", text: "Please select at least one student to promote." });
      return;
    }
    if (!targetAcademicYearId) {
      setPromotionMessage({ type: "error", text: "Please select the target academic year." });
      return;
    }
    if (promotionStatus === "PROMOTED" && !targetSectionId) {
      setPromotionMessage({ type: "error", text: "Please select the target class and section." });
      return;
    }

    setIsSubmittingPromotion(true);
    setPromotionMessage(null);
    try {
      const res = await apiClient.post("/students/batch-promote", {
        fromSectionId: sourceSectionId,
        toSectionId: promotionStatus === "PROMOTED" ? targetSectionId : undefined,
        studentIds: selectedStudentIds,
        academicYearId: targetAcademicYearId,
        status: promotionStatus,
        remarks: remarks.trim() || undefined,
      });

      const count = res.data?.data?.promotedCount || selectedStudentIds.length;
      setPromotionMessage({
        type: "success",
        text: `Successfully ${promotionStatus === "GRADUATED" ? "graduated" : "promoted"} ${count} student(s)!`,
      });
      fetchStudents(searchTerm);
      setTimeout(() => {
        handleSourceSectionChange(sourceSectionId);
      }, 1000);
    } catch (err: any) {
      setPromotionMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to execute student promotion.",
      });
    } finally {
      setIsSubmittingPromotion(false);
    }
  };

  const sourceClass = classesList.find((c) => c.id === sourceClassId);
  const targetClass = classesList.find((c) => c.id === targetClassId);

  const columns: Column<any>[] = [
    {
      header: "Admission No",
      accessorKey: "admissionNumber",
    },
    {
      header: "Student Name",
      accessorKey: "name",
      cell: (row: any) => `${row.user?.firstName || ''} ${row.user?.lastName || ''}`,
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: (row: any) => row.user?.email || 'N/A',
    },
    {
      header: "Class",
      accessorKey: "class",
      cell: (row: any) => {
        const enrollment = row.enrollments?.[0];
        if (!enrollment) return "N/A";
        return `${enrollment.section?.class?.name} - ${enrollment.section?.name}`;
      },
    },
    {
      header: "Primary Guardian",
      accessorKey: "guardian",
      cell: (row: any) => {
        const guardian = row.guardians?.[0];
        return guardian ? `${guardian.firstName} ${guardian.lastName}` : "N/A";
      },
    },
    {
      header: "Risk Level",
      accessorKey: "riskLevel",
      cell: (row: any) => {
        const level = row.riskLevel || 'NONE';
        
        let colorClass = 'var(--text-tertiary)';
        let bgClass = 'var(--bg-elevated)';
        
        if (level === 'HIGH') {
          colorClass = 'var(--status-danger)';
          bgClass = 'var(--status-danger-muted)';
        } else if (level === 'MEDIUM') {
          colorClass = 'var(--status-warning)';
          bgClass = 'var(--status-warning-muted)';
        } else if (level === 'LOW') {
          colorClass = 'var(--status-success)';
          bgClass = 'var(--status-success-muted)';
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '0.25rem 0.5rem', 
              borderRadius: '9999px', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              color: colorClass,
              backgroundColor: bgClass,
              border: `1px solid ${colorClass}40`
            }}>
              {level}
            </span>
            {level === 'HIGH' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Score: {row.riskScore}</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "actions",
      cell: (row: any) => (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push(`/students/${row.id}`)}
          >
            <Eye size={16} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push(`/students/${row.id}/edit`)}
          >
            <Edit size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const highRiskCount = students.filter((s: any) => s.riskLevel === 'HIGH').length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Students Directory</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Manage student records, batch rollover, and class admissions
          </p>
        </div>
        {['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(user?.role || '') && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: "wrap" }}>
            <Button variant="outline" onClick={handleOpenPromoteModal}>
              <GraduationCap size={18} style={{ marginRight: "0.5rem", color: 'var(--brand-blue)' }} />
              Class Promotion & Rollover
            </Button>
            <Button variant="outline" onClick={handleRunRiskScoring}>
              <ShieldAlert size={18} style={{ marginRight: "0.5rem", color: 'var(--brand-teal)' }} />
              Run AI Risk Analysis
            </Button>
            <Button onClick={() => router.push("/students/new")}>
              <Plus size={18} style={{ marginRight: "0.5rem" }} />
              Admit Student
            </Button>
          </div>
        )}
      </div>

      {!isLoading && highRiskCount > 0 && (
        <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "var(--radius-lg)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
           <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={20} color="#ef4444" />
           </div>
           <div style={{ flex: 1 }}>
             <h4 style={{ color: "#ef4444", fontWeight: 700, margin: 0 }}>AI Risk Insights</h4>
             <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Detected <strong>{highRiskCount}</strong> student(s) at high risk of dropping out or failing. Review their profiles immediately.</p>
           </div>
           <Button variant="secondary" size="sm" onClick={() => fetchStudents('HIGH')} style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "#ef4444" }}>View At-Risk</Button>
        </div>
      )}

      <div className="card" style={{ padding: "1.5rem" }}>
        {/* Class-wise Quick Filter Chips */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-default)" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-secondary)", marginRight: "0.25rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <GraduationCap size={15} color="var(--brand-primary)" /> Class View:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedClassId("");
              setSelectedSectionId("");
              fetchStudents(searchTerm, "", "");
            }}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.75rem",
              fontWeight: selectedClassId === "" ? 700 : 500,
              cursor: "pointer",
              border: `1.5px solid ${selectedClassId === "" ? "var(--brand-primary)" : "var(--border-default)"}`,
              background: selectedClassId === "" ? "rgba(99,102,241,0.12)" : "transparent",
              color: selectedClassId === "" ? "var(--brand-primary)" : "var(--text-secondary)",
              transition: "all 0.15s",
            }}
          >
            All Classes ({totalCount})
          </button>
          {allClasses.map((c: any) => {
            const isSel = selectedClassId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  const newClassId = isSel ? "" : c.id;
                  setSelectedClassId(newClassId);
                  setSelectedSectionId("");
                  fetchStudents(searchTerm, newClassId, "");
                }}
                style={{
                  padding: "0.35rem 0.85rem",
                  borderRadius: "var(--radius-full)",
                  fontSize: "0.75rem",
                  fontWeight: isSel ? 700 : 500,
                  cursor: "pointer",
                  border: `1.5px solid ${isSel ? "var(--brand-primary)" : "var(--border-default)"}`,
                  background: isSel ? "rgba(99,102,241,0.12)" : "transparent",
                  color: isSel ? "var(--brand-primary)" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "240px", maxWidth: "380px" }}>
            <Input 
              placeholder="Search by name or admission number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Class Dropdown */}
            <select
              value={selectedClassId}
              onChange={(e) => {
                const cId = e.target.value;
                setSelectedClassId(cId);
                setSelectedSectionId("");
                fetchStudents(searchTerm, cId, "");
              }}
              style={{
                padding: "0.55rem 0.85rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-app)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <option value="">All Classes</option>
              {allClasses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Section Dropdown */}
            <select
              value={selectedSectionId}
              disabled={!selectedClassId}
              onChange={(e) => {
                const sId = e.target.value;
                setSelectedSectionId(sId);
                fetchStudents(searchTerm, selectedClassId, sId);
              }}
              style={{
                padding: "0.55rem 0.85rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: !selectedClassId ? "var(--bg-elevated)" : "var(--bg-app)",
                color: !selectedClassId ? "var(--text-tertiary)" : "var(--text-primary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: !selectedClassId ? "not-allowed" : "pointer",
              }}
            >
              <option value="">All Sections</option>
              {allClasses
                .find((c: any) => c.id === selectedClassId)
                ?.sections?.map((sec: any) => (
                  <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                ))}
            </select>

            <Button type="submit" variant="secondary">Search</Button>

            {(selectedClassId || selectedSectionId || searchTerm) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedClassId("");
                  setSelectedSectionId("");
                  setSearchTerm("");
                  fetchStudents("", "", "");
                }}
                style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </form>

        {/* Active Class Filter Banner */}
        {selectedClassId && (
          <div style={{
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: "var(--radius-md)",
            padding: "0.6rem 1rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.875rem",
          }}>
            <span style={{ color: "var(--text-primary)" }}>
              Viewing class roster for: <strong>{allClasses.find((c: any) => c.id === selectedClassId)?.name}</strong>
              {selectedSectionId && ` • Section ${allClasses.find((c: any) => c.id === selectedClassId)?.sections?.find((s: any) => s.id === selectedSectionId)?.name}`}
              {" "}(<strong>{students.length}</strong> student{students.length === 1 ? '' : 's'})
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Total in School: {totalCount}
            </span>
          </div>
        )}

        <DataTable
          columns={columns}
          data={students}
          isLoading={isLoading}
        />
      </div>

      {/* Class-Wide Student Promotion & Academic Year Rollover Modal */}
      <Modal
        isOpen={isPromoteModalOpen}
        onClose={() => setIsPromoteModalOpen(false)}
        title="Class Promotion & Academic Year Rollover"
        footer={
          <div style={{ display: "flex", gap: "0.75rem", width: "100%", justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => setIsPromoteModalOpen(false)} disabled={isSubmittingPromotion}>
              Cancel
            </Button>
            <Button
              onClick={handleBatchPromoteSubmit}
              disabled={isSubmittingPromotion || selectedStudentIds.length === 0}
              style={{ background: "var(--primary-600)", color: "white", fontWeight: 600 }}
            >
              {isSubmittingPromotion ? (
                <>
                  <Loader2 className="spin" size={16} style={{ marginRight: "0.5rem" }} />
                  Processing Rollover...
                </>
              ) : (
                <>
                  Execute Rollover ({selectedStudentIds.length})
                  <ArrowRight size={15} style={{ marginLeft: "0.4rem" }} />
                </>
              )}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {promotionMessage && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                background: promotionMessage.type === "success" ? "var(--risk-low-bg)" : "var(--risk-high-bg)",
                color: promotionMessage.type === "success" ? "var(--risk-low)" : "var(--risk-high)",
                border: `1px solid ${promotionMessage.type === "success" ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
              }}
            >
              {promotionMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{promotionMessage.text}</span>
            </div>
          )}

          {/* Source Selection */}
          <div style={{ background: "var(--bg-surface-hover)", padding: "1rem", borderRadius: "0.75rem", border: "1px solid var(--border-default)" }}>
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
              1. Source Class & Section
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                  Current Class
                </label>
                <select
                  value={sourceClassId}
                  onChange={(e) => handleSourceClassChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.813rem",
                  }}
                >
                  <option value="">Select Class...</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                  Current Section
                </label>
                <select
                  value={sourceSectionId}
                  onChange={(e) => handleSourceSectionChange(e.target.value)}
                  disabled={!sourceClassId}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.813rem",
                  }}
                >
                  <option value="">Select Section...</option>
                  {(sourceClass?.sections || []).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name} ({s._count?.enrollments ?? 0} Enrolled)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Student Multi-Select List */}
          {sourceSectionId && (
            <div style={{ border: "1px solid var(--border-default)", borderRadius: "0.75rem", padding: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  2. Select Students ({selectedStudentIds.length} of {sectionStudents.length} selected)
                </span>
                <Button variant="ghost" size="sm" onClick={handleSelectAllStudents} style={{ fontSize: "0.75rem", height: "auto", padding: "0.2rem 0.5rem" }}>
                  {selectedStudentIds.length === sectionStudents.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              {isLoadingSectionStudents ? (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-secondary)" }}>
                  <Loader2 className="spin" size={20} style={{ margin: "0 auto 0.5rem" }} />
                  <span style={{ fontSize: "0.813rem" }}>Loading enrolled students...</span>
                </div>
              ) : sectionStudents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-secondary)", fontSize: "0.813rem" }}>
                  No active enrolled students found in this section.
                </div>
              ) : (
                <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {sectionStudents.map((std) => {
                    const isSelected = selectedStudentIds.includes(std.id);
                    return (
                      <div
                        key={std.id}
                        onClick={() => handleToggleStudent(std.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          padding: "0.35rem 0.6rem",
                          borderRadius: "0.375rem",
                          background: isSelected ? "var(--brand-blue-subtle)" : "var(--bg-surface)",
                          border: `1px solid ${isSelected ? "var(--primary-300)" : "var(--border-default)"}`,
                          cursor: "pointer",
                          fontSize: "0.813rem",
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare size={16} style={{ color: "var(--primary-600)" }} />
                        ) : (
                          <Square size={16} style={{ color: "var(--text-tertiary)" }} />
                        )}
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {std.user?.firstName} {std.user?.lastName}
                        </span>
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginLeft: "auto" }}>
                          Adm: {std.admissionNumber} {std.rollNumber ? `• Roll: ${std.rollNumber}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Target Rollover Destination */}
          <div style={{ background: "var(--bg-surface-hover)", padding: "1rem", borderRadius: "0.75rem", border: "1px solid var(--border-default)" }}>
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
              3. Target Rollover Action & Destination
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                  Promotion Status
                </label>
                <select
                  value={promotionStatus}
                  onChange={(e) => setPromotionStatus(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.813rem",
                  }}
                >
                  <option value="PROMOTED">Promote to Higher Class</option>
                  <option value="GRADUATED">Mark as Graduated (Alumni)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                  Target Academic Year
                </label>
                <select
                  value={targetAcademicYearId}
                  onChange={(e) => setTargetAcademicYearId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "0.813rem",
                  }}
                >
                  <option value="">Select Academic Year...</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} {ay.isActive ? "(Current Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {promotionStatus === "PROMOTED" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    Target Class
                  </label>
                  <select
                    value={targetClassId}
                    onChange={(e) => {
                      setTargetClassId(e.target.value);
                      setTargetSectionId("");
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: "0.813rem",
                    }}
                  >
                    <option value="">Select Next Class...</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    Target Section
                  </label>
                  <select
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    disabled={!targetClassId}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: "0.813rem",
                    }}
                  >
                    <option value="">Select Next Section...</option>
                    {(targetClass?.sections || []).map((s: any) => (
                      <option key={s.id} value={s.id}>
                        Section {s.name} (Capacity: {s.capacity || 40})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                Rollover Remarks (Optional)
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Annual exam 2026-27 promotion"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "0.813rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

