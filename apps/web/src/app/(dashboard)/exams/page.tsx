"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Plus, BookOpen, CheckCircle, Clock, Pencil, Trash2,
  ChevronRight, X, AlertTriangle, Calendar
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

const EXAM_TYPES = ["UNIT_TEST", "MIDTERM", "QUARTERLY", "HALF_YEARLY", "FINAL", "ANNUAL"];

const typeColor = (type: string) => {
  const map: Record<string, { color: string; bg: string }> = {
    UNIT_TEST:   { color: "#3b82f6", bg: "#eff6ff" },
    MIDTERM:     { color: "#f59e0b", bg: "#fffbeb" },
    QUARTERLY:   { color: "#8b5cf6", bg: "#f5f3ff" },
    HALF_YEARLY: { color: "#f97316", bg: "#fff7ed" },
    FINAL:       { color: "#ef4444", bg: "#fef2f2" },
    ANNUAL:      { color: "#dc2626", bg: "#fef2f2" },
  };
  return map[type] || { color: "var(--text-secondary)", bg: "var(--bg-elevated)" };
};

// ─── Create/Edit Exam Modal ───────────────────────────────────────────────

function ExamModal({
  mode, exam, onClose, onSaved,
}: {
  mode: "create" | "edit";
  exam?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: exam?.name || "",
    examType: exam?.examType || "UNIT_TEST",
    academicYearId: "AY2026-27",
    startDate: exam?.startDate ? new Date(exam.startDate).toISOString().split("T")[0] : "",
    endDate: exam?.endDate ? new Date(exam.endDate).toISOString().split("T")[0] : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectStyle: React.CSSProperties = {
    padding: "0.625rem 0.875rem",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-default)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    width: "100%",
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setError("Name, start date and end date are required.");
      return;
    }
    setSaving(true); setError("");
    try {
      if (mode === "create") {
        await apiClient.post("/exams", form);
      } else {
        await apiClient.patch(`/exams/${exam.id}`, form);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save exam.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--bg-overlay)", backdropFilter: "var(--modal-backdrop-blur)", WebkitBackdropFilter: "var(--modal-backdrop-blur)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease-out" }}
      onClick={onClose}
    >
      <div style={{ background: "var(--bg-surface-solid)", borderRadius: "var(--radius-xl)", padding: "2rem", width: "100%", maxWidth: "480px", border: "1px solid var(--border-default)", boxShadow: "var(--modal-shadow)", animation: "zoomIn 0.2s ease-out" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>
            {mode === "create" ? "Create New Exam" : "Edit Exam"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={20} /></button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.875rem", display: "flex", gap: "0.5rem" }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input
            label="Exam Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Unit Test 1 — August 2026"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>Exam Type *</label>
            <select value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))} style={selectStyle}>
              {EXAM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Input label="Start Date *" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="End Date *" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving} style={{ flex: 1 }}>
            {mode === "create" ? "Create Exam" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────

function DeleteConfirmModal({ exam, onClose, onDeleted }: { exam: any; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true); setError("");
    try {
      await apiClient.delete(`/exams/${exam.id}`);
      onDeleted();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to delete exam.");
      setDeleting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "var(--bg-overlay)", backdropFilter: "var(--modal-backdrop-blur)", WebkitBackdropFilter: "var(--modal-backdrop-blur)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={onClose}
    >
      <div style={{ background: "var(--bg-surface-solid)", borderRadius: "var(--radius-xl)", padding: "2rem", width: "100%", maxWidth: "400px", border: "1px solid var(--border-default)", boxShadow: "var(--modal-shadow)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <Trash2 size={24} color="#dc2626" />
          </div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "0.5rem" }}>Delete Exam?</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            <strong>{exam.name}</strong> will be permanently deleted. This action cannot be undone.
          </p>
          {error && (
            <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "var(--radius-md)", marginTop: "1rem", fontSize: "0.875rem" }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ flex: 1, padding: "0.625rem 1rem", borderRadius: "var(--radius-md)", background: "#dc2626", color: "#fff", border: "none", fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1, fontSize: "0.875rem" }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Exams Page ───────────────────────────────────────────────────────

export default function ExamsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingExam, setEditingExam] = useState<any>(null);
  const [deletingExam, setDeletingExam] = useState<any>(null);

  useEffect(() => { fetchExams(); }, []);

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/exams");
      setExams(res.data.data || res.data || []);
    } catch { setExams([]); } finally { setIsLoading(false); }
  };

  const canEdit = user?.role !== 'TEACHER';

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
        {canEdit && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} style={{ marginRight: "0.5rem" }} /> Create Exam
          </Button>
        )}
      </div>

      {/* Exam Cards */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "180px", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", animation: "shimmer 1.5s infinite" }} />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)" }}>
          <BookOpen size={48} style={{ color: "var(--text-tertiary)", marginBottom: "1rem" }} />
          <p style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", marginBottom: "0.5rem" }}>No Exams Yet</p>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>Create your first exam to start entering marks and generating report cards.</p>
          {canEdit && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} style={{ marginRight: "0.5rem" }} /> Create First Exam
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {exams.map((exam: any) => {
            const tc = typeColor(exam.examType);
            return (
              <div
                key={exam.id}
                style={{
                  background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", padding: "1.5rem",
                  border: "1px solid var(--border-default)", transition: "all var(--duration-normal)",
                  boxShadow: "var(--shadow-card)", position: "relative",
                  borderTop: `3px solid ${tc.color}`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-lg)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)"; }}
              >
                {/* Type badge + status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: tc.color, background: tc.bg, padding: "0.25rem 0.625rem", borderRadius: "var(--radius-full)" }}>
                    {exam.examType.replace(/_/g, " ")}
                  </span>
                  {exam.isPublished
                    ? <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}><CheckCircle size={13} /> Published</span>
                    : <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-tertiary)", fontWeight: 600 }}><Clock size={13} /> Draft</span>
                  }
                </div>

                {/* Exam Name */}
                <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-primary)" }}>
                  {exam.name}
                </h3>

                {/* Dates */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  <Calendar size={13} />
                  {new Date(exam.startDate).toLocaleDateString("en-IN")} – {new Date(exam.endDate).toLocaleDateString("en-IN")}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                    <span>{exam._count?.subjects ?? 0} subjects</span>
                    <span>{exam._count?.reportCards ?? 0} reports</span>
                  </div>

                  <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                    {/* Edit button */}
                    {canEdit && (
                      <button
                        onClick={e => { e.stopPropagation(); setEditingExam(exam); }}
                        title="Edit exam"
                        style={{ padding: "0.4rem", borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", transition: "all 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; (e.currentTarget as HTMLElement).style.color = "var(--brand-primary)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {/* Delete button */}
                    {canEdit && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingExam(exam); }}
                        title="Delete exam"
                        style={{ padding: "0.4rem", borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", transition: "all 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fef2f2"; (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    {/* View button */}
                    <button
                      onClick={() => router.push(`/exams/${exam.id}`)}
                      title="View exam details"
                      style={{ padding: "0.4rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem", transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-primary)"; (e.currentTarget as HTMLElement).style.color = "var(--brand-primary)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
                    >
                      Open <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <ExamModal mode="create" onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); fetchExams(); }} />
      )}
      {editingExam && (
        <ExamModal mode="edit" exam={editingExam} onClose={() => setEditingExam(null)} onSaved={() => { setEditingExam(null); fetchExams(); }} />
      )}
      {deletingExam && (
        <DeleteConfirmModal exam={deletingExam} onClose={() => setDeletingExam(null)} onDeleted={() => { setDeletingExam(null); fetchExams(); }} />
      )}
    </div>
  );
}
