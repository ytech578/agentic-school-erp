"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, Award, Trash2, Search, Pencil, X, Trophy, Mic2,
  Palette, FlaskConical, Users, BookOpen, Filter, Star,
  TrendingUp, Calendar as CalendarIcon
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";

// ─── Categories ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "ACADEMIC",   label: "Academic",    color: "#3b82f6", bg: "#eff6ff", icon: BookOpen },
  { id: "SPORTS",     label: "Sports",      color: "#10b981", bg: "#f0fdf4", icon: Trophy },
  { id: "CULTURAL",   label: "Cultural",    color: "#f59e0b", bg: "#fffbeb", icon: Mic2 },
  { id: "ARTS",       label: "Arts",        color: "#ec4899", bg: "#fdf2f8", icon: Palette },
  { id: "SCIENCE",    label: "Science",     color: "#8b5cf6", bg: "#f5f3ff", icon: FlaskConical },
  { id: "COMMUNITY",  label: "Community",   color: "#06b6d4", bg: "#ecfeff", icon: Users },
  { id: "OTHER",      label: "Other",       color: "#64748b", bg: "#f1f5f9", icon: Star },
];

const getCat = (id: string) => CATEGORIES.find(c => c.id === id) || CATEGORIES[6];

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Form Modal ───────────────────────────────────────────────────────────

