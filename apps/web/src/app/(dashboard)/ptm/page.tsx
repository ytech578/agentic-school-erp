"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";
import { 
  CalendarClock, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Eye, 
  Users,
  Video,
  ExternalLink,
  Filter,
  CalendarDays
} from "lucide-react";

interface StudentProfile {
  id: string;
  admissionNumber?: string;
  user?: { firstName: string; lastName: string };
}
interface PTMSlot {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  teacherId?: string;
  teacher?: {
    id: string;
    user?: { firstName: string; lastName: string };
    designation?: { name?: string };
  };
  student?: StudentProfile;
  parentNotes?: string;
  teacherNotes?: string;
}
interface PTMSession {
  id: string;
  title: string;
  description?: string;
  location?: string;
  mode?: string;
  meetingLink?: string;
  meetingDate?: string;
  date?: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  slotDuration?: number;
  slots?: PTMSlot[];
  _count?: { slots: number };
}

export default function PtmSchedulingPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<PTMSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<PTMSession | null>(null);
  const [isSlotsModalOpen, setIsSlotsModalOpen] = useState(false);
  const [slotFilterStatus, setSlotFilterStatus] = useState<string>("ALL");
  const [slotFilterTeacherId, setSlotFilterTeacherId] = useState<string>("ALL");

  // Create session modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("Term 1 Academic Review");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [slotDuration, setSlotDuration] = useState(15);
  const [location, setLocation] = useState("Classroom / Online");
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  // Book slot modal
  const [activeSlotToBook, setActiveSlotToBook] = useState<PTMSlot | null>(null);
  const [studentIdToBook, setStudentIdToBook] = useState("");
  const [parentNotes, setParentNotes] = useState("");
  const [students, setStudents] = useState<StudentProfile[]>([]);

  // Feedback modal
  const [activeSlotForFeedback, setActiveSlotForFeedback] = useState<PTMSlot | null>(null);
  const [teacherFeedback, setTeacherFeedback] = useState("");

  const extractList = (res: any) => {
    const raw = res?.data?.data || res?.data || [];
    return Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  };

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    const error = err as { response?: { data?: { message?: string } } };
    return error?.response?.data?.message || fallback;
  };

  useEffect(() => {
    fetchSessions();
    apiClient.get("/students?limit=50")
      .then((res) => setStudents(extractList(res)))
      .catch(() => setStudents([]));

    apiClient.get("/staff?limit=100")
      .then((res) => {
        const list = extractList(res);
        setTeachersList(list);
        setSelectedTeacherIds(list.map((t: any) => t.id));
      })
      .catch(() => setTeachersList([]));

    apiClient.get("/classes")
      .then((res) => setClassesList(extractList(res)))
      .catch(() => setClassesList([]));
  }, []);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/ptm/sessions");
      setSessions(extractList(res));
    } catch (err) {
      console.error("Failed to load PTM sessions", err);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (selectedTeacherIds.length === 0) {
      alert("Please select at least one participating teacher.");
      return;
    }
    try {
      await apiClient.post("/ptm/sessions", {
        title: sessionTitle,
        date: sessionDate,
        startTime,
        endTime,
        slotDuration: Number(slotDuration),
        location,
        teacherIds: selectedTeacherIds,
        classId: selectedClassId || undefined,
      });
      setIsCreateModalOpen(false);
      fetchSessions();
      alert("PTM Session and time slots generated successfully!");
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, "Failed to create PTM session"));
    }
  };

  const handleOpenSlots = async (session: PTMSession) => {
    try {
      const res = await apiClient.get(`/ptm/sessions/${session.id}`);
      setSelectedSession(res.data?.data || res.data || session);
    } catch {
      setSelectedSession(session);
    } finally {
      setIsSlotsModalOpen(true);
    }
  };

  const handleBookSlot = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!activeSlotToBook || !studentIdToBook) return;

    try {
      await apiClient.post(`/ptm/slots/${activeSlotToBook.id}/book`, {
        studentId: studentIdToBook,
        parentNotes,
      });
      alert("Slot booked successfully!");
      setActiveSlotToBook(null);
      setParentNotes("");
      if (selectedSession) handleOpenSlots(selectedSession);
      fetchSessions();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, "Failed to book slot"));
    }
  };

  const handleCancelSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await apiClient.post(`/ptm/slots/${slotId}/cancel`);
      alert("Booking cancelled.");
      if (selectedSession) handleOpenSlots(selectedSession);
      fetchSessions();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, "Failed to cancel booking"));
    }
  };

  const handleSaveFeedback = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!activeSlotForFeedback || !teacherFeedback) return;

    try {
      await apiClient.put(`/ptm/slots/${activeSlotForFeedback.id}/complete`, {
        teacherNotes: teacherFeedback,
      });
      alert("Meeting feedback saved successfully!");
      setActiveSlotForFeedback(null);
      setTeacherFeedback("");
      if (selectedSession) handleOpenSlots(selectedSession);
      fetchSessions();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, "Failed to save feedback"));
    }
  };

  const sessionColumns: Column<PTMSession>[] = [
    {
      header: "Session Title",
      accessorKey: "title",
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 700 }}>{row.title}</span>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Location: {row.location || "Online"}
          </div>
        </div>
      ),
    },
    {
      header: "Meeting Date",
      accessorKey: "meetingDate",
      cell: (row) => ((row.meetingDate || row.date) ? new Date(row.meetingDate || row.date!).toLocaleDateString() : "—"),
    },
    {
      header: "Time Window",
      accessorKey: "time",
      cell: (row) => `${row.startTime} - ${row.endTime} (${row.slotDurationMinutes || row.slotDuration || 15}m slots)`,
    },
    {
      header: "Slots Status",
      accessorKey: "slots",
      cell: (row) => {
        const slots = row.slots || [];
        const booked = slots.filter((s: PTMSlot) => s.status === "BOOKED" || s.status === "COMPLETED").length;
        const total = slots.length || 0;
        return (
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            {booked} / {total} Booked
          </span>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          icon={<Eye size={14} />}
          onClick={() => handleOpenSlots(row)}
        >
          View Slots
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CalendarClock className="text-brand" size={26} />
            Parent-Teacher Meetings (PTM)
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Automated time-slot generation, atomic booking, and structured teacher feedback
          </p>
        </div>

        {["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"].includes(user?.role || "") && (
          <Button
            icon={<Plus size={16} />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Schedule PTM Session
          </Button>
        )}
      </div>

      {/* PTM Engagement KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>SCHEDULED SESSIONS</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0" }}>{sessions.length}</p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--primary-600)", fontWeight: 600 }}>TOTAL TIME SLOTS</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--primary-700)" }}>
            {sessions.reduce((acc, s) => acc + (s._count?.slots || s.slots?.length || 0), 0)}
          </p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--success-dark)", fontWeight: 600 }}>CAMPUS & VIRTUAL MODE</span>
          <p style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--success-dark)" }}>
            Hybrid Integrated
          </p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--brand-teal)", fontWeight: 600 }}>SCHEDULING ENGINE</span>
          <p style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--brand-teal)" }}>
            Zero Double-Booking
          </p>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <DataTable
          columns={sessionColumns}
          data={sessions}
          isLoading={isLoading}
          emptyMessage="No PTM sessions scheduled yet. Click 'Schedule PTM Session' to create a meeting window."
        />
      </div>

      {/* Schedule Session Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule New PTM Session"
      >
        <form onSubmit={handleCreateSession} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Title</label>
            <Input
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Date</label>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Start Time</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>End Time</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Slot Duration (Mins)</label>
              <Input
                type="number"
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Location / Room</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Target Class (Optional)</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="">-- All Classes (School-wide PTM) --</option>
              {classesList.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Participating Teachers ({selectedTeacherIds.length} selected)
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setSelectedTeacherIds(teachersList.map((t: any) => t.id))}
                  style={{ fontSize: "0.75rem", background: "none", border: "none", color: "var(--primary-600)", cursor: "pointer", fontWeight: 600 }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTeacherIds([])}
                  style={{ fontSize: "0.75rem", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
                >
                  Clear
                </button>
              </div>
            </div>
            <div
              style={{
                maxHeight: "150px",
                overflowY: "auto",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                background: "var(--bg-surface)",
              }}
            >
              {teachersList.length > 0 ? (
                teachersList.map((t: any) => {
                  const isChecked = selectedTeacherIds.includes(t.id);
                  const desName = typeof t.designation === "object" ? t.designation?.name : t.designation || "Teacher";
                  return (
                    <label
                      key={t.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        padding: "0.2rem 0.3rem",
                        borderRadius: "4px",
                        background: isChecked ? "var(--bg-surface-hover)" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTeacherIds((prev) => [...prev, t.id]);
                          } else {
                            setSelectedTeacherIds((prev) => prev.filter((id) => id !== t.id));
                          }
                        }}
                      />
                      <span style={{ fontWeight: isChecked ? 600 : 400 }}>
                        {t.user?.firstName} {t.user?.lastName || ""}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        ({desName})
                      </span>
                    </label>
                  );
                })
              ) : (
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "0.5rem" }}>
                  No teachers found. Active staff will be automatically enrolled.
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Session & Slots</Button>
          </div>
        </form>
      </Modal>

      {/* Slots Viewer Modal */}
      {selectedSession && (
        <Modal
          isOpen={isSlotsModalOpen}
          onClose={() => {
            setIsSlotsModalOpen(false);
            setSlotFilterStatus("ALL");
            setSlotFilterTeacherId("ALL");
          }}
          title={`Slots: ${selectedSession.title} (${new Date(selectedSession.meetingDate || selectedSession.date || Date.now()).toLocaleDateString()})`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "72vh", overflowY: "auto" }}>
            {/* Virtual Video Conference Room Banner (if applicable) */}
            {selectedSession.meetingLink && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(30, 58, 138, 0.08) 100%)",
                  border: "1px solid rgba(2, 132, 199, 0.25)",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Video size={18} color="#0284c7" />
                  <div>
                    <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>Virtual Video Conference Enabled</strong>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Encrypted online room for live parent-teacher consultations</div>
                  </div>
                </div>
                <a
                  href={selectedSession.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "6px",
                    background: "#0284c7",
                    color: "#ffffff",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Join Meeting <ExternalLink size={13} />
                </a>
              </div>
            )}

            {/* Filter Bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-elevated)",
                padding: "0.6rem 0.85rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
              }}
            >
              {/* Status Filter Pills */}
              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginRight: "0.2rem" }}>
                  Status:
                </span>
                {[
                  { label: "All", value: "ALL", count: selectedSession.slots?.length || 0 },
                  {
                    label: "Available",
                    value: "AVAILABLE",
                    count: (selectedSession.slots || []).filter((s) => s.status === "AVAILABLE").length,
                  },
                  {
                    label: "Booked",
                    value: "BOOKED",
                    count: (selectedSession.slots || []).filter((s) => s.status === "BOOKED").length,
                  },
                  {
                    label: "Completed",
                    value: "COMPLETED",
                    count: (selectedSession.slots || []).filter((s) => s.status === "COMPLETED").length,
                  },
                ].map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setSlotFilterStatus(st.value)}
                    style={{
                      padding: "0.2rem 0.55rem",
                      borderRadius: "100px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      border: "1px solid var(--border-default)",
                      background: slotFilterStatus === st.value ? "var(--primary-600)" : "transparent",
                      color: slotFilterStatus === st.value ? "#ffffff" : "var(--text-secondary)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span>{st.label}</span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.05rem 0.3rem",
                        borderRadius: "100px",
                        background: slotFilterStatus === st.value ? "rgba(255,255,255,0.25)" : "var(--bg-surface-hover)",
                      }}
                    >
                      {st.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Teacher Filter Dropdown */}
              <div style={{ minWidth: "180px" }}>
                <select
                  value={slotFilterTeacherId}
                  onChange={(e) => setSlotFilterTeacherId(e.target.value)}
                  className="input-field"
                  style={{
                    width: "100%",
                    padding: "0.3rem 0.5rem",
                    fontSize: "0.78rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <option value="ALL">-- All Participating Teachers --</option>
                  {(() => {
                    const uniqueTeachers: any[] = [];
                    const seen = new Set<string>();
                    for (const s of selectedSession.slots || []) {
                      const tid = s.teacherId || s.teacher?.id;
                      if (tid && s.teacher && !seen.has(tid)) {
                        seen.add(tid);
                        uniqueTeachers.push(s.teacher);
                      }
                    }
                    return uniqueTeachers.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.user?.firstName} {t.user?.lastName || ""}
                      </option>
                    ));
                  })()}
                </select>
              </div>
            </div>

            {/* Slots List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {(() => {
                const filteredSlots = (selectedSession.slots || []).filter((slot: PTMSlot) => {
                  const matchesStatus = slotFilterStatus === "ALL" || slot.status === slotFilterStatus;
                  const matchesTeacher =
                    slotFilterTeacherId === "ALL" ||
                    slot.teacherId === slotFilterTeacherId ||
                    slot.teacher?.id === slotFilterTeacherId;
                  return matchesStatus && matchesTeacher;
                });

                if (filteredSlots.length === 0) {
                  return (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                      No slots match the selected status or teacher filter.
                    </div>
                  );
                }

                return filteredSlots.map((slot: PTMSlot) => {
                  const isBooked = slot.status === "BOOKED";
                  const isCompleted = slot.status === "COMPLETED";
                  const isAvailable = slot.status === "AVAILABLE";

                  return (
                    <div
                      key={slot.id}
                      style={{
                        padding: "0.85rem 1rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        background: isAvailable
                          ? "var(--bg-surface)"
                          : isCompleted
                          ? "var(--success-light)"
                          : "var(--primary-50)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700 }}>
                            <Clock size={14} className="text-secondary" />
                            {slot.startTime} - {slot.endTime}
                          </div>

                          {slot.teacher?.user && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                padding: "0.15rem 0.5rem",
                                borderRadius: "4px",
                                background: "var(--bg-elevated)",
                                color: "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                              }}
                            >
                              Faculty: {slot.teacher.user.firstName} {slot.teacher.user.lastName || ""}
                            </span>
                          )}

                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                              background: isAvailable
                                ? "var(--success-light)"
                                : isCompleted
                                ? "var(--purple-100)"
                                : "var(--primary-100)",
                              color: isAvailable
                                ? "var(--success-dark)"
                                : isCompleted
                                ? "var(--purple-700)"
                                : "var(--primary-700)",
                            }}
                          >
                            {slot.status}
                          </span>
                        </div>

                        {isBooked && (
                          <div style={{ fontSize: "0.82rem", color: "var(--primary-800)", marginTop: "0.35rem" }}>
                            Student: <strong>{slot.student?.user?.firstName || "Student"} {slot.student?.user?.lastName || ""}</strong>
                            {slot.student?.admissionNumber && ` (Adm: ${slot.student.admissionNumber})`}
                            {slot.parentNotes && (
                              <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.1rem" }}>
                                Parent Note: {slot.parentNotes}
                              </span>
                            )}
                          </div>
                        )}

                        {isCompleted && (
                          <div style={{ fontSize: "0.82rem", color: "var(--success-dark)", marginTop: "0.35rem" }}>
                            <strong>Consultation Summary:</strong> {slot.teacherNotes || "Completed successfully"}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {isAvailable && (
                          <Button size="sm" onClick={() => setActiveSlotToBook(slot)}>
                            Book Slot
                          </Button>
                        )}

                        {isBooked && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<MessageSquare size={13} />}
                              onClick={() => setActiveSlotForFeedback(slot)}
                            >
                              Feedback
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelSlot(slot.id)}
                              style={{ color: "var(--danger)" }}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Modal>
      )}

      {/* Book Slot Modal */}
      {activeSlotToBook && (
        <Modal
          isOpen={Boolean(activeSlotToBook)}
          onClose={() => setActiveSlotToBook(null)}
          title={`Book Slot: ${activeSlotToBook.startTime} - ${activeSlotToBook.endTime}`}
        >
          <form onSubmit={handleBookSlot} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Student</label>
              <select
                value={studentIdToBook}
                onChange={(e) => setStudentIdToBook(e.target.value)}
                className="input-field"
                required
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
              >
                <option value="">-- Select Student --</option>
                {students.map((s: StudentProfile) => (
                  <option key={s.id} value={s.id}>
                    {s.user?.firstName} {s.user?.lastName} (Adm: {s.admissionNumber || s.id.slice(0, 6)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Parent Discussion Topics / Concerns (Optional)
              </label>
              <Input
                placeholder="e.g. Discuss Math exam performance and homework submission"
                value={parentNotes}
                onChange={(e) => setParentNotes(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <Button variant="ghost" type="button" onClick={() => setActiveSlotToBook(null)}>
                Cancel
              </Button>
              <Button type="submit">Confirm Booking</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Teacher Feedback Modal */}
      {activeSlotForFeedback && (
        <Modal
          isOpen={Boolean(activeSlotForFeedback)}
          onClose={() => setActiveSlotForFeedback(null)}
          title="Record Teacher Discussion Notes & Feedback"
        >
          <form onSubmit={handleSaveFeedback} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Teacher Observations, Strengths & Action Items
              </label>
              <textarea
                rows={4}
                value={teacherFeedback}
                onChange={(e) => setTeacherFeedback(e.target.value)}
                placeholder="Discussed focus areas in Science. Student shows excellent teamwork. Agreed on 30 mins daily revision schedule."
                required
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <Button variant="ghost" type="button" onClick={() => setActiveSlotForFeedback(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Feedback</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
