"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft, Plus, BookOpen, BarChart2, FileText,
  CheckCircle, Clock, Save, Trophy, Search, Printer, X,
  Award, TrendingUp, Filter, CheckCheck, Sparkles, UserCheck
} from "lucide-react";

type Tab = "overview" | "subjects" | "marks" | "results" | "reportcards";

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [exam, setExam] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [isLoading, setIsLoading] = useState(true);

  // Subjects tab
  const [subjects, setSubjects] = useState<any[]>([]);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [subjectForm, setSubjectForm] = useState({ subjectId: "", classId: "", maxMarks: "100", passMarks: "35", examDate: "" });
  const [addingSubject, setAddingSubject] = useState(false);

  // Marks entry
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, { marks: string; absent: boolean }>>({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [marksMsg, setMarksMsg] = useState<string | null>(null);

  // Results & Report Cards
  const [results, setResults] = useState<any[]>([]);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("ALL");
  const [previewStudent, setPreviewStudent] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => { fetchExam(); fetchHelpers(); }, [examId]);

  const fetchExam = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/exams/${examId}`);
      const data = res.data.data || res.data;
      setExam(data);
      setSubjects(data.subjects || []);
    } catch { } finally { setIsLoading(false); }
  };

  const fetchHelpers = async () => {
    try {
      const [subRes, clsRes] = await Promise.all([
        apiClient.get("/exams/subjects"),
        apiClient.get("/classes"),
      ]);
      setAllSubjects(subRes.data.data || subRes.data || []);
      setClasses(clsRes.data.data || []);
    } catch { }
  };

  const fetchResults = async () => {
    try {
      const res = await apiClient.get(`/exams/${examId}/results`);
      setResults(res.data.data || res.data || []);
    } catch { }
  };

  const handleOpenReportCard = async (studentId: string) => {
    setLoadingPreview(true);
    try {
      const res = await apiClient.get(`/exams/${examId}/results/${studentId}`);
      setPreviewStudent(res.data.data || res.data);
    } catch (e) {
      console.error("Failed to load report card", e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAddSubject = async () => {
    if (!subjectForm.subjectId) return;
    setAddingSubject(true);
    try {
      await apiClient.post(`/exams/${examId}/subjects`, {
        ...subjectForm,
        maxMarks: parseFloat(subjectForm.maxMarks),
        passMarks: parseFloat(subjectForm.passMarks),
        classId: subjectForm.classId || "default",
      });
      setShowAddSubject(false);
      fetchExam();
    } catch { } finally { setAddingSubject(false); }
  };

  const loadStudentsForMarks = async (examSubjectId: string, sectionId: string) => {
    if (!sectionId) return;
    try {
      const res = await apiClient.get(`/exams/${examId}/subjects/${examSubjectId}/students?sectionId=${sectionId}`);
      const data = res.data.data || res.data;
      setStudents(data.students || []);
      const init: Record<string, { marks: string; absent: boolean }> = {};
      (data.students || []).forEach((s: any) => {
        init[s.studentId] = {
          marks: s.mark?.marksObtained?.toString() ?? "",
          absent: s.mark?.isAbsent ?? false,
        };
      });
      setMarks(init);
    } catch { }
  };

  const handleSaveMarks = async () => {
    if (!selectedSubject) return;
    setSavingMarks(true);
    setMarksMsg(null);
    try {
      const payload = students.map(s => ({
        studentId: s.studentId,
        marksObtained: marks[s.studentId]?.absent ? undefined : parseFloat(marks[s.studentId]?.marks || "0"),
        isAbsent: marks[s.studentId]?.absent ?? false,
      }));
      await apiClient.post(`/exams/${examId}/subjects/${selectedSubject.id}/marks`, { marks: payload });
      setMarksMsg("Marks saved successfully!");
    } catch { setMarksMsg("Failed to save marks."); } finally { setSavingMarks(false); }
  };

  const handleGenerateReportCards = async () => {
    setGeneratingCards(true);
    try {
      await apiClient.post(`/exams/${examId}/report-cards`);
      await fetchResults();
      setTab("results");
    } catch { } finally { setGeneratingCards(false); }
  };

  const handlePublish = async () => {
    try {
      await apiClient.post(`/exams/${examId}/publish`);
      fetchExam();
    } catch { }
  };

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const studentName = `${r.student?.user?.firstName || ""} ${r.student?.user?.lastName || ""}`.toLowerCase();
      const className = r.student?.enrollments?.[0]?.section?.class?.name || "";
      const matchesSearch = studentName.includes(searchQuery.toLowerCase()) || (r.student?.admissionNumber || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass = selectedClassFilter === "ALL" || className === selectedClassFilter;
      return matchesSearch && matchesClass;
    });
  }, [results, searchQuery, selectedClassFilter]);

  // Summary KPIs for results
  const resultStats = useMemo(() => {
    if (!results.length) return null;
    const totalRanked = results.length;
    const avgPct = (results.reduce((s, r) => s + Number(r.percentage || 0), 0) / totalRanked).toFixed(1);
    const passedCount = results.filter(r => Number(r.percentage || 0) >= 40).length;
    const passRate = ((passedCount / totalRanked) * 100).toFixed(1);
    const topScorer = results[0];
    return { totalRanked, avgPct, passRate, topScorer };
  }, [results]);

  // Unique classes present in results
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    results.forEach(r => {
      const cn = r.student?.enrollments?.[0]?.section?.class?.name;
      if (cn) set.add(cn);
    });
    return Array.from(set).sort();
  }, [results]);

  if (isLoading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "var(--text-secondary)" }}>Loading exam...</div>;
  }
  if (!exam) return <div>Exam not found</div>;

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BookOpen },
    { key: "subjects", label: "Subjects", icon: FileText },
    { key: "marks", label: "Marks Entry", icon: Save },
    { key: "results", label: "Results Leaderboard", icon: BarChart2 },
    { key: "reportcards", label: "Official Report Cards", icon: Trophy },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Button variant="ghost" onClick={() => router.push("/exams")} style={{ padding: "0.5rem" }}>
          <ArrowLeft size={20} />
        </Button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)" }}>{exam.name}</h1>
            {exam.isPublished
              ? <span style={{ background: "var(--status-success-bg)", color: "var(--status-success)", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)", fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)" }}>Published</span>
              : <span style={{ background: "var(--status-warning-bg)", color: "var(--status-warning)", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)", fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)" }}>Draft</span>
            }
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            {exam.examType?.replace(/_/g, " ")} · {new Date(exam.startDate).toLocaleDateString("en-IN")} – {new Date(exam.endDate).toLocaleDateString("en-IN")}
          </p>
        </div>
        {!exam.isPublished && (
          <Button onClick={handlePublish} variant="secondary">
            <CheckCircle size={16} style={{ marginRight: "0.5rem" }} /> Publish Results
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-default)", gap: "0.25rem" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === "results" || t.key === "reportcards") fetchResults(); }}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem",
              background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-sm)",
              fontWeight: tab === t.key ? "var(--font-semibold)" : "var(--font-medium)",
              color: tab === t.key ? "var(--brand-primary)" : "var(--text-secondary)",
              borderBottom: tab === t.key ? "2px solid var(--brand-primary)" : "2px solid transparent",
              transition: "all var(--duration-fast)",
            }}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            {[
              { label: "Exam Subjects", value: exam._count?.subjects ?? subjects.length, icon: FileText, color: "var(--brand-primary)" },
              { label: "Report Cards", value: exam._count?.reportCards ?? results.length, icon: Trophy, color: "var(--status-success)" },
              { label: "Status", value: exam.isPublished ? "Published" : "Draft", icon: exam.isPublished ? CheckCircle : Clock, color: exam.isPublished ? "var(--status-success)" : "var(--status-warning)" },
            ].map(stat => (
              <div key={stat.label} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", padding: "1.5rem", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "var(--radius-md)", background: `${stat.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <stat.icon size={20} color={stat.color} />
                  </div>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{stat.label}</span>
                </div>
                <p style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Subjects */}
        {tab === "subjects" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Total {subjects.length} subjects configured for this exam</span>
              <Button onClick={() => setShowAddSubject(true)}>
                <Plus size={16} style={{ marginRight: "0.5rem" }} /> Add Subject
              </Button>
            </div>

            {showAddSubject && (
              <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", padding: "1.5rem", border: "1px solid var(--border-default)" }}>
                <h3 style={{ marginBottom: "1rem" }}>Add Subject to Exam</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Subject *</label>
                    <select value={subjectForm.subjectId} onChange={e => setSubjectForm(f => ({ ...f, subjectId: e.target.value }))}
                      style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                      <option value="">Select Subject</option>
                      {allSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Class</label>
                    <select value={subjectForm.classId} onChange={e => setSubjectForm(f => ({ ...f, classId: e.target.value }))}
                      style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                      <option value="">All Classes</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Max Marks</label>
                    <input type="number" value={subjectForm.maxMarks} onChange={e => setSubjectForm(f => ({ ...f, maxMarks: e.target.value }))}
                      style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Pass Marks</label>
                    <input type="number" value={subjectForm.passMarks} onChange={e => setSubjectForm(f => ({ ...f, passMarks: e.target.value }))}
                      style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                  <Button variant="ghost" onClick={() => setShowAddSubject(false)}>Cancel</Button>
                  <Button onClick={handleAddSubject} isLoading={addingSubject}>Add Subject</Button>
                </div>
              </div>
            )}

            <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
                    {["Subject", "Class", "Max Marks", "Pass Marks", "Exam Date"].map(h => (
                      <th key={h} style={{ padding: "0.875rem 1rem", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", color: "var(--text-tertiary)", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.slice(0, 50).map((s: any) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "1rem", fontWeight: "var(--font-medium)" }}>{s.subject?.name}</td>
                      <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{classes.find(c => c.id === s.classId)?.name || "Class"}</td>
                      <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{Number(s.maxMarks)}</td>
                      <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{Number(s.passMarks)}</td>
                      <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{s.examDate ? new Date(s.examDate).toLocaleDateString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                  {subjects.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>No subjects configured yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Marks Entry */}
        {tab === "marks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "220px" }}>
                <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Subject</label>
                <select value={selectedSubject?.id || ""}
                  onChange={e => {
                    const sub = subjects.find(s => s.id === e.target.value);
                    setSelectedSubject(sub || null);
                    if (sub && selectedSection) loadStudentsForMarks(sub.id, selectedSection);
                  }}
                  style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                  <option value="">Select Subject</option>
                  {subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.subject?.name} ({classes.find(c => c.id === s.classId)?.name || "Class"})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "200px" }}>
                <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Section</label>
                <select value={selectedSection}
                  onChange={e => {
                    setSelectedSection(e.target.value);
                    if (selectedSubject && e.target.value) loadStudentsForMarks(selectedSubject.id, e.target.value);
                  }}
                  style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                  <option value="">Select Section</option>
                  {classes.flatMap((c: any) => (c.sections || []).map((sec: any) => (
                    <option key={sec.id} value={sec.id}>{c.name} - {sec.name}</option>
                  )))}
                </select>
              </div>
            </div>

            {students.length > 0 && (
              <>
                <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
                  <div style={{ padding: "1rem", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: "var(--font-semibold)" }}>
                      {selectedSubject?.subject?.name} — {students.length} students (Max: {selectedSubject?.maxMarks})
                    </span>
                    {marksMsg && <span style={{ fontSize: "var(--text-sm)", color: marksMsg.includes("success") ? "var(--status-success)" : "var(--status-danger)" }}>{marksMsg}</span>}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
                        {["Roll No.", "Student Name", "Marks", "Absent", "Grade"].map(h => (
                          <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", color: "var(--text-tertiary)", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s: any) => {
                        const m = marks[s.studentId] ?? { marks: "", absent: false };
                        const pct = m.absent || !m.marks ? null : (parseFloat(m.marks) / Number(selectedSubject?.maxMarks)) * 100;
                        const grade = pct === null ? "—" : pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 50 ? "C" : pct >= 35 ? "D" : "F";
                        const gradeColor = grade === "A+" || grade === "A" ? "var(--status-success)" : grade === "F" ? "var(--status-danger)" : "var(--status-warning)";
                        return (
                          <tr key={s.studentId} style={{ borderBottom: "1px solid var(--border-subtle)", opacity: m.absent ? 0.6 : 1 }}>
                            <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>{s.rollNumber || "—"}</td>
                            <td style={{ padding: "0.75rem 1rem", fontWeight: "var(--font-medium)" }}>{s.name}</td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <input type="number" min="0" max={selectedSubject?.maxMarks ?? 100} value={m.marks} disabled={m.absent}
                                onChange={e => setMarks(prev => ({ ...prev, [s.studentId]: { ...prev[s.studentId], marks: e.target.value } }))}
                                style={{ width: "80px", padding: "0.375rem 0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: m.absent ? "var(--bg-elevated)" : "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }} />
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <input type="checkbox" checked={m.absent} onChange={e => setMarks(prev => ({ ...prev, [s.studentId]: { ...prev[s.studentId], absent: e.target.checked, marks: "" } }))} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                            </td>
                            <td style={{ padding: "0.75rem 1rem", fontWeight: "var(--font-semibold)", color: grade === "—" ? "var(--text-tertiary)" : gradeColor }}>{m.absent ? "AB" : grade}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <Button onClick={handleSaveMarks} isLoading={savingMarks}>
                    <Save size={16} style={{ marginRight: "0.5rem" }} /> Save Marks
                  </Button>
                </div>
              </>
            )}
            {(!selectedSubject || !selectedSection) && (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                Select a subject and section to start entering marks.
              </div>
            )}
          </div>
        )}

        {/* Results Tab */}
        {(tab === "results" || tab === "reportcards") && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Top KPI telemetry banner */}
            {resultStats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div style={{ background: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600 }}>
                    <UserCheck size={16} color="var(--brand-primary)" /> Total Evaluated
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.5rem", color: "var(--text-primary)" }}>{resultStats.totalRanked} Students</div>
                </div>

                <div style={{ background: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600 }}>
                    <TrendingUp size={16} color="var(--brand-blue)" /> Average Score
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.5rem", color: "var(--brand-blue)" }}>{resultStats.avgPct}%</div>
                </div>

                <div style={{ background: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600 }}>
                    <CheckCheck size={16} color="var(--status-success)" /> Pass Rate
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.5rem", color: "var(--status-success)" }}>{resultStats.passRate}%</div>
                </div>

                <div style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#b45309", fontSize: "0.8125rem", fontWeight: 700 }}>
                    <Sparkles size={16} color="#d97706" /> Top Ranker (#1)
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "0.35rem", color: "#92400e" }}>
                    {resultStats.topScorer?.student?.user?.firstName} {resultStats.topScorer?.student?.user?.lastName}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#b45309", marginTop: "0.15rem" }}>
                    {Number(resultStats.topScorer?.percentage).toFixed(1)}% · Grade {resultStats.topScorer?.grade}
                  </div>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "260px" }}>
                <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
                  <Search size={16} style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                  <input
                    type="text"
                    placeholder="Search student by name or adm..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: "100%", padding: "0.55rem 0.875rem 0.55rem 2.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Filter size={14} color="var(--text-tertiary)" />
                  <select
                    value={selectedClassFilter}
                    onChange={e => setSelectedClassFilter(e.target.value)}
                    style={{ padding: "0.55rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                  >
                    <option value="ALL">All Classes ({results.length})</option>
                    {availableClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Button onClick={handleGenerateReportCards} isLoading={generatingCards} variant="secondary">
                  Regenerate Report Cards
                </Button>
              </div>
            </div>

            {/* Results Table */}
            {filteredResults.length === 0 ? (
              <div style={{ padding: "3.5rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)" }}>
                <Trophy size={40} style={{ color: "var(--text-tertiary)", margin: "0 auto 1rem" }} />
                <p style={{ fontWeight: 600 }}>No results match your search/filter.</p>
              </div>
            ) : (
              <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
                      {["Rank", "Student Name", "Class", "Marks Obtained", "Percentage", "Grade", "Action"].map(h => (
                        <th key={h} style={{ padding: "0.875rem 1.25rem", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.slice(0, 100).map((r: any) => {
                      const pct = Number(r.percentage || 0);
                      const gradeColor = r.grade === "A+" || r.grade === "A" ? "var(--status-success)" : r.grade === "F" ? "var(--status-danger)" : "var(--status-warning)";
                      const isGold = r.rank === 1;
                      const isSilver = r.rank === 2;
                      const isBronze = r.rank === 3;

                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s" }}>
                          <td style={{ padding: "1rem 1.25rem" }}>
                            {isGold && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.2rem 0.6rem", borderRadius: "999px", background: "linear-gradient(135deg, #FDE68A, #F59E0B)", color: "#78350F", fontWeight: 800, fontSize: "0.8125rem", boxShadow: "0 2px 6px rgba(245, 158, 11, 0.3)" }}>
                                🥇 #1
                              </span>
                            )}
                            {isSilver && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.2rem 0.6rem", borderRadius: "999px", background: "#E2E8F0", color: "#334155", fontWeight: 800, fontSize: "0.8125rem" }}>
                                🥈 #2
                              </span>
                            )}
                            {isBronze && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.2rem 0.6rem", borderRadius: "999px", background: "#FED7AA", color: "#9A3412", fontWeight: 800, fontSize: "0.8125rem" }}>
                                🥉 #3
                              </span>
                            )}
                            {!isGold && !isSilver && !isBronze && (
                              <span style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                #{r.rank}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "1rem 1.25rem" }}>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.student?.user?.firstName} {r.student?.user?.lastName}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Adm: {r.student?.admissionNumber || "—"}</div>
                          </td>
                          <td style={{ padding: "1rem 1.25rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            {r.student?.enrollments?.[0]?.section?.class?.name || "Class"}
                          </td>
                          <td style={{ padding: "1rem 1.25rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            <strong>{Number(r.obtainedMarks).toFixed(0)}</strong> / {Number(r.totalMarks).toFixed(0)}
                          </td>
                          <td style={{ padding: "1rem 1.25rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <div style={{ width: "60px", height: "6px", borderRadius: "999px", background: "var(--bg-elevated)", overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: gradeColor, borderRadius: "999px" }} />
                              </div>
                              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: gradeColor }}>{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "1rem 1.25rem" }}>
                            <span style={{ background: `${gradeColor}18`, color: gradeColor, border: `1px solid ${gradeColor}30`, padding: "0.2rem 0.65rem", borderRadius: "999px", fontWeight: 700, fontSize: "0.75rem" }}>
                              {r.grade}
                            </span>
                          </td>
                          <td style={{ padding: "1rem 1.25rem" }}>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenReportCard(r.studentId)}>
                              View Card
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Official Report Card Modal */}
      {(previewStudent || loadingPreview) && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-2xl)", width: "100%", maxWidth: "720px", maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-default)", boxShadow: "var(--modal-shadow)" }}>
            {loadingPreview ? (
              <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading student report card...</div>
            ) : previewStudent ? (
              <div>
                {/* Modal Header Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Student Official Report Card</span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button size="sm" variant="secondary" onClick={() => window.print()}>
                      <Printer size={15} style={{ marginRight: "0.4rem" }} /> Print
                    </Button>
                    <button onClick={() => setPreviewStudent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "0.25rem" }}>
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Report Card Document Content */}
                <div style={{ padding: "2rem" }}>
                  {/* School Header */}
                  <div style={{ textAlign: "center", borderBottom: "2px solid var(--brand-primary)", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--brand-primary)", margin: "0 0 0.25rem" }}>SUNRISE PUBLIC SCHOOL</h2>
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>Affiliated to CBSE · Registration No: CBSE-DEL-00912</p>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, marginTop: "0.5rem", color: "var(--text-primary)" }}>
                      PROGRESS REPORT — {previewStudent.reportCard?.exam?.name || exam.name}
                    </p>
                  </div>

                  {/* Student Details Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "1rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
                    <div><span style={{ color: "var(--text-secondary)" }}>Student Name:</span> <strong>{previewStudent.reportCard?.student?.user?.firstName} {previewStudent.reportCard?.student?.user?.lastName}</strong></div>
                    <div><span style={{ color: "var(--text-secondary)" }}>Admission No:</span> <strong>{previewStudent.reportCard?.student?.admissionNumber}</strong></div>
                    <div><span style={{ color: "var(--text-secondary)" }}>Class & Section:</span> <strong>{previewStudent.reportCard?.student?.enrollments?.[0]?.section?.class?.name} - {previewStudent.reportCard?.student?.enrollments?.[0]?.section?.name}</strong></div>
                    <div><span style={{ color: "var(--text-secondary)" }}>Roll Number:</span> <strong>{previewStudent.reportCard?.student?.rollNumber || "—"}</strong></div>
                  </div>

                  {/* Subject Breakdown Table */}
                  <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "1.5rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
                          {["Subject & Group", "Max Marks", "Pass Marks", "Marks Scored", "Grade", "Status"].map(h => (
                            <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(previewStudent.subjectMarks || []).map((sm: any) => {
                          const max = Number(sm.examSubject?.maxMarks || 100);
                          const pass = Number(sm.examSubject?.passMarks || 35);
                          const scored = sm.isAbsent ? 0 : Number(sm.marksObtained || 0);
                          const isPassed = !sm.isAbsent && scored >= pass;

                          const matchEnrollment = previewStudent.curriculumEnrollments?.find(
                            (ce: any) =>
                              ce.subjectName?.toLowerCase() === sm.examSubject?.subject?.name?.toLowerCase() ||
                              (ce.subjectCode && sm.examSubject?.subject?.code && ce.subjectCode === sm.examSubject?.subject?.code)
                          );

                          return (
                            <tr key={sm.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "0.75rem 1rem" }}>
                                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                  {sm.examSubject?.subject?.name}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                                  {sm.examSubject?.subject?.code && (
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                                      {sm.examSubject?.subject?.code}
                                    </span>
                                  )}
                                  {matchEnrollment?.groupName && (
                                    <span style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem", borderRadius: "3px", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontWeight: 600 }}>
                                      {matchEnrollment.groupName}
                                    </span>
                                  )}
                                  {matchEnrollment?.selectionType && matchEnrollment.selectionType !== "MANDATORY" && (
                                    <span style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem", borderRadius: "3px", background: "rgba(99, 102, 241, 0.1)", color: "var(--brand-primary)", fontWeight: 700 }}>
                                      {matchEnrollment.selectionType}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>{max}</td>
                              <td style={{ padding: "0.75rem 1rem", color: "var(--text-secondary)" }}>{pass}</td>
                              <td style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>{sm.isAbsent ? "ABSENT" : scored}</td>
                              <td style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--brand-primary)" }}>{sm.isAbsent ? "—" : sm.grade}</td>
                              <td style={{ padding: "0.75rem 1rem" }}>
                                <span style={{ color: isPassed ? "var(--status-success)" : "var(--status-danger)", fontWeight: 700, fontSize: "0.75rem" }}>
                                  {isPassed ? "PASSED" : "FAILED"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Footer */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", padding: "1.25rem", background: "var(--bg-elevated)", borderRadius: "var(--radius-xl)", textAlign: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>TOTAL SCORE</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: "0.25rem" }}>
                        {Number(previewStudent.reportCard?.obtainedMarks).toFixed(0)} / {Number(previewStudent.reportCard?.totalMarks).toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>PERCENTAGE</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--brand-primary)", marginTop: "0.25rem" }}>
                        {Number(previewStudent.reportCard?.percentage).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>CLASS RANK</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#d97706", marginTop: "0.25rem" }}>
                        #{previewStudent.reportCard?.rank}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>OVERALL GRADE</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--status-success)", marginTop: "0.25rem" }}>
                        {previewStudent.reportCard?.grade}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
