"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";
import { 
  AlertOctagon, 
  Plus, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Bell, 
  Lock, 
  Eye, 
  AlertTriangle,
  UserCheck
} from "lucide-react";

interface StudentProfile {
  id: string;
  admissionNumber?: string;
  rollNumber?: string;
  user?: { firstName: string; lastName: string };
}
interface DisciplineIncident {
  id: string;
  incidentNumber?: string;
  title?: string;
  incidentDate: string;
  category: string;
  severity: string;
  status: string;
  description?: string;
  actionTaken?: string;
  parentNotified: boolean;
  studentId: string;
  resolutionNotes?: string;
  student?: StudentProfile;
}

export default function DisciplineIncidentsPage() {
  const { user } = useAuthStore();
  const [incidents, setIncidents] = useState<DisciplineIncident[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  // Create Incident Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("CLASSROOM_DISRUPTION");
  const [severity, setSeverity] = useState("MODERATE");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);
  const [notifyParentOnCreate, setNotifyParentOnCreate] = useState(true);

  // Class and Section filters for Student selection
  const [classesList, setClassesList] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sectionsList, setSectionsList] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [studentSearchText, setStudentSearchText] = useState("");
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Status & Remediation Update Modal
  const [activeIncidentForUpdate, setActiveIncidentForUpdate] = useState<DisciplineIncident | null>(null);
  const [newStatus, setNewStatus] = useState("RESOLVED");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Incident Details Modal (for Resolved/Closed view)
  const [activeIncidentForDetails, setActiveIncidentForDetails] = useState<DisciplineIncident | null>(null);

  const openUpdateModal = (incident: DisciplineIncident) => {
    setActiveIncidentForUpdate(incident);
    setNewStatus(incident.status === "REPORTED" ? "RESOLVED" : incident.status);
    setResolutionNotes(incident.resolutionNotes || "");
  };

  useEffect(() => {
    fetchIncidents();
    fetchStudents();

    apiClient.get("/classes").then((res) => {
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      setClassesList(list);
    }).catch(() => setClassesList([]));
  }, []);

  const fetchStudents = async (classId?: string, sectionId?: string, search?: string) => {
    setIsLoadingStudents(true);
    try {
      const params: any = { limit: 100 };
      if (classId) params.classId = classId;
      if (sectionId) params.sectionId = sectionId;
      if (search) params.search = search;
      const res = await apiClient.get("/students", { params });
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      setStudents(list);
    } catch (err) {
      console.error("Failed to load students", err);
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedSectionId("");
    setStudentId("");
    const foundClass = classesList.find((c) => c.id === classId);
    const secs = foundClass?.sections || [];
    setSectionsList(secs);
    fetchStudents(classId || undefined, undefined, studentSearchText || undefined);
  };

  const handleSectionChange = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setStudentId("");
    fetchStudents(selectedClassId || undefined, sectionId || undefined, studentSearchText || undefined);
  };

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/discipline/incidents");
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      setIncidents(list);
    } catch (err) {
      console.error("Failed to load incidents", err);
      setIncidents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateIncident = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!studentId || !description) return;

    try {
      const computedTitle = title.trim() || `${category.replace(/_/g, " ")} Incident`;
      await apiClient.post("/discipline/incidents", {
        studentId,
        title: computedTitle,
        incidentDate: new Date(incidentDate).toISOString(),
        category,
        severity,
        description,
        actionTaken,
        isConfidential,
        notifyParent: notifyParentOnCreate,
      });
      setIsCreateModalOpen(false);
      setTitle("");
      setDescription("");
      setActionTaken("");
      fetchIncidents();
      alert("Disciplinary incident logged successfully.");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to log incident");
    }
  };

  const handleUpdateStatus = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!activeIncidentForUpdate) return;

    try {
      await apiClient.put(`/discipline/incidents/${activeIncidentForUpdate.id}/status`, {
        status: newStatus,
        resolutionNotes: resolutionNotes,
        resolution: resolutionNotes,
      });
      alert("Incident status updated successfully!");
      setActiveIncidentForUpdate(null);
      setResolutionNotes("");
      fetchIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to update incident status");
    }
  };

  const handleNotifyParent = async (incidentId: string) => {
    try {
      await apiClient.post(`/discipline/incidents/${incidentId}/notify-parent`, {
        customMessage: "Notice regarding behavioral incident recorded at school. Please check parent portal for details.",
        message: "Notice regarding behavioral incident recorded at school. Please check parent portal for details.",
      });
      alert("Disciplinary notification sent to parent successfully.");
      fetchIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to notify parent");
    }
  };

  // KPIs
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const totalCount = safeIncidents.length;
  const criticalCount = safeIncidents.filter((i) => i.severity === "CRITICAL" || i.severity === "MAJOR").length;
  const resolvedCount = safeIncidents.filter((i) => i.status === "RESOLVED").length;
  const pendingCount = safeIncidents.filter((i) => i.status === "PENDING" || i.status === "IN_PROGRESS" || i.status === "INVESTIGATING" || i.status === "REPORTED").length;

  const filteredIncidents = filterSeverity === "ALL" 
    ? safeIncidents 
    : safeIncidents.filter((i) => i.severity === filterSeverity);

  const columns: Column<DisciplineIncident>[] = [
    {
      header: "Date",
      accessorKey: "incidentDate",
      cell: (row) => row.incidentDate ? new Date(row.incidentDate).toLocaleDateString() : "N/A",
    },
    {
      header: "Incident / Title",
      accessorKey: "title",
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 700, color: "var(--text-primary)", display: "block" }}>
            {row.title || row.category?.replace(/_/g, " ")}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {row.category?.replace(/_/g, " ")}
          </span>
        </div>
      ),
    },
    {
      header: "Student",
      accessorKey: "student",
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 700 }}>
            {row.student?.user?.firstName || "Student"} {row.student?.user?.lastName || ""}
          </span>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Adm: {row.student?.admissionNumber || "N/A"}
          </div>
        </div>
      ),
    },
    {
      header: "Severity",
      accessorKey: "severity",
      cell: (row) => {
        const isCritical = row.severity === "CRITICAL";
        const isMajor = row.severity === "MAJOR";
        const isMod = row.severity === "MODERATE";

        return (
          <span
            style={{
              padding: "0.2rem 0.6rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.75rem",
              fontWeight: 800,
              background: isCritical || isMajor ? "var(--danger-light)" : isMod ? "var(--warning-light)" : "var(--primary-50)",
              color: isCritical || isMajor ? "var(--danger-dark)" : isMod ? "var(--warning-dark)" : "var(--primary-700)",
            }}
          >
            {row.severity}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.8rem",
            fontWeight: 700,
            color: row.status === "RESOLVED" ? "var(--success-dark)" : "var(--text-secondary)",
          }}
        >
          {row.status === "RESOLVED" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
          {row.status}
        </span>
      ),
    },
    {
      header: "Parent Alert",
      accessorKey: "parentNotified",
      cell: (row) => (
        row.parentNotified ? (
          <span style={{ color: "var(--success)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <CheckCircle2 size={12} /> Notified
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleNotifyParent(row.id)}
            icon={<Bell size={12} />}
          >
            Send Alert
          </Button>
        )
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => {
        const isCompleted = row.status === "RESOLVED" || row.status === "CLOSED";

        if (isCompleted) {
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.55rem",
                  borderRadius: "9999px",
                  backgroundColor: row.status === "RESOLVED" ? "rgba(16, 185, 129, 0.12)" : "rgba(107, 114, 128, 0.12)",
                  color: row.status === "RESOLVED" ? "var(--success-dark)" : "var(--text-secondary)",
                }}
              >
                {row.status === "RESOLVED" ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                {row.status === "RESOLVED" ? "Resolved" : "Closed"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveIncidentForDetails(row)}
                icon={<Eye size={12} />}
              >
                View
              </Button>
            </div>
          );
        }

        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openUpdateModal(row)}
          >
            Update Status
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertOctagon className="text-brand" size={26} />
            Discipline & Behavioral Tracking
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Incident remediation, severity stratification, parent notifications, and confidentiality governance
          </p>
        </div>

        <Button
          icon={<Plus size={16} />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Report Incident
        </Button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>TOTAL INCIDENTS</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0" }}>{totalCount}</p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--danger)", fontWeight: 600 }}>MAJOR / CRITICAL</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--danger)" }}>{criticalCount}</p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--warning-dark)", fontWeight: 600 }}>PENDING RESOLUTION</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--warning-dark)" }}>{pendingCount}</p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--success-dark)", fontWeight: 600 }}>RESOLVED</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--success-dark)" }}>{resolvedCount}</p>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["ALL", "CRITICAL", "MAJOR", "MODERATE", "MINOR"].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: filterSeverity === sev ? "1px solid var(--primary-600)" : "1px solid var(--border-default)",
                  background: filterSeverity === sev ? "var(--primary-50)" : "transparent",
                  color: filterSeverity === sev ? "var(--primary-700)" : "var(--text-secondary)",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredIncidents}
          isLoading={isLoading}
          emptyMessage="No disciplinary incidents recorded for this filter."
        />
      </div>

      {/* Report Incident Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Report Disciplinary Incident"
      >
        <form onSubmit={handleCreateIncident} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Class & Section Selection Filter */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
              >
                <option value="">-- All Classes --</option>
                {classesList.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Section</label>
              <select
                value={selectedSectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                disabled={!selectedClassId || sectionsList.length === 0}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
              >
                <option value="">-- All Sections --</option>
                {sectionsList.map((sec: any) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Student {isLoadingStudents ? "(Loading...)" : `(${students.length} available)`}
              </label>
            </div>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="input-field"
              required
              disabled={isLoadingStudents}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="">-- Choose Student --</option>
              {students.map((s: StudentProfile) => (
                <option key={s.id} value={s.id}>
                  {s.user?.firstName} {s.user?.lastName} (Roll: {s.rollNumber || "N/A"} | Adm: {s.admissionNumber || s.id.slice(0, 6)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Incident Title / Subject
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Disruption during period, bullying incident, etc."
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Incident Date</label>
              <Input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
              >
                <option value="MINOR">MINOR (Warning, Late)</option>
                <option value="MODERATE">MODERATE (Disruption, Insubordination)</option>
                <option value="MAJOR">MAJOR (Cheating, Bullying, Property Damage)</option>
                <option value="CRITICAL">CRITICAL (Physical Violence, Safety Hazard)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="CLASSROOM_DISRUPTION">Classroom Disruption</option>
              <option value="ACADEMIC_DISHONESTY">Academic Dishonesty (Cheating/Plagiarism)</option>
              <option value="BULLYING_HARASSMENT">Bullying / Peer Harassment</option>
              <option value="UNEXCUSED_ABSENCE">Truancy / Skipping Class</option>
              <option value="PROPERTY_DAMAGE">School Property Damage</option>
              <option value="INSUBORDINATION">Insubordination / Disrespect</option>
              <option value="SAFETY_VIOLATION">Safety or Health Violation</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Detailed Incident Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State objective facts observed during the occurrence..."
              required
              className="input-field"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", fontFamily: "inherit" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Action Taken / Remediation</label>
            <Input
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="e.g. Verbal warning issued, seat relocated, homework detentive session"
            />
          </div>

          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
              />
              <Lock size={14} /> Confidential (Restricted to Admins)
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifyParentOnCreate}
                onChange={(e) => setNotifyParentOnCreate(e.target.checked)}
              />
              <Bell size={14} /> Notify Parents Immediately
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Log Incident</Button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      {activeIncidentForUpdate && (
        <Modal
          isOpen={Boolean(activeIncidentForUpdate)}
          onClose={() => setActiveIncidentForUpdate(null)}
          title={`Update Status: ${activeIncidentForUpdate.student?.user?.firstName || "Student"} - ${activeIncidentForUpdate.category}`}
        >
          <form onSubmit={handleUpdateStatus} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Update Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
              >
                <option value="INVESTIGATING">INVESTIGATING / IN PROGRESS (Under review / counseling)</option>
                <option value="RESOLVED">RESOLVED (Action completed, behavior corrected)</option>
                <option value="CLOSED">CLOSED (Case finalized and closed)</option>
                <option value="APPEALED">APPEALED (Referred to Principal / Disciplinary Board)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Resolution Notes & Outcome</label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Parent acknowledged, student committed to positive conduct, counselor follow-up scheduled."
                required
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <Button variant="ghost" type="button" onClick={() => setActiveIncidentForUpdate(null)}>
                Cancel
              </Button>
              <Button type="submit">Update & Save</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Incident Details Modal */}
      {activeIncidentForDetails && (
        <Modal
          isOpen={Boolean(activeIncidentForDetails)}
          onClose={() => setActiveIncidentForDetails(null)}
          title={`Incident Details: ${activeIncidentForDetails.incidentNumber || activeIncidentForDetails.title || "Record"}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border-default)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                  {activeIncidentForDetails.title || activeIncidentForDetails.category?.replace(/_/g, " ")}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                  Incident #{activeIncidentForDetails.incidentNumber || "N/A"} • Recorded on {activeIncidentForDetails.incidentDate ? new Date(activeIncidentForDetails.incidentDate).toLocaleDateString() : "N/A"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.25rem 0.6rem",
                    borderRadius: "9999px",
                    background: activeIncidentForDetails.status === "RESOLVED" ? "rgba(16, 185, 129, 0.12)" : "rgba(107, 114, 128, 0.12)",
                    color: activeIncidentForDetails.status === "RESOLVED" ? "var(--success-dark)" : "var(--text-secondary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {activeIncidentForDetails.status === "RESOLVED" ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                  {activeIncidentForDetails.status}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.25rem 0.6rem",
                    borderRadius: "9999px",
                    background: "var(--primary-50)",
                    color: "var(--primary-700)",
                  }}
                >
                  {activeIncidentForDetails.severity}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Student</label>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {activeIncidentForDetails.student?.user?.firstName} {activeIncidentForDetails.student?.user?.lastName}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                  Admission: {activeIncidentForDetails.student?.admissionNumber || "N/A"}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Category</label>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {activeIncidentForDetails.category?.replace(/_/g, " ")}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Description</label>
              <div style={{ fontSize: "0.875rem", padding: "0.6rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", color: "var(--text-primary)" }}>
                {activeIncidentForDetails.description || "No description provided."}
              </div>
            </div>

            {activeIncidentForDetails.actionTaken && (
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Remediation / Action Taken</label>
                <div style={{ fontSize: "0.875rem", padding: "0.6rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", color: "var(--text-primary)" }}>
                  {activeIncidentForDetails.actionTaken}
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Resolution Notes & Outcome</label>
              <div style={{ fontSize: "0.875rem", padding: "0.75rem", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "var(--radius-md)", color: "var(--text-primary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--success-dark)", fontWeight: 700, marginBottom: "0.25rem", fontSize: "0.8rem" }}>
                  <CheckCircle2 size={13} /> Outcome Completed
                </div>
                {activeIncidentForDetails.resolutionNotes || "Action completed and incident resolved."}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-default)" }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const inc = activeIncidentForDetails;
                  setActiveIncidentForDetails(null);
                  openUpdateModal(inc);
                }}
              >
                Re-open / Appeal Case
              </Button>
              <Button variant="ghost" onClick={() => setActiveIncidentForDetails(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
