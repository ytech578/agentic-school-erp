"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Save, CheckCircle, AlertCircle, Clock, Users,
  Calendar, Activity, Sparkles, TrendingUp
} from "lucide-react";

const ATTENDANCE_COLORS = {
  PRESENT: { bg: "var(--success-50)", text: "var(--success-700)", border: "var(--success-200)" },
  LATE: { bg: "var(--warning-50)", text: "var(--warning-700)", border: "var(--warning-200)" },
  HALF_DAY: { bg: "var(--info-50)", text: "var(--info-700)", border: "var(--info-200)" },
  ABSENT: { bg: "var(--danger-50)", text: "var(--danger-700)", border: "var(--danger-200)" }
};

export default function AttendancePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [dailyStats, setDailyStats] = useState<any>(null);

  const [students, setStudents] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string, type: "success" | "error" } | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await apiClient.get("/attendance/classes");
        setClasses(res.data.data || []);
      } catch (err) {
        console.error("Failed to load classes", err);
      }
    };
    fetchClasses();

    apiClient.get("/reports/attendance/daily")
      .then(res => setDailyStats(res.data.data || res.data))
      .catch(() => {});
  }, []);

  const fetchStudents = async () => {
    if (!selectedSectionId || !selectedDate) return;

    setIsLoadingStudents(true);
    setMessage(null);
    try {
      const res = await apiClient.get("/attendance/students", {
        params: { sectionId: selectedSectionId, date: selectedDate }
      });
      const data = res.data.data || [];
      setStudents(data);

      const initialRecords: Record<string, string> = {};
      data.forEach((student: any) => {
        initialRecords[student.id] = student.attendance?.status || "PRESENT";
      });
      setAttendanceRecords(initialRecords);

    } catch (err) {
      console.error("Failed to fetch students for attendance", err);
      setMessage({ text: "Failed to fetch students. Please try again.", type: "error" });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (selectedSectionId && selectedDate) {
      fetchStudents();
    }
  }, [selectedSectionId, selectedDate]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const markAll = (status: string) => {
    const newRecords: Record<string, string> = {};
    students.forEach(student => {
      newRecords[student.id] = status;
    });
    setAttendanceRecords(newRecords);
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const payload = {
        sectionId: selectedSectionId,
        date: selectedDate,
        records: students.map(student => ({
          studentId: student.id,
          status: attendanceRecords[student.id]
        }))
      };

      await apiClient.post("/attendance/mark", payload);
      setMessage({ text: "Attendance saved successfully!", type: "success" });
      apiClient.get("/reports/attendance/daily")
        .then(res => setDailyStats(res.data.data || res.data))
        .catch(() => {});
    } catch (err) {
      console.error("Failed to save attendance", (err as any).response?.data || err);
      setMessage({ text: "Failed to save attendance. Please try again.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const sections = selectedClass?.sections || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Daily Attendance
            <span style={{ fontSize: "0.75rem", background: "var(--brand-primary)", color: "white", padding: "0.2rem 0.5rem", borderRadius: "999px" }}>
              Live Telemetry
            </span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Mark and inspect attendance for students across all classes and sections.
          </p>
        </div>
      </div>

      {/* 30-Day Attendance Overview Banner */}
      {dailyStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600 }}>
              <Users size={16} color="var(--brand-primary)" /> Enrolled Students
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.4rem", color: "var(--text-primary)" }}>
              {dailyStats.totalStudents || 705}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>Active Across 12 Classes</div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600 }}>
              <TrendingUp size={16} color="var(--status-success)" /> Attendance Rate
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.4rem", color: "var(--status-success)" }}>
              {dailyStats.attendanceRate}%
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>Today's Campus Presence</div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600 }}>
              <CheckCircle size={16} color="var(--status-success)" /> Present Today
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.4rem", color: "var(--text-primary)" }}>
              {dailyStats.PRESENT || 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              +{dailyStats.LATE || 0} Late Arrivals
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600 }}>
              <AlertCircle size={16} color="var(--status-danger)" /> Absent Today
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.4rem", color: "var(--status-danger)" }}>
              {dailyStats.ABSENT || 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {dailyStats.EXCUSED || 0} Excused Leaves
            </div>
          </div>
        </div>
      )}

      {message && (
        <div style={{ 
          padding: "1rem", 
          backgroundColor: message.type === "success" ? "var(--success-50)" : "var(--danger-50)", 
          color: message.type === "success" ? "var(--success-600)" : "var(--danger-600)", 
          borderRadius: "var(--radius-md)", 
          border: `1px solid ${message.type === "success" ? "var(--success-200)" : "var(--danger-200)"}` 
        }}>
          {message.text}
        </div>
      )}

      {/* Filters Card */}
      <div className="card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Class</label>
            <select 
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSectionId("");
                setStudents([]);
              }}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)"
              }}
            >
              <option value="">-- Select Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Section</label>
            <select 
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={!selectedClassId}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)", backgroundColor: selectedClassId ? "var(--bg-surface)" : "var(--bg-surface-hover)",
                fontSize: "0.875rem", color: selectedClassId ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: selectedClassId ? "pointer" : "not-allowed"
              }}
            >
              <option value="">{selectedClassId ? "-- Select Section --" : "Select Class First"}</option>
              {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <Input 
              label="Date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
        </div>
      </div>

      {/* Attendance List */}
      {selectedSectionId && selectedDate && (
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h3 style={{ marginBottom: "0.25rem" }}>Student Attendance Register</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                {students.length} students enrolled in {selectedClass?.name} - {sections.find((s: any) => s.id === selectedSectionId)?.name}
              </p>
            </div>
            
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button variant="secondary" size="sm" onClick={() => markAll("PRESENT")}>Mark All Present</Button>
              <Button variant="secondary" size="sm" onClick={() => markAll("ABSENT")}>Mark All Absent</Button>
            </div>
          </div>

          {isLoadingStudents ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
              Loading students...
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
              No students found in this section.
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)", backgroundColor: "var(--bg-surface-hover)" }}>
                      <th style={{ padding: "1rem", fontWeight: 600, color: "var(--text-secondary)" }}>Roll No</th>
                      <th style={{ padding: "1rem", fontWeight: 600, color: "var(--text-secondary)" }}>Student Name</th>
                      <th style={{ padding: "1rem", fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "1rem", color: "var(--text-primary)" }}>{student.rollNumber || "-"}</td>
                        <td style={{ padding: "1rem", color: "var(--text-primary)", fontWeight: 500 }}>
                          {student.firstName} {student.lastName}
                        </td>
                        <td style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                            {["PRESENT", "LATE", "HALF_DAY", "ABSENT"].map((status) => {
                              const isSelected = attendanceRecords[student.id] === status;
                              const config = ATTENDANCE_COLORS[status as keyof typeof ATTENDANCE_COLORS];
                              
                              return (
                                <button
                                  key={status}
                                  onClick={() => handleStatusChange(student.id, status)}
                                  style={{
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.75rem",
                                    fontWeight: isSelected ? 600 : 500,
                                    border: "none",
                                    borderRight: status !== "ABSENT" ? "1px solid var(--border-light)" : "none",
                                    backgroundColor: isSelected ? config.bg : "var(--bg-surface)",
                                    color: isSelected ? config.text : "var(--text-secondary)",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                  }}
                                >
                                  {status.replace("_", " ")}
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

              <div style={{ padding: "1.5rem", borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "flex-end", backgroundColor: "var(--bg-surface-hover)" }}>
                <Button onClick={handleSaveAttendance} isLoading={isSaving}>
                  <Save size={18} style={{ marginRight: "0.5rem" }} />
                  Save Attendance
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
