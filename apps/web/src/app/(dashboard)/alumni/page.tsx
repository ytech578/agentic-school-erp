"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";
import { 
  BookUser, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Send,
  Download,
  Eye,
  Filter
} from "lucide-react";
import { OfficialTranscriptModal, TranscriptModalData } from "@/components/alumni/OfficialTranscriptModal";

interface StudentProfile {
  id: string;
  admissionNumber?: string;
  user?: { firstName: string; lastName: string };
}
interface AlumniProfile {
  id: string;
  studentId: string;
  student?: StudentProfile;
  graduationYear: number;
  currentStatus: string;
  higherEducation?: string;
  institution?: string;
  currentCompany?: string;
  currentDesignation?: string;
  city?: string;
  linkedinUrl?: string;
}
interface TranscriptRequest {
  id: string;
  requestNumber?: string;
  studentId: string;
  student?: StudentProfile;
  destinationOrganization: string;
  deliveryMode: string;
  purpose: string;
  status: string;
  requestedAt: string;
  createdAt: string;
}
interface AlumniStats {
  totalAlumni: number;
  higherEdCount: number;
  employedCount: number;
  pendingTranscripts: number;
}

export default function AlumniManagementPage() {
  const [activeTab, setActiveTab] = useState<"directory" | "transcripts">("directory");
  const [profiles, setProfiles] = useState<AlumniProfile[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptRequest[]>([]);
  const [stats, setStats] = useState<AlumniStats | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [selectedGraduationYear, setSelectedGraduationYear] = useState<number | "ALL">("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | "ALL">("ALL");

  // Official Transcript Preview Modal
  const [selectedTranscriptForModal, setSelectedTranscriptForModal] = useState<TranscriptModalData | null>(null);
  const [isTranscriptViewModalOpen, setIsTranscriptViewModalOpen] = useState(false);

  // Add/Update Alumni Profile Modal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [graduationYear, setGraduationYear] = useState(new Date().getFullYear() - 1);
  const [currentStatus, setCurrentStatus] = useState("EMPLOYED");
  const [higherEducation, setHigherEducation] = useState("");
  const [institution, setInstitution] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [city, setCity] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // Request Transcript Modal
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [transcriptStudentId, setTranscriptStudentId] = useState("");
  const [destinationOrg, setDestinationOrg] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("DIGITAL");
  const [purpose, setPurpose] = useState("Higher Studies Admission");

  // Update Transcript Status Modal
  const [activeTranscriptForStatus, setActiveTranscriptForStatus] = useState<TranscriptRequest | null>(null);
  const [newTranscriptStatus, setNewTranscriptStatus] = useState("PROCESSING");
  const [trackingNumber, setTrackingNumber] = useState("");

  useEffect(() => {
    fetchData();
    apiClient.get("/students?limit=50").then((res) => {
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      setStudents(list);
    }).catch(() => setStudents([]));
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profRes, tranRes, statsRes] = await Promise.allSettled([
        apiClient.get("/alumni/profiles"),
        apiClient.get("/alumni/transcripts"),
        apiClient.get("/alumni/stats"),
      ]);

      if (profRes.status === "fulfilled") {
        const raw = profRes.value.data?.data || profRes.value.data || [];
        const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
        setProfiles(list);
      }
      if (tranRes.status === "fulfilled") {
        const raw = tranRes.value.data?.data || tranRes.value.data || [];
        const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
        setTranscripts(list);
      }
      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data?.data || statsRes.value.data || null);
      }
    } catch (err) {
      console.error("Failed to load alumni records", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert("Please select a student.");
      return;
    }

    try {
      await apiClient.post("/alumni/profiles", {
        studentId: selectedStudentId,
        graduationYear: Number(graduationYear),
        currentStatus,
        higherEducation,
        institution,
        currentCompany,
        currentDesignation,
        city,
        linkedinUrl,
      });
      setIsProfileModalOpen(false);
      fetchData();
      alert("Alumni profile recorded successfully!");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to save profile");
    }
  };

  const handleCreateTranscript = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!transcriptStudentId || !destinationOrg) return;

    try {
      await apiClient.post("/alumni/transcripts", {
        studentId: transcriptStudentId,
        destinationOrganization: destinationOrg,
        deliveryMode,
        purpose,
      });
      setIsTranscriptModalOpen(false);
      setDestinationOrg("");
      fetchData();
      alert("Transcript request submitted successfully!");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to submit transcript request");
    }
  };

  const handleUpdateTranscriptStatus = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!activeTranscriptForStatus) return;

    try {
      await apiClient.patch(`/alumni/transcripts/${activeTranscriptForStatus.id}/status`, {
        status: newTranscriptStatus,
        trackingNumber: trackingNumber || undefined,
      });
      setActiveTranscriptForStatus(null);
      fetchData();
      alert("Transcript status updated successfully!");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to update transcript status");
    }
  };

  const handleDownloadTranscript = async (requestId: string, reqNumber?: string) => {
    try {
      const res = await apiClient.get(`/alumni/transcripts/${requestId}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `transcript-${(reqNumber || requestId).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert("Failed to download transcript PDF.");
    }
  };

  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const safeTranscripts = Array.isArray(transcripts) ? transcripts : [];

  const availableGradYears = Array.from(
    new Set(safeProfiles.map((p) => p.graduationYear).filter(Boolean))
  ).sort((a, b) => b - a);

  const filteredProfiles = safeProfiles.filter((p) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      (p.student?.user?.firstName || "").toLowerCase().includes(query) ||
      (p.student?.user?.lastName || "").toLowerCase().includes(query) ||
      (p.student?.admissionNumber || "").toLowerCase().includes(query) ||
      (p.currentCompany || "").toLowerCase().includes(query) ||
      (p.institution || "").toLowerCase().includes(query) ||
      (p.city || "").toLowerCase().includes(query);
    const matchesYear =
      selectedGraduationYear === "ALL" || p.graduationYear === selectedGraduationYear;
    const matchesStatus =
      selectedStatusFilter === "ALL" || p.currentStatus === selectedStatusFilter;
    return matchesSearch && matchesYear && matchesStatus;
  });

  const profileColumns: Column<AlumniProfile>[] = [
    {
      header: "Alumni Name",
      accessorKey: "student",
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 700 }}>
            {row.student?.user?.firstName || "Alumni"} {row.student?.user?.lastName || ""}
          </span>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Class of {row.graduationYear} • Adm: {row.student?.admissionNumber || "N/A"}
          </div>
        </div>
      ),
    },
    {
      header: "Higher Education",
      accessorKey: "education",
      cell: (row) => (
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{row.higherEducation || "N/A"}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{row.institution}</div>
        </div>
      ),
    },
    {
      header: "Current Career",
      accessorKey: "career",
      cell: (row) => (
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{row.currentDesignation || "Professional"}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{row.currentCompany} ({row.city})</div>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "currentStatus",
      cell: (row) => (
        <span
          style={{
            padding: "0.2rem 0.6rem",
            borderRadius: "var(--radius-full)",
            fontSize: "0.75rem",
            fontWeight: 700,
            background: row.currentStatus === "EMPLOYED" ? "var(--success-light)" : "var(--primary-50)",
            color: row.currentStatus === "EMPLOYED" ? "var(--success-dark)" : "var(--primary-700)",
          }}
        >
          {row.currentStatus?.replace("_", " ")}
        </span>
      ),
    },
    {
      header: "LinkedIn",
      accessorKey: "linkedinUrl",
      cell: (row) => (
        row.linkedinUrl ? (
          <a
            href={row.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--primary-600)", textDecoration: "none", fontSize: "0.8rem", fontWeight: 600 }}
          >
            Connect <ExternalLink size={12} />
          </a>
        ) : (
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>N/A</span>
        )
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          icon={<FileText size={13} />}
          onClick={() => {
            setSelectedTranscriptForModal({
              id: row.id,
              requestNumber: `TR-${row.graduationYear}-${row.student?.admissionNumber || row.id.slice(0, 4)}`,
              student: row.student,
              destinationOrganization: row.higherEducation
                ? `${row.institution || "Higher Institution"}`
                : `${row.currentCompany || "Corporate Employment Verification"}`,
              deliveryMode: "OFFICIAL_TRANSCRIPT",
              purpose: row.higherEducation ? "Higher Education Verification" : "Employment Record Attestation",
              requestedAt: new Date().toISOString(),
              status: "OFFICIAL_SEALED",
              graduationYear: row.graduationYear,
            });
            setIsTranscriptViewModalOpen(true);
          }}
        >
          Transcript
        </Button>
      ),
    },
  ];

  const transcriptColumns: Column<TranscriptRequest>[] = [
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
      header: "Destination",
      accessorKey: "destinationOrganization",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{row.destinationOrganization}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Purpose: {row.purpose}</div>
        </div>
      ),
    },
    {
      header: "Mode",
      accessorKey: "deliveryMode",
      cell: (row) => (
        <span style={{ fontSize: "0.8rem", padding: "0.15rem 0.5rem", borderRadius: "4px", background: "var(--bg-surface-hover)" }}>
          {row.deliveryMode}
        </span>
      ),
    },
    {
      header: "Request Date",
      accessorKey: "requestedAt",
      cell: (row) => new Date(row.requestedAt || row.createdAt).toLocaleDateString(),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const isDone = row.status === "COMPLETED" || row.status === "DISPATCHED";
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.2rem 0.6rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: isDone ? "var(--success-light)" : "var(--warning-light)",
              color: isDone ? "var(--success-dark)" : "var(--warning-dark)",
            }}
          >
            {isDone ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            {row.status}
          </span>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <Button
            size="sm"
            variant="outline"
            icon={<Eye size={13} />}
            onClick={() => {
              setSelectedTranscriptForModal({
                id: row.id,
                requestNumber: row.requestNumber,
                student: row.student,
                destinationOrganization: row.destinationOrganization,
                deliveryMode: row.deliveryMode,
                purpose: row.purpose,
                requestedAt: row.requestedAt || row.createdAt,
                status: row.status,
              });
              setIsTranscriptViewModalOpen(true);
            }}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<Download size={13} />}
            onClick={() => handleDownloadTranscript(row.id, row.requestNumber)}
          >
            PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActiveTranscriptForStatus(row);
              setNewTranscriptStatus(row.status || "PROCESSING");
            }}
          >
            Update
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BookUser className="text-brand" size={26} />
            Alumni Management & Transcripts
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Graduated student directory, career & higher education tracking, and official transcript workflow
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            variant="outline"
            icon={<Send size={15} />}
            onClick={() => setIsTranscriptModalOpen(true)}
          >
            Request Transcript
          </Button>
          <Button
            icon={<Plus size={16} />}
            onClick={() => setIsProfileModalOpen(true)}
          >
            Add Alumni Profile
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>REGISTERED ALUMNI</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0" }}>{safeProfiles.length}</p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--primary-600)", fontWeight: 600 }}>HIGHER EDUCATION</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--primary-700)" }}>
            {safeProfiles.filter((p) => p.currentStatus === "HIGHER_STUDIES").length}
          </p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--success-dark)", fontWeight: 600 }}>EMPLOYED PROFESSIONALS</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--success-dark)" }}>
            {safeProfiles.filter((p) => p.currentStatus === "EMPLOYED" || p.currentStatus === "ENTREPRENEUR").length}
          </p>
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--warning-dark)", fontWeight: 600 }}>PENDING TRANSCRIPTS</span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--warning-dark)" }}>
            {safeTranscripts.filter((t) => t.status === "SUBMITTED" || t.status === "PROCESSING").length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-default)" }}>
        <button
          onClick={() => setActiveTab("directory")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "directory" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "directory" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Alumni Directory ({profiles.length})
        </button>
        <button
          onClick={() => setActiveTab("transcripts")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "transcripts" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "transcripts" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Transcript Requests ({transcripts.length})
        </button>
      </div>

      {/* Tab 1: Directory */}
      {activeTab === "directory" && (
        <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Search and Filters Bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ width: "320px", maxWidth: "100%" }}>
              <Input
                placeholder="Search alumni by name, admission no, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                <Filter size={13} />
                <span>Class Year:</span>
              </div>
              <button
                onClick={() => setSelectedGraduationYear("ALL")}
                style={{
                  padding: "0.25rem 0.65rem",
                  borderRadius: "100px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  border: "1px solid var(--border-default)",
                  background: selectedGraduationYear === "ALL" ? "var(--primary-600)" : "transparent",
                  color: selectedGraduationYear === "ALL" ? "#ffffff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                All Years
              </button>
              {(availableGradYears.length > 0 ? availableGradYears : [2025, 2024, 2023, 2022]).map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedGraduationYear(yr)}
                  style={{
                    padding: "0.25rem 0.65rem",
                    borderRadius: "100px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    border: "1px solid var(--border-default)",
                    background: selectedGraduationYear === yr ? "var(--primary-600)" : "transparent",
                    color: selectedGraduationYear === yr ? "#ffffff" : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {yr}
                </button>
              ))}

              <div style={{ width: "1px", height: "18px", background: "var(--border-default)", margin: "0 0.25rem" }} />

              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Status:</span>
              {[
                { label: "All", value: "ALL" },
                { label: "Employed", value: "EMPLOYED" },
                { label: "Higher Studies", value: "HIGHER_STUDIES" },
                { label: "Entrepreneur", value: "ENTREPRENEUR" },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSelectedStatusFilter(s.value)}
                  style={{
                    padding: "0.25rem 0.65rem",
                    borderRadius: "100px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    border: "1px solid var(--border-default)",
                    background: selectedStatusFilter === s.value ? "var(--primary-50)" : "transparent",
                    color: selectedStatusFilter === s.value ? "var(--primary-700)" : "var(--text-secondary)",
                    borderColor: selectedStatusFilter === s.value ? "var(--primary-200)" : "var(--border-default)",
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            columns={profileColumns}
            data={filteredProfiles}
            isLoading={isLoading}
            emptyMessage="No alumni found matching your search and filter criteria."
          />
        </div>
      )}

      {/* Tab 2: Transcripts */}
      {activeTab === "transcripts" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <DataTable
            columns={transcriptColumns}
            data={transcripts}
            isLoading={isLoading}
            emptyMessage="No official transcript requests found."
          />
        </div>
      )}

      {/* Add Profile Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Add / Update Alumni Profile"
      >
        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="input-field"
              required
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="">-- Choose Student --</option>
              {students.map((s: StudentProfile) => (
                <option key={s.id} value={s.id}>
                  {s.user?.firstName} {s.user?.lastName} (Adm: {s.admissionNumber || s.id.slice(0, 6)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Graduation Year</label>
              <Input
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Current Status</label>
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value)}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
              >
                <option value="EMPLOYED">Employed</option>
                <option value="HIGHER_STUDIES">Higher Studies</option>
                <option value="ENTREPRENEUR">Entrepreneur / Founder</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Degree / Higher Study</label>
              <Input
                value={higherEducation}
                onChange={(e) => setHigherEducation(e.target.value)}
                placeholder="e.g. B.Tech Computer Science"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>University / Institute</label>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. IIT Delhi"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Company / Employer</label>
              <Input
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
                placeholder="e.g. Microsoft"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Designation</label>
              <Input
                value={currentDesignation}
                onChange={(e) => setCurrentDesignation(e.target.value)}
                placeholder="e.g. Senior Analyst"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>City / Country</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bengaluru, India"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>LinkedIn URL</label>
              <Input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsProfileModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Profile</Button>
          </div>
        </form>
      </Modal>

      {/* Request Transcript Modal */}
      <Modal
        isOpen={isTranscriptModalOpen}
        onClose={() => setIsTranscriptModalOpen(false)}
        title="Submit Official Transcript Request"
      >
        <form onSubmit={handleCreateTranscript} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Student</label>
            <select
              value={transcriptStudentId}
              onChange={(e) => setTranscriptStudentId(e.target.value)}
              className="input-field"
              required
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="">-- Choose Student --</option>
              {students.map((s: StudentProfile) => (
                <option key={s.id} value={s.id}>
                  {s.user?.firstName} {s.user?.lastName} (Adm: {s.admissionNumber || s.id.slice(0, 6)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Destination University / Employer
            </label>
            <Input
              value={destinationOrg}
              onChange={(e) => setDestinationOrg(e.target.value)}
              placeholder="e.g. Oxford University Admissions Office"
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Delivery Mode</label>
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value)}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
              >
                <option value="DIGITAL">Digital (Official Signed PDF)</option>
                <option value="HARD_COPY">Physical Hard Copy (Courier)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Purpose</label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsTranscriptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      {/* Update Transcript Status Modal */}
      {activeTranscriptForStatus && (
        <Modal
          isOpen={Boolean(activeTranscriptForStatus)}
          onClose={() => setActiveTranscriptForStatus(null)}
          title={`Update Transcript: ${activeTranscriptForStatus.destinationOrganization}`}
        >
          <form onSubmit={handleUpdateTranscriptStatus} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>New Status</label>
              <select
                value={newTranscriptStatus}
                onChange={(e) => setNewTranscriptStatus(e.target.value)}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
              >
                <option value="PROCESSING">PROCESSING (Under verification)</option>
                <option value="DISPATCHED">DISPATCHED (Sent to destination)</option>
                <option value="COMPLETED">COMPLETED (Delivered & acknowledged)</option>
                <option value="REJECTED">REJECTED (Fee pending or incomplete records)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Tracking / Courier Number (Optional)
              </label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. DTDC-884920489"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <Button variant="ghost" type="button" onClick={() => setActiveTranscriptForStatus(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Status</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Official Academic Transcript Viewer Modal */}
      <OfficialTranscriptModal
        isOpen={isTranscriptViewModalOpen}
        data={selectedTranscriptForModal}
        onClose={() => {
          setIsTranscriptViewModalOpen(false);
          setSelectedTranscriptForModal(null);
        }}
        onDownloadPdf={(id, num) => handleDownloadTranscript(id, num)}
      />
    </div>
  );
}
