"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { 
  Calendar, Plus, Clock, MapPin, User as UserIcon, BookOpen, 
  Settings, X, RefreshCw, AlertCircle, CheckCircle2 
} from "lucide-react";

// Days of week mapping (1=Mon to 6=Sat)
const DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const PERIOD_TIMES = [
  { start: "08:30", end: "09:15" },
  { start: "09:15", end: "10:00" },
  { start: "10:00", end: "10:45" },
  { start: "10:45", end: "11:00", isBreak: true, name: "Short Break" },
  { start: "11:00", end: "11:45" },
  { start: "11:45", end: "12:30" },
  { start: "12:30", end: "13:15", isBreak: true, name: "Lunch Break" },
  { start: "13:15", end: "14:00" },
  { start: "14:00", end: "14:45" },
  { start: "14:45", end: "15:30" },
];

const SLOT_TYPES = ["CLASS", "BREAK", "ASSEMBLY", "FREE", "LAB"];

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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (form.slotType === "CLASS" && (!form.subjectId || !form.staffId)) {
      setError("Subject and Staff are required for CLASS slots");
      return;
    }
    setLoading(true); setError("");
    try {
      const payload = {
        classId, sectionId,
        dayOfWeek: day,
        periodNumber: period,
        startTime: timeStart,
        endTime: timeEnd,
        ...form
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "var(--bg-surface-solid)", borderRadius: "var(--radius-xl)", padding: "2rem", width: "100%", maxWidth: "420px", boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: "1.125rem" }}>Edit Period {period}</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{DAYS.find(d => d.id === day)?.name}, {timeStart} - {timeEnd}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={20} /></button>
        </div>

        {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.875rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}><AlertCircle size={16} style={{ flexShrink: 0, marginTop: "0.125rem" }} />{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Slot Type</label>
            <select value={form.slotType} onChange={e => setForm(f => ({ ...f, slotType: e.target.value, subjectId: "", staffId: "" }))} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem" }}>
              {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {["CLASS", "LAB"].includes(form.slotType) && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Subject *</label>
                <select value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem" }}>
                  <option value="">Select Subject...</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>Teacher *</label>
                <select value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem" }}>
                  <option value="">Select Teacher...</option>
                  {staff.map((s: any) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>)}
                </select>
              </div>
            </>
          )}

          <Input label="Room Number" value={form.roomNumber} onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))} placeholder="e.g. 101, Physics Lab" />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
            {slot?.id ? (
              <button onClick={remove} disabled={loading} style={{ color: "#dc2626", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>Delete Slot</button>
            ) : <div />}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={onClose} style={{ padding: "0.625rem 1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
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
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editSlotData, setEditSlotData] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get("/classes"),
      apiClient.get("/subjects"),
      apiClient.get("/staff"),
    ]).then(([cRes, subRes, staffRes]) => {
      const sData = staffRes.data?.data;
      setClasses(cRes.data?.data || cRes.data || []);
      setSubjects(subRes.data?.data || subRes.data || []);
      setStaff(Array.isArray(sData) ? sData : (sData?.data || []));
    }).catch(() => {});
  }, []);

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

  // Helper to find a slot in our state
  const getSlot = (day: number, period: number) => {
    return timetable.find(s => s.dayOfWeek === day && s.periodNumber === period);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "0.25rem" }}>Timetable Manager</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Plan and edit weekly class schedules visually</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)", padding: "1rem 1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Class *</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", minWidth: "160px" }}>
            <option value="">Select Class...</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>Section *</label>
          <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId} style={{ padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--bg-surface)", fontSize: "0.875rem", minWidth: "160px" }}>
            <option value="">Select Section...</option>
            {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={fetchTimetable} disabled={!classId || !sectionId || loading} style={{ padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center" }} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

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
              {(() => {
                let pIndex = 1; // Academic period counter
                return PERIOD_TIMES.map((time, idx) => {
                  if (time.isBreak) {
                    return (
                      <tr key={idx} style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "0.75rem", textAlign: "center", borderRight: "1px solid var(--border-light)" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", fontWeight: 600 }}>{time.start} - {time.end}</span>
                        </td>
                        <td colSpan={6} style={{ padding: "0.5rem", textAlign: "center", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "2px", textTransform: "uppercase", fontSize: "0.8125rem" }}>
                          {time.name}
                        </td>
                      </tr>
                    );
                  }

                  const currentPeriod = pIndex++;
                  
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "0.75rem", textAlign: "center", borderRight: "1px solid var(--border-light)", background: "var(--bg-app)" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>Period {currentPeriod}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{time.start} - {time.end}</div>
                      </td>
                      
                      {DAYS.map(day => {
                        const slot = getSlot(day.id, currentPeriod);
                        
                        return (
                          <td key={day.id} style={{ padding: "0", borderRight: "1px solid var(--border-light)", verticalAlign: "top", width: "16%" }}>
                            <div 
                              onClick={() => setEditSlotData({ slot, day: day.id, period: currentPeriod, timeStart: time.start, timeEnd: time.end })}
                              style={{ 
                                height: "100%", minHeight: "90px", padding: "0.75rem", cursor: "pointer",
                                transition: "background 0.15s",
                                background: slot ? (slot.slotType === "FREE" ? "#f3f4f6" : slot.slotType === "LAB" ? "#e0e7ff" : "var(--primary-50)") : "transparent"
                              }}
                              className="hover-bg-surface"
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
                                  <Plus size={20} className="hover-show" />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
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
