"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { TIMETABLE_TEMPLATES, getClassCategory } from "@school-erp/shared";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { 
  Calendar, Plus, Clock, MapPin, User as UserIcon, BookOpen, 
  X, RefreshCw, AlertCircle, CheckCircle2, Sparkles, Filter
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

// Days of week mapping (1=Mon to 6=Sat)
const DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

const SLOT_TYPES = ["CLASS", "BREAK", "ASSEMBLY", "FREE", "LAB"];

const selectStyle: React.CSSProperties = {
  padding: "0.625rem 0.875rem",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "0.875rem",
  width: "100%",
};

// ─── Slot Editor Modal ─────────────────────────────────────────────────────

function SlotEditor({ 
  slot, classId, sectionId, day, period, timeStart, timeEnd, 
  subjects, staff, onClose, onSaved 
}: any) {
  const [form, setForm] = useState({
    id: slot?.id,
    subjectId: slot?.subjectId || "",
    staffId: slot?.staffId || "",
    roomNumber: slot?.roomNumber || "",
    slotType: slot?.slotType || "CLASS",
    startTime: slot?.startTime || timeStart || "",
    endTime: slot?.endTime || timeEnd || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filter staff by selected subject's teaching assignments
  // Staff has teacherAssignments — filter to those that include the selected subject
  const filteredStaff = form.subjectId
    ? staff.filter((s: any) => {
        if (!s.teacherAssignments || s.teacherAssignments.length === 0) return true; // include unassigned
        return s.teacherAssignments.some(
          (ta: any) => ta.subjectId === form.subjectId
        );
      })
    : staff;

  // When subject changes, clear staff if currently selected doesn't teach it
  const handleSubjectChange = (subjectId: string) => {
    const staffStillValid = subjectId
      ? filteredStaff.some((s: any) => s.id === form.staffId)
      : true;
    setForm(f => ({
      ...f,
      subjectId,
      staffId: staffStillValid ? f.staffId : "",
    }));
  };

  const save = async () => {
    if (form.slotType === "CLASS" && (!form.subjectId || !form.staffId)) {
      setError("Subject and Staff are required for CLASS slots");
      return;
    }
    if (!form.startTime || !form.endTime) {
      setError("Start time and end time are required");
      return;
    }
    setLoading(true); setError("");
    try {
      const payload = {
        classId, sectionId,
        dayOfWeek: day,
        periodNumber: period,
        startTime: form.startTime,
        endTime: form.endTime,
        subjectId: form.subjectId || undefined,
        staffId: form.staffId || undefined,
        roomNumber: form.roomNumber || undefined,
        slotType: form.slotType,
        id: form.id,
      };
      await apiClient.post("/timetable/slots", payload);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save slot. Might be a conflict.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!slot?.id) return onClose();
    setLoading(true);
    try {
      await apiClient.delete(`/timetable/slots/${slot.id}`);
      onSaved();
    } catch { } finally { setLoading(false); }
  };

  const dayName = DAYS.find(d => d.id === day)?.name;

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", backdropFilter: "var(--modal-backdrop-blur)", WebkitBackdropFilter: "var(--modal-backdrop-blur)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: "var(--bg-surface-solid)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", padding: "2rem", width: "100%", maxWidth: "460px", boxShadow: "var(--modal-shadow)", animation: "zoomIn 0.2s ease-out" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: "1.125rem" }}>
              {slot?.id ? "Edit" : "Add"} Period {period}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {dayName}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={20} /></button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.875rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "0.125rem" }} />{error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Slot Type */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Slot Type</label>
            <select value={form.slotType} onChange={e => setForm(f => ({ ...f, slotType: e.target.value, subjectId: "", staffId: "" }))} style={selectStyle}>
              {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Time Range — always editable */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                <Clock size={13} style={{ display: "inline", marginRight: "0.3rem" }} />
                Start Time *
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                style={selectStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                <Clock size={13} style={{ display: "inline", marginRight: "0.3rem" }} />
                End Time *
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                style={selectStyle}
              />
            </div>
          </div>

          {["CLASS", "LAB"].includes(form.slotType) && (
            <>
              {/* Subject */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Subject *</label>
                <select
                  value={form.subjectId}
                  onChange={e => handleSubjectChange(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Select Subject...</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Teacher — filtered by selected subject */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Teacher *
                  {form.subjectId && filteredStaff.length < staff.length && (
                    <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--brand-primary)", marginLeft: "0.5rem" }}>
                      <Filter size={10} style={{ display: "inline" }} /> Filtered by subject
                    </span>
                  )}
                </label>
                <select
                  value={form.staffId}
                  onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))}
                  style={selectStyle}
                  disabled={!form.subjectId}
                >
                  <option value="">
                    {form.subjectId
                      ? filteredStaff.length === 0
                        ? "No teachers assigned to this subject"
                        : "Select Teacher..."
                      : "Select a subject first..."}
                  </option>
                  {filteredStaff.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.user.firstName} {s.user.lastName}
                      {s.designation?.name ? ` — ${s.designation.name}` : ""}
                    </option>
                  ))}
                </select>
                {form.subjectId && filteredStaff.length === 0 && (
                  <p style={{ fontSize: "0.75rem", color: "var(--status-warning)", margin: "0.25rem 0 0" }}>
                    No teachers are assigned to this subject. All teachers will be shown.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Room Number */}
          <Input
            label="Room Number"
            value={form.roomNumber}
            onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))}
            placeholder="e.g. 101, Physics Lab"
          />

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
            {slot?.id ? (
              <button
                onClick={remove}
                disabled={loading}
                style={{ color: "#dc2626", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}
              >
                Delete Slot
              </button>
            ) : <div />}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={onClose}
                style={{ padding: "0.625rem 1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", fontSize: "0.875rem" }}
              >
                Cancel
              </button>
              <Button onClick={save} isLoading={loading}>Save</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Timetable Page ───────────────────────────────────────────────────

export default function TimetablePage() {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editSlotData, setEditSlotData] = useState<any>(null);

  const selectedClassDetails = classes.find(c => c.id === classId);
  const classCategory = selectedClassDetails ? (getClassCategory ? getClassCategory(selectedClassDetails.name) : 'HIGH') : 'HIGH';
  const periodTimes = (TIMETABLE_TEMPLATES && TIMETABLE_TEMPLATES[classCategory as keyof typeof TIMETABLE_TEMPLATES]) || [];

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const cRes = await apiClient.get("/classes");
        setClasses(cRes.data?.data || cRes.data || []);
      } catch (e) { console.error("Failed to load classes", e); }

      try {
        const subRes = await apiClient.get("/subjects");
        setSubjects(subRes.data?.data || subRes.data || []);
      } catch (e) { console.error("Failed to load subjects", e); }

      if (user?.role !== 'TEACHER') {
        try {
          // Fetch staff with their teaching subjects for filtering
          const staffRes = await apiClient.get("/staff?includeSubjects=true");
          const sData = staffRes.data?.data;
          setStaff(Array.isArray(sData) ? sData : (sData?.items || []));
        } catch (e) { console.error("Failed to load staff", e); }
      }
    };
    
    fetchInitialData();
  }, [user?.role]);

  useEffect(() => {
    setSections([]); setSectionId(""); setTimetable([]);
    if (classId) {
      apiClient.get(`/classes/${classId}/sections`).then(res => {
        setSections(res.data.data || res.data || []);
      }).catch(() => {});
    }
  }, [classId]);

  const fetchTimetable = useCallback(async () => {
    if (!classId || !sectionId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/timetable?classId=${classId}&sectionId=${sectionId}`);
      setTimetable(res.data.data || res.data || []);
    } catch { } finally { setLoading(false); }
  }, [classId, sectionId]);

  useEffect(() => {
    if (classId && sectionId) fetchTimetable();
  }, [classId, sectionId, fetchTimetable]);

  const autoGenerate = async () => {
    if (!classId || !sectionId) return;
    if (!window.confirm("This will overwrite the current timetable for this section. Are you sure?")) return;
    setLoading(true);
    try {
      const res = await apiClient.post("/timetable/auto-generate", { classId, sectionId });
      await fetchTimetable();
      alert(res.data?.data?.message || res.data?.message || "Timetable generated successfully!");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to generate timetable.");
    } finally {
      setLoading(false);
    }
  };

  const getSlot = (day: number, period: number) => {
    return timetable.find(s => s.dayOfWeek === day && s.periodNumber === period);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "0.25rem" }}>
            {user?.role === 'TEACHER' ? 'Timetable Viewer' : 'Timetable Manager'}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            {user?.role === 'TEACHER' ? 'View class schedules' : 'Plan and edit weekly class schedules visually'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Class *</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={{ ...selectStyle, minWidth: "160px" }}>
            <option value="">Select Class...</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Section *</label>
          <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId} style={{ ...selectStyle, minWidth: "160px" }}>
            <option value="">Select Section...</option>
            {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button
          onClick={fetchTimetable}
          disabled={!classId || !sectionId || loading}
          style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center" }}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
        {user?.role !== 'TEACHER' && classId && sectionId && (
          <Button 
            onClick={autoGenerate} 
            disabled={loading}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Sparkles size={16} /> Auto-Generate
          </Button>
        )}
      </div>

      {/* Legend */}
      {classId && sectionId && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "var(--primary-50)", border: "1px solid var(--primary-200)", display: "inline-block" }} />CLASS</span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "#e0e7ff", border: "1px solid #c7d2fe", display: "inline-block" }} />LAB</span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><span style={{ width: 12, height: 12, borderRadius: 2, background: "#f3f4f6", border: "1px solid #e5e7eb", display: "inline-block" }} />FREE / BREAK</span>
          {user?.role !== 'TEACHER' && <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Click any cell to edit</span>}
        </div>
      )}

      {/* Timetable Grid */}
      {classId && sectionId ? (
        <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead>
              <tr style={{ background: "var(--bg-app)" }}>
                <th style={{ padding: "1rem", width: "100px", borderBottom: "1px solid var(--border-light)", borderRight: "1px solid var(--border-light)" }}></th>
                {DAYS.map(d => (
                  <th key={d.id} style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-light)", borderRight: "1px solid var(--border-light)" }}>
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodTimes.map((period: any, idx: number) => {
                if (period.isBreak) {
                  return (
                    <tr key={idx} style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "0.75rem", textAlign: "center", borderRight: "1px solid var(--border-light)" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", fontWeight: 600 }}>{period.start} - {period.end}</span>
                      </td>
                      <td colSpan={6} style={{ padding: "0.5rem", textAlign: "center", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "2px", textTransform: "uppercase", fontSize: "0.8125rem" }}>
                        {period.name}
                      </td>
                    </tr>
                  );
                }

                const currentPeriod = period.num;
                
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "0.75rem", textAlign: "center", borderRight: "1px solid var(--border-light)", background: "var(--bg-app)" }}>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>Period {currentPeriod}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{period.start} - {period.end}</div>
                    </td>
                    
                    {DAYS.map(day => {
                      const slot = getSlot(day.id, currentPeriod);
                      
                      return (
                        <td key={day.id} style={{ padding: "0", borderRight: "1px solid var(--border-light)", verticalAlign: "top", width: "16%" }}>
                          <div 
                            onClick={() => {
                              if (user?.role !== 'TEACHER') {
                                setEditSlotData({ slot, day: day.id, period: currentPeriod, timeStart: period.start, timeEnd: period.end });
                              }
                            }}
                            style={{ 
                              height: "100%", minHeight: "90px", padding: "0.75rem", 
                              cursor: user?.role !== 'TEACHER' ? "pointer" : "default",
                              transition: "background 0.15s",
                              background: slot ? (slot.slotType === "FREE" || slot.slotType === "BREAK" ? "#f3f4f6" : slot.slotType === "LAB" ? "#e0e7ff" : "var(--primary-50)") : "transparent"
                            }}
                            className={user?.role !== 'TEACHER' ? "hover-bg-surface" : ""}
                          >
                            {slot ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", height: "100%" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--primary-700)" }}>{slot.subject?.name || slot.slotType}</span>
                                  {slot.slotType !== "CLASS" && <span style={{ fontSize: "0.625rem", fontWeight: 700, padding: "0.125rem 0.375rem", borderRadius: "4px", background: "var(--bg-surface)", color: "var(--text-secondary)" }}>{slot.slotType}</span>}
                                </div>
                                
                                {slot.staff && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "auto" }}>
                                    <UserIcon size={12} /> {slot.staff.user.firstName} {slot.staff.user.lastName}
                                  </div>
                                )}
                                
                                {slot.roomNumber && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    <MapPin size={12} /> {slot.roomNumber}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--border-light)" }}>
                                {user?.role !== 'TEACHER' && <Plus size={20} className="hover-show" />}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <style dangerouslySetInnerHTML={{__html: `
            .hover-bg-surface:hover { background: var(--bg-surface) !important; box-shadow: inset 0 0 0 1px var(--primary-500); }
            .hover-show { opacity: 0; transition: opacity 0.2s; }
            .hover-bg-surface:hover .hover-show { opacity: 1; color: var(--primary-500); }
          `}} />
        </div>
      ) : (
        <div style={{ padding: "4rem", textAlign: "center", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border-light)" }}>
          <Calendar size={48} color="var(--border-default)" style={{ marginBottom: "1rem" }} />
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>No Class Selected</h3>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>Select a class and section to view or edit its timetable</p>
        </div>
      )}

      {/* Editor Modal */}
      {editSlotData && (
        <SlotEditor
          {...editSlotData}
          classId={classId}
          sectionId={sectionId}
          subjects={subjects}
          staff={staff}
          onClose={() => setEditSlotData(null)}
          onSaved={() => { setEditSlotData(null); fetchTimetable(); }}
        />
      )}
    </div>
  );
}
