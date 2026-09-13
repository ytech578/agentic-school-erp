"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";
import { 
  Layers, Plus, Users, School, Trash2, Edit2, DoorOpen, 
  Sparkles, CheckCircle2, AlertCircle, Loader2, BarChart2 
} from "lucide-react";

export default function ClassesManagementPage() {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [className, setClassName] = useState("");
  const [numericLevel, setNumericLevel] = useState<number | "">("");
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [initialSections, setInitialSections] = useState("A, B");

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [targetClassForSection, setTargetClassForSection] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionCapacity, setSectionCapacity] = useState<number>(40);
  const [roomNumber, setRoomNumber] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchClassesAndYears = async () => {
    setIsLoading(true);
    try {
      const [classesRes, ayRes] = await Promise.all([
        apiClient.get("/classes"),
        apiClient.get("/schools/academic-years"),
      ]);
      const cls = classesRes.data?.data || classesRes.data || [];
      const ays = ayRes.data?.data || ayRes.data || [];
      setClasses(cls);
      setAcademicYears(ays);
      if (ays.length > 0 && !selectedAcademicYearId) {
        setSelectedAcademicYearId(ays[0].id);
      }
    } catch (err) {
      console.error("Failed to load classes or academic years", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesAndYears();
  }, []);

  const handleOpenCreateClassModal = () => {
    setEditingClass(null);
    setClassName("");
    setNumericLevel("");
    setInitialSections("A, B");
    setActionMessage(null);
    setIsClassModalOpen(true);
  };

  const handleOpenEditClassModal = (cls: any) => {
    setEditingClass(cls);
    setClassName(cls.name);
    setNumericLevel(cls.numericLevel ?? "");
    setActionMessage(null);
    setIsClassModalOpen(true);
  };

  const handleClassSubmit = async () => {
    if (!className.trim()) {
      setActionMessage({ type: "error", text: "Please provide a class name." });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      if (editingClass) {
        await apiClient.put(`/classes/${editingClass.id}`, {
          name: className.trim(),
          numericLevel: numericLevel !== "" ? Number(numericLevel) : undefined,
        });
        setActionMessage({ type: "success", text: "Class updated successfully." });
      } else {
        const sectionsArray = initialSections
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        await apiClient.post("/classes", {
          name: className.trim(),
          numericLevel: numericLevel !== "" ? Number(numericLevel) : undefined,
          academicYearId: selectedAcademicYearId || undefined,
          sections: sectionsArray.length > 0 ? sectionsArray : undefined,
        });
        setActionMessage({ type: "success", text: "Class and sections created successfully." });
      }

      await fetchClassesAndYears();
      setTimeout(() => setIsClassModalOpen(false), 800);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to save class. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClass = async (classId: string, classNameStr: string) => {
    if (!confirm(`Are you sure you want to delete "${classNameStr}"? This will remove all associated empty sections.`)) {
      return;
    }

    try {
      await apiClient.delete(`/classes/${classId}`);
      await fetchClassesAndYears();
    } catch (err: any) {
      alert(err.response?.data?.message || "Cannot delete class with active student enrollments.");
    }
  };

  const handleOpenAddSectionModal = (classId?: string) => {
    setTargetClassForSection(classId || (classes[0]?.id ?? ""));
    setSectionName("");
    setSectionCapacity(40);
    setRoomNumber("");
    setActionMessage(null);
    setIsSectionModalOpen(true);
  };

  const handleSectionSubmit = async () => {
    if (!targetClassForSection) {
      setActionMessage({ type: "error", text: "Please select a target class." });
      return;
    }
    if (!sectionName.trim()) {
      setActionMessage({ type: "error", text: "Please specify section name (e.g. 'C')." });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      await apiClient.post(`/classes/${targetClassForSection}/sections`, {
        name: sectionName.trim(),
        capacity: Number(sectionCapacity) || 40,
        roomNumber: roomNumber.trim() || undefined,
      });

      setActionMessage({ type: "success", text: `Section ${sectionName.trim()} created successfully.` });
      await fetchClassesAndYears();
      setTimeout(() => setIsSectionModalOpen(false), 800);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to add section. Section name may already exist in this class.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSection = async (sectionId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete Section "${name}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/classes/sections/${sectionId}`);
      await fetchClassesAndYears();
    } catch (err: any) {
      alert(err.response?.data?.message || "Cannot delete section with active enrollments.");
    }
  };

  // KPIs
  const totalClasses = classes.length;
  const totalSections = classes.reduce((sum, c) => sum + (c.sections?.length || 0), 0);
  const totalEnrolledStudents = classes.reduce((sum, c) => {
    return sum + (c.sections || []).reduce((secSum: number, s: any) => secSum + (s._count?.enrollments || 0), 0);
  }, 0);
  const totalCapacity = classes.reduce((sum, c) => {
    return sum + (c.sections || []).reduce((secSum: number, s: any) => secSum + (s.capacity || 40), 0);
  }, 0);
  const capacityUtilization = totalCapacity > 0 ? Math.round((totalEnrolledStudents / totalCapacity) * 100) : 0;

  const canManage = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(user?.role || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0D1B36 0%, #1E3A8A 50%, #2563EB 100%)",
          borderRadius: "1.25rem",
          padding: "2rem 2.25rem",
          color: "white",
          boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.25)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          flexWrap: "wrap",
          gap: "1.25rem",
        }}
      >
        <div style={{ zIndex: 1, maxWidth: "680px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.12)", padding: "0.3rem 0.75rem", borderRadius: "2rem", marginBottom: "0.75rem", backdropFilter: "blur(8px)" }}>
            <Sparkles size={14} style={{ color: "#38bdf8" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Academic Infrastructure Hub
            </span>
          </div>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            Classes & Sections Management
          </h1>
          <p style={{ opacity: 0.88, marginTop: "0.35rem", fontSize: "0.9375rem", lineHeight: 1.5 }}>
            Configure institutional standards, assign classroom halls, manage student batch capacities, and organize academic enrollments.
          </p>
        </div>

        {canManage && (
          <div style={{ display: "flex", gap: "0.75rem", zIndex: 1, flexWrap: "wrap" }}>
            <Button
              variant="outline"
              onClick={() => handleOpenAddSectionModal()}
              style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.3)" }}
            >
              <Plus size={16} style={{ marginRight: "0.4rem" }} />
              Add Section
            </Button>
            <Button
              onClick={handleOpenCreateClassModal}
              style={{ background: "#ffffff", color: "#1e3a8a", fontWeight: 700, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
            >
              <Plus size={16} style={{ marginRight: "0.4rem", color: "#2563eb" }} />
              Create Class
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "0.75rem", background: "var(--brand-blue-subtle)", color: "var(--brand-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <School size={24} />
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Active Classes</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{totalClasses}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "0.75rem", background: "rgba(16, 185, 129, 0.12)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers size={24} />
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Total Sections</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{totalSections}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "0.75rem", background: "rgba(245, 158, 11, 0.12)", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Enrolled Students</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{totalEnrolledStudents}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "0.75rem", background: "rgba(99, 102, 241, 0.12)", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart2 size={24} />
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Capacity Fill</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{capacityUtilization}%</div>
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>
          <Loader2 className="spin" size={36} style={{ margin: "0 auto 1rem", color: "var(--primary-600)" }} />
          <p style={{ fontWeight: 600 }}>Loading classes and sections hierarchy...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="card" style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <School size={48} style={{ color: "var(--text-tertiary)", margin: "0 auto 1rem" }} />
          <h3 style={{ margin: "0 0 0.5rem" }}>No Classes Configured Yet</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", maxWidth: "450px", margin: "0 auto 1.5rem" }}>
            Start setting up your school curriculum structure by adding your first grade or standard.
          </p>
          {canManage && (
            <Button onClick={handleOpenCreateClassModal}>
              <Plus size={16} style={{ marginRight: "0.4rem" }} />
              Create First Class
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {classes.map((cls) => {
            const classEnrolled = (cls.sections || []).reduce(
              (sum: number, s: any) => sum + (s._count?.enrollments || 0),
              0
            );

            return (
              <div
                key={cls.id}
                className="card"
                style={{
                  padding: "1.5rem",
                  borderRadius: "1rem",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                }}
              >
                {/* Class Title Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "0.5rem", background: "var(--primary-100)", color: "var(--primary-600)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                      {cls.numericLevel ?? cls.name.charAt(0)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {cls.name}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                        <span>{cls.sections?.length || 0} Section(s)</span>
                        <span>&bull;</span>
                        <span>{classEnrolled} Enrolled Student(s)</span>
                        {cls.academicYear && (
                          <>
                            <span>&bull;</span>
                            <span>{cls.academicYear.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAddSectionModal(cls.id)}
                        style={{ fontSize: "0.813rem", gap: "0.3rem" }}
                      >
                        <Plus size={14} />
                        Add Section
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditClassModal(cls)}
                        style={{ padding: "0.4rem" }}
                      >
                        <Edit2 size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClass(cls.id, cls.name)}
                        style={{ padding: "0.4rem", color: "var(--status-danger)" }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Sections Cards Grid */}
                {(!cls.sections || cls.sections.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-secondary)", fontSize: "0.813rem", background: "var(--bg-surface-hover)", borderRadius: "0.75rem" }}>
                    No sections in this class yet. Click <strong>"Add Section"</strong> to create Section A, B, etc.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
                    {cls.sections.map((sec: any) => {
                      const enrolled = sec._count?.enrollments || 0;
                      const cap = sec.capacity || 40;
                      const pct = Math.min(Math.round((enrolled / cap) * 100), 100);

                      return (
                        <div
                          key={sec.id}
                          style={{
                            background: "var(--bg-surface-hover)",
                            borderRadius: "0.75rem",
                            border: "1px solid var(--border-default)",
                            padding: "1rem 1.25rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                            position: "relative",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                Section {sec.name}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                                <DoorOpen size={13} />
                                <span>{sec.roomNumber ? `Room ${sec.roomNumber}` : "Room Unassigned"}</span>
                              </div>
                            </div>

                            {canManage && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSection(sec.id, sec.name)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "var(--text-tertiary)",
                                  padding: "0.2rem",
                                }}
                                title="Delete Section"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          {/* Enrollment Capacity Gauge */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.3rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Students Enrolled</span>
                              <strong style={{ color: "var(--text-primary)" }}>
                                {enrolled} / {cap}
                              </strong>
                            </div>
                            <div style={{ width: "100%", height: "6px", background: "var(--border-default)", borderRadius: "3px", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  background: pct > 90 ? "var(--status-danger)" : pct > 75 ? "var(--status-warning)" : "var(--primary-600)",
                                  borderRadius: "3px",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Class Modal */}
      <Modal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        title={editingClass ? "Edit Class" : "Create New Class Standard"}
        footer={
          <div style={{ display: "flex", gap: "0.75rem", width: "100%", justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => setIsClassModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleClassSubmit}
              disabled={isSubmitting}
              style={{ background: "var(--primary-600)", color: "white", fontWeight: 600 }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="spin" size={16} style={{ marginRight: "0.5rem" }} />
                  Saving...
                </>
              ) : editingClass ? (
                "Update Class"
              ) : (
                "Create Class"
              )}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {actionMessage && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                background: actionMessage.type === "success" ? "var(--risk-low-bg)" : "var(--risk-high-bg)",
                color: actionMessage.type === "success" ? "var(--risk-low)" : "var(--risk-high)",
                border: `1px solid ${actionMessage.type === "success" ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
              }}
            >
              {actionMessage.text}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Class Standard Name *
            </label>
            <Input
              placeholder="e.g. Class 10 or Grade 10 - Section A"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Numeric Level (Optional)
              </label>
              <Input
                type="number"
                placeholder="e.g. 10"
                value={numericLevel}
                onChange={(e) => setNumericLevel(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Academic Year
              </label>
              <select
                value={selectedAcademicYearId}
                onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                  height: "38px",
                }}
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.isActive ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!editingClass && (
            <div>
              <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Initial Sections (Comma-separated)
              </label>
              <Input
                placeholder="e.g. A, B, C"
                value={initialSections}
                onChange={(e) => setInitialSections(e.target.value)}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "block" }}>
                Sections will be automatically generated with standard 40-student capacity.
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Add Section Modal */}
      <Modal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        title="Add Section to Class"
        footer={
          <div style={{ display: "flex", gap: "0.75rem", width: "100%", justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => setIsSectionModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSectionSubmit}
              disabled={isSubmitting}
              style={{ background: "var(--primary-600)", color: "white", fontWeight: 600 }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="spin" size={16} style={{ marginRight: "0.5rem" }} />
                  Creating...
                </>
              ) : (
                "Create Section"
              )}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {actionMessage && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                background: actionMessage.type === "success" ? "var(--risk-low-bg)" : "var(--risk-high-bg)",
                color: actionMessage.type === "success" ? "var(--risk-low)" : "var(--risk-high)",
                border: `1px solid ${actionMessage.type === "success" ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
              }}
            >
              {actionMessage.text}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Parent Class *
            </label>
            <select
              value={targetClassForSection}
              onChange={(e) => setTargetClassForSection(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
              }}
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Section Name *
              </label>
              <Input
                placeholder="e.g. C or Gamma"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Student Capacity
              </label>
              <Input
                type="number"
                placeholder="40"
                value={sectionCapacity}
                onChange={(e) => setSectionCapacity(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Room / Hall Number (Optional)
            </label>
            <Input
              placeholder="e.g. Room 204 or Science Wing B"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
