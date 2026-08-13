"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft, Plus, BookOpen, BarChart2, FileText,
  CheckCircle, Clock, Save, Trophy
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

  // Results
  const [results, setResults] = useState<any[]>([]);
  const [generatingCards, setGeneratingCards] = useState(false);

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

  if (isLoading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "var(--text-secondary)" }}>Loading exam...</div>;
  }
  if (!exam) return <div>Exam not found</div>;

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BookOpen },
    { key: "subjects", label: "Subjects", icon: FileText },
    { key: "marks", label: "Marks Entry", icon: Save },
    { key: "results", label: "Results", icon: BarChart2 },
    { key: "reportcards", label: "Report Cards", icon: Trophy },
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
            {exam.examType.replace(/_/g, " ")} · {new Date(exam.startDate).toLocaleDateString("en-IN")} – {new Date(exam.endDate).toLocaleDateString("en-IN")}
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
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === "results") fetchResults(); }}
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
              { label: "Subjects", value: exam._count?.subjects ?? subjects.length, icon: FileText, color: "var(--brand-primary)" },
              { label: "Report Cards", value: exam._count?.reportCards ?? 0, icon: Trophy, color: "var(--status-success)" },
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
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
                  <div>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>Max Marks</label>
                    <input type="number" value={subjectForm.maxMarks} onChange={e => setSubjectForm(f => ({ ...f, maxMarks: e.target.value }))}
                      style={{ width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)", display: "block", marginBottom: "0.375rem" }}>Pass Marks</label>
                    <input type="number" value={subjectForm.passMarks} onChange={e => setSubjectForm(f => ({ ...f, passMarks: e.target.value }))}
                      style={{ width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <Button variant="ghost" onClick={() => setShowAddSubject(false)}>Cancel</Button>
                  <Button onClick={handleAddSubject} isLoading={addingSubject}>Add Subject</Button>
                </div>
              </div>
            )}

            {subjects.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                No subjects added yet. Add subjects to start marks entry.
              </div>
            ) : (
              <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
                      {["Subject", "Max Marks", "Pass Marks", "Exam Date", "Entries"].map(h => (
                        <th key={h} style={{ padding: "0.875rem 1rem", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s: any) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "1rem", fontWeight: "var(--font-medium)" }}>{s.subject?.name}</td>
                        <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{s.maxMarks}</td>
                        <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{s.passMarks}</td>
                        <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{s.examDate ? new Date(s.examDate).toLocaleDateString("en-IN") : "—"}</td>
                        <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{s._count?.marks ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Marks Entry */}
        {tab === "marks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "200px" }}>
                <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Select Subject</label>
                <select value={selectedSubject?.id ?? ""} onChange={e => {
                  const s = subjects.find(x => x.id === e.target.value);
                  setSelectedSubject(s ?? null);
                  setStudents([]);
                  if (s && selectedSection) loadStudentsForMarks(s.id, selectedSection);
                }} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)", minWidth: "200px" }}>
                  <option value="">-- Select Subject --</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.subject?.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: "200px" }}>
                <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Select Section</label>
                <select value={selectedSection} onChange={e => {
                  setSelectedSection(e.target.value);
                  if (selectedSubject && e.target.value) loadStudentsForMarks(selectedSubject.id, e.target.value);
                }} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)", minWidth: "200px" }}>
                  <option value="">-- Select Section --</option>
                  {classes.flatMap((c: any) => c.sections?.map((s: any) => (
                    <option key={s.id} value={s.id}>{c.name} — Section {s.name}</option>
                  )) ?? [])}
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
            {students.length === 0 && selectedSubject && selectedSection && (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                No students found in this section.
              </div>
            )}
            {(!selectedSubject || !selectedSection) && (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                Select a subject and section to start entering marks.
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {tab === "results" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <Button onClick={handleGenerateReportCards} isLoading={generatingCards} variant="secondary">
                Generate Report Cards
              </Button>
            </div>
            {results.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
                No results yet. Enter marks for all subjects, then generate report cards.
              </div>
            ) : (
              <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}>
                      {["Rank", "Student", "Marks", "Percentage", "Grade"].map(h => (
                        <th key={h} style={{ padding: "0.875rem 1rem", textAlign: "left", fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", color: "var(--text-tertiary)", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r: any) => {
                      const gradeColor = r.grade === "A+" || r.grade === "A" ? "var(--status-success)" : r.grade === "F" ? "var(--status-danger)" : "var(--status-warning)";
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "1rem", fontWeight: "var(--font-bold)", color: r.rank <= 3 ? "var(--brand-primary)" : "var(--text-secondary)" }}>#{r.rank}</td>
                          <td style={{ padding: "1rem", fontWeight: "var(--font-medium)" }}>{r.student?.user?.firstName} {r.student?.user?.lastName}</td>
                          <td style={{ padding: "1rem", color: "var(--text-secondary)" }}>{Number(r.obtainedMarks).toFixed(0)} / {Number(r.totalMarks).toFixed(0)}</td>
                          <td style={{ padding: "1rem" }}><span style={{ fontWeight: "var(--font-semibold)", color: gradeColor }}>{Number(r.percentage).toFixed(1)}%</span></td>
                          <td style={{ padding: "1rem" }}><span style={{ background: `${gradeColor}20`, color: gradeColor, padding: "0.25rem 0.625rem", borderRadius: "var(--radius-full)", fontWeight: "var(--font-semibold)", fontSize: "var(--text-xs)" }}>{r.grade}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Report Cards */}
        {tab === "reportcards" && (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)" }}>
            <Trophy size={48} style={{ color: "var(--brand-primary)", marginBottom: "1rem" }} />
            <p style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginBottom: "0.5rem" }}>Report Cards</p>
            <p style={{ marginBottom: "1.5rem" }}>Generate report cards first in the Results tab, then view individual student cards.</p>
            <Button onClick={() => { fetchResults(); setTab("results"); }}>View Results</Button>
          </div>
        )}
      </div>
    </div>
  );
}