function ActivityModal({
  mode, activity, students, onClose, onSaved,
}: {
  mode: "create" | "edit";
  activity?: any;
  students: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    studentId: activity?.studentId || activity?.student?.id || "",
    title:       activity?.title || "",
    event:       activity?.event || "",
    category:    activity?.category || "ACADEMIC",
    date:        activity?.date ? new Date(activity.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    description: activity?.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.625rem 0.875rem",
    borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)",
    background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)",
    display: "block", marginBottom: "0.4rem",
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.title || !form.event) {
      setError("Student, title and event are required.");
      return;
    }
    setSaving(true); setError("");
    try {
      if (mode === "create") {
        await apiClient.post("/activities", form);
      } else {
        await apiClient.patch(`/activities/${activity.id}`, form);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save activity.");
    } finally { setSaving(false); }
  };

  const selectedCat = getCat(form.category);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", backdropFilter: "var(--modal-backdrop-blur)", WebkitBackdropFilter: "var(--modal-backdrop-blur)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease-out" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface-solid)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--modal-shadow)", maxWidth: "32rem", width: "100%", maxHeight: "90vh", overflowY: "auto", animation: "zoomIn 0.2s ease-out" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-surface-solid)", zIndex: 10 }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Award size={22} color="var(--brand-primary)" />
            {mode === "create" ? "Log Achievement" : "Edit Achievement"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {error && (
            <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "var(--radius-md)", fontSize: "0.875rem" }}>{error}</div>
          )}

          {/* Student */}
          <div>
            <label style={labelStyle}>Student *</label>
            <select required style={inputStyle} value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Select Student...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category *</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {CATEGORIES.map(cat => {
                const CatIcon = cat.icon;
                const active = form.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat.id })}
                    style={{
                      padding: "0.375rem 0.75rem", borderRadius: "var(--radius-full)",
                      border: `1.5px solid ${active ? cat.color : "var(--border-default)"}`,
                      background: active ? cat.bg : "transparent",
                      color: active ? cat.color : "var(--text-secondary)",
                      fontSize: "0.75rem", fontWeight: active ? 700 : 500, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "0.3rem",
                      transition: "all 0.15s",
                    }}
                  >
                    <CatIcon size={12} /> {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Achievement Title *</label>
            <input required type="text" placeholder="e.g. 1st Place in Science Fair" style={inputStyle}
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>

          {/* Event */}
          <div>
            <label style={labelStyle}>Event Name *</label>
            <input required type="text" placeholder="e.g. State Science Exhibition 2026" style={inputStyle}
              value={form.event} onChange={e => setForm({ ...form, event: e.target.value })} />
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}>Date *</label>
            <input required type="date" style={inputStyle}
              value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description (Optional)</label>
            <textarea rows={3} placeholder="Additional details, awards, recognition..." style={{ ...inputStyle, resize: "vertical" }}
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          <div style={{ paddingTop: "0.5rem", display: "flex", gap: "0.75rem", borderTop: "1px solid var(--border-default)", marginTop: "0.5rem" }}>
            <Button type="button" variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button type="submit" isLoading={saving} style={{ flex: 1 }}>
              {mode === "create" ? "Save Achievement" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ActivitiesAdminPage() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editActivity, setEditActivity] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [actRes, stuRes] = await Promise.all([
        apiClient.get("/activities"),
        apiClient.get("/students"),
      ]);
      setActivities(actRes.data.data || actRes.data || []);
      setStudents(stuRes.data.data || stuRes.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this activity record?")) return;
    try {
      await apiClient.delete(`/activities/${id}`);
      fetchData();
    } catch { alert("Failed to delete activity"); }
  };

  const filtered = useMemo(() => {
    let list = activities;
    if (filterCategory !== "ALL") list = list.filter(a => a.category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.event?.toLowerCase().includes(q) ||
        `${a.student?.user?.firstName} ${a.student?.user?.lastName}`.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activities, search, filterCategory]);

  // Stats
  const thisMonth = activities.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const catCounts = CATEGORIES.reduce((acc, c) => {
    acc[c.id] = activities.filter(a => a.category === c.id).length;
    return acc;
  }, {} as Record<string, number>);

  const topCat = CATEGORIES.reduce((a, b) => catCounts[a.id] >= catCounts[b.id] ? a : b, CATEGORIES[0]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "0.25rem" }}>
            Activities & Achievements
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Log and track student achievements, extra-curriculars, and awards.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Plus size={18} /> Log Achievement
        </Button>
      </div>

      {/* Stats Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {[
          { label: "Total Activities", value: activities.length, icon: Award, color: "var(--brand-primary)", bg: "rgba(99,102,241,0.1)" },
          { label: "This Month", value: thisMonth, icon: CalendarIcon, color: "#10b981", bg: "rgba(16,185,129,0.1)" },
          { label: "Top Category", value: activities.length > 0 ? topCat.label : "—", icon: TrendingUp, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
          { label: "Students Recognized", value: new Set(activities.map(a => a.studentId)).size, icon: Star, color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", padding: "1.25rem", border: "1px solid var(--border-default)", display: "flex", gap: "0.875rem", alignItems: "center", borderLeft: `3px solid ${color}` }}>
            <div style={{ padding: "0.65rem", borderRadius: "var(--radius-md)", background: bg }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.15rem" }}>{label}</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category Breakdown Pills */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 600, marginRight: "0.25rem" }}>
          <Filter size={13} style={{ display: "inline", marginRight: "0.25rem" }} />Filter:
        </span>
        <button
          onClick={() => setFilterCategory("ALL")}
          style={{ padding: "0.3rem 0.875rem", borderRadius: "var(--radius-full)", border: `1.5px solid ${filterCategory === "ALL" ? "var(--brand-primary)" : "var(--border-default)"}`, background: filterCategory === "ALL" ? "rgba(99,102,241,0.1)" : "transparent", color: filterCategory === "ALL" ? "var(--brand-primary)" : "var(--text-secondary)", fontSize: "0.75rem", fontWeight: filterCategory === "ALL" ? 700 : 500, cursor: "pointer" }}
        >
          All ({activities.length})
        </button>
        {CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          const cnt = catCounts[cat.id];
          if (cnt === 0) return null;
          const active = filterCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(active ? "ALL" : cat.id)}
              style={{ padding: "0.3rem 0.875rem", borderRadius: "var(--radius-full)", border: `1.5px solid ${active ? cat.color : "var(--border-default)"}`, background: active ? cat.bg : "transparent", color: active ? cat.color : "var(--text-secondary)", fontSize: "0.75rem", fontWeight: active ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", transition: "all 0.15s" }}
            >
              <CatIcon size={11} /> {cat.label} ({cnt})
            </button>
          );
        })}
      </div>

      {/* List Panel */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", overflow: "hidden" }}>
        {/* Search bar */}
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
            <input
              type="text"
              placeholder="Search by student name, title, or event…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", paddingLeft: "2.25rem", paddingRight: "0.875rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-app)", color: "var(--text-primary)", fontSize: "0.875rem", fontFamily: "inherit" }}
            />
          </div>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Activity list */}
        <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} style={{ height: "80px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", animation: "shimmer 1.5s infinite" }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>
              <Award size={40} style={{ margin: "0 auto 1rem", opacity: 0.2 }} />
              <p>No activities found.</p>
            </div>
          ) : filtered.map(a => {
            const cat = getCat(a.category || "OTHER");
            const CatIcon = cat.icon;
            return (
              <div
                key={a.id}
                style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", transition: "border-color 0.15s", position: "relative", borderLeft: `3px solid ${cat.color}` }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = cat.color}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"}
              >
                {/* Category icon */}
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CatIcon size={22} color={cat.color} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                      {a.student?.user?.firstName} {a.student?.user?.lastName}
                    </span>
                    <span style={{ padding: "0.15rem 0.5rem", borderRadius: "var(--radius-full)", fontSize: "0.7rem", fontWeight: 700, background: cat.bg, color: cat.color }}>
                      {cat.label}
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem", marginBottom: "0.15rem" }}>{a.title}</p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    {a.event} • {fmtDate(a.date)}
                  </p>
                  {a.description && (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "480px" }}>
                      {a.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                  <button
                    onClick={() => setEditActivity(a)}
                    title="Edit"
                    style={{ padding: "0.45rem", borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; (e.currentTarget as HTMLElement).style.color = "var(--brand-primary)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    title="Delete"
                    style={{ padding: "0.45rem", borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fef2f2"; (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <ActivityModal
          mode="create"
          students={students}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData(); }}
        />
      )}
      {editActivity && (
        <ActivityModal
          mode="edit"
          activity={editActivity}
          students={students}
          onClose={() => setEditActivity(null)}
          onSaved={() => { setEditActivity(null); fetchData(); }}
        />
      )}
    </div>
  );
}
