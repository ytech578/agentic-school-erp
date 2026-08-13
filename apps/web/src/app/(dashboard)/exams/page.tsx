"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, FileText, ChevronRight, BookOpen, CheckCircle, Clock } from "lucide-react";

const EXAM_TYPES = ["UNIT_TEST", "MIDTERM", "QUARTERLY", "HALF_YEARLY", "FINAL", "ANNUAL"];

export default function ExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", examType: "UNIT_TEST", academicYearId: "AY2026-27",
    startDate: "", endDate: "",
  });

  useEffect(() => { fetchExams(); }, []);

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/exams");
      setExams(res.data.data || res.data || []);
    } catch { setExams([]); } finally { setIsLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) return;
    setCreating(true);
    try {
      await apiClient.post("/exams", form);
      setShowCreate(false);
      setForm({ name: "", examType: "UNIT_TEST", academicYearId: "AY2026-27", startDate: "", endDate: "" });
      fetchExams();
    } catch { } finally { setCreating(false); }
  };

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      UNIT_TEST: "var(--status-info)", MIDTERM: "var(--status-warning)",
      QUARTERLY: "var(--brand-primary)", HALF_YEARLY: "var(--status-warning)",
      FINAL: "var(--status-danger)", ANNUAL: "var(--status-danger)",
    };
    return map[type] || "var(--text-secondary)";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "0.25rem" }}>
            Examinations
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Manage exams, marks entry, and report cards
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} style={{ marginRight: "0.5rem" }} /> Create Exam
        </Button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: "var(--z-modal)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowCreate(false)}>
          <div style={{
            background: "var(--bg-elevated)", borderRadius: "var(--radius-xl)", padding: "2rem",
            width: "100%", maxWidth: "480px", border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-xl)",
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "var(--text-xl)" }}>Create New Exam</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Input label="Exam Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Unit Test 1 — August 2026" />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--text-secondary)" }}>Exam Type *</label>
                <select value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}
                  style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                  {EXAM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input label="Start Date *" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                <Input label="End Date *" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <Button variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleCreate} isLoading={creating} style={{ flex: 1 }}>Create Exam</Button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Cards */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "160px", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", animation: "shimmer 1.5s infinite" }} />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)" }}>
          <BookOpen size={48} style={{ color: "var(--text-tertiary)", marginBottom: "1rem" }} />
          <p style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginBottom: "0.5rem" }}>No Exams Yet</p>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>Create your first exam to start entering marks and generating report cards.</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} style={{ marginRight: "0.5rem" }} /> Create First Exam
          </Button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {exams.map((exam: any) => (
            <div key={exam.id} onClick={() => router.push(`/exams/${exam.id}`)}
              style={{
                background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", padding: "1.5rem",
                border: "1px solid var(--border-default)", cursor: "pointer", transition: "all var(--duration-normal)",
                boxShadow: "var(--shadow-card)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-primary)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <span style={{
                    fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", color: typeColor(exam.examType),
                    backgroundColor: `${typeColor(exam.examType)}20`, padding: "0.25rem 0.625rem",
                    borderRadius: "var(--radius-full)", display: "inline-block", marginBottom: "0.5rem",
                  }}>{exam.examType.replace(/_/g, " ")}</span>
                  <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)" }}>{exam.name}</h3>
                </div>
                {exam.isPublished
                  ? <CheckCircle size={20} color="var(--status-success)" />
                  : <Clock size={20} color="var(--text-tertiary)" />}
              </div>
              <div style={{ display: "flex", gap: "1rem", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                <span>{new Date(exam.startDate).toLocaleDateString("en-IN")} – {new Date(exam.endDate).toLocaleDateString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", gap: "1rem", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                  <span>{exam._count?.subjects ?? 0} subjects</span>
                  <span>{exam._count?.reportCards ?? 0} report cards</span>
                </div>
                <ChevronRight size={16} color="var(--text-tertiary)" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
