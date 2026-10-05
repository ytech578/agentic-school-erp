"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";
import { 
  ShieldCheck, 
  Download, 
  Trash2, 
  Plus, 
  FileJson, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Lock, 
  UserCheck,
  Shield
} from "lucide-react";

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
}
interface StudentRecord {
  id: string;
  userId?: string;
  admissionNumber?: string;
  user?: UserProfile;
}
interface PrivacyRequest {
  id: string;
  requestType: string;
  user?: UserProfile;
  reason: string;
  createdAt: string;
  status: string;
}
interface ConsentRecord {
  id: string;
  purpose: string;
  isGranted: boolean;
  grantedAt?: string;
  createdAt: string;
  ipAddress?: string;
}

interface ComplianceStats {
  totalConsents: number;
  activeConsents: number;
  withdrawnConsents: number;
  consentRate: number;
  totalRequests: number;
  pendingErasure: number;
  completedExports: number;
  dpoOfficer?: {
    name: string;
    email: string;
    phone: string;
    address: string;
    statutoryWindowDays: number;
  };
}

export default function DpdpPrivacyCompliancePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"consents" | "requests" | "export">("consents");
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentConsents, setSelectedStudentConsents] = useState<ConsentRecord[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string>("");
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search filter states
  const [studentSearchConsent, setStudentSearchConsent] = useState("");
  const [exportStudentSearch, setExportStudentSearch] = useState("");

  // Grant Consent Modal
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [consentStudentId, setConsentStudentId] = useState("");
  const [purpose, setPurpose] = useState("ACADEMIC_PROCESSING");
  const [isGranted, setIsGranted] = useState(true);

  // Create Request Modal (Export / Erasure)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestType, setRequestType] = useState("DATA_EXPORT");
  const [requestReason, setRequestReason] = useState("Annual personal data audit request");

  // Anonymization Confirmation Modal
  const [isAnonymizeModalOpen, setIsAnonymizeModalOpen] = useState(false);
  const [userToAnonymize, setUserToAnonymize] = useState<StudentRecord | null>(null);
  const [anonymizeReason, setAnonymizeReason] = useState("Right to Erasure invoked under DPDP Act 2023 Sec 12");
  const [confirmText, setConfirmText] = useState("");

  // Data Export state
  const [exportUserId, setExportUserId] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [reqRes, studRes, statsRes] = await Promise.allSettled([
        apiClient.get("/privacy/requests"),
        apiClient.get("/students?limit=200"),
        apiClient.get("/privacy/stats"),
      ]);

      if (reqRes.status === "fulfilled") {
        const rawReqs = reqRes.value.data?.data || reqRes.value.data || [];
        setRequests(Array.isArray(rawReqs) ? rawReqs : (rawReqs?.items || []));
      }
      if (studRes.status === "fulfilled") {
        const rawStuds = studRes.value.data?.data || studRes.value.data || [];
        const safeStuds = Array.isArray(rawStuds) ? rawStuds : (rawStuds?.items || []);
        setStudents(safeStuds);
        if (safeStuds.length > 0) {
          setActiveStudentId(safeStuds[0].id);
          fetchStudentConsents(safeStuds[0].id);
        }
      }
      if (statsRes.status === "fulfilled") {
        const rawStats = statsRes.value.data?.data || statsRes.value.data;
        setStats(rawStats);
      }
    } catch (err) {
      console.error("Failed to load privacy data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudentConsents = async (studentId: string) => {
    try {
      const res = await apiClient.get(`/privacy/students/${studentId}/consents`);
      const rawConsents = res.data?.data || res.data || [];
      setSelectedStudentConsents(Array.isArray(rawConsents) ? rawConsents : (rawConsents?.items || []));
    } catch {
      setSelectedStudentConsents([]);
    }
  };

  const handleProcessExport = async (requestId: string) => {
    try {
      await apiClient.post(`/privacy/requests/${requestId}/process`);
      alert("Personal data archive compiled and sealed successfully!");
      fetchInitialData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to process export archive.");
    }
  };

  const handleDownloadZip = async (requestId: string) => {
    try {
      const res = await apiClient.get(`/privacy/requests/${requestId}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `dpdp-archive-${requestId.slice(0, 8)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to download ZIP archive.");
    }
  };

  const handleGrantConsent = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!consentStudentId) return;

    try {
      await apiClient.post("/privacy/consents", {
        studentId: consentStudentId,
        purpose,
        isGranted,
      });
      setIsConsentModalOpen(false);
      fetchStudentConsents(consentStudentId);
      alert("Parental consent record logged with verifiable audit timestamp.");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to log consent");
    }
  };

  const handleCreatePrivacyRequest = async (e: React.SubmitEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/privacy/requests", {
        requestType,
        reason: requestReason,
      });
      setIsRequestModalOpen(false);
      fetchInitialData();
      alert("Data subject privacy request logged successfully.");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to submit privacy request");
    }
  };

  const handleDownloadExport = async (userIdToExport: string) => {
    if (!userIdToExport) return;
    setIsExporting(true);
    try {
      const res = await apiClient.get(`/privacy/export/${userIdToExport}`);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `personal-data-export-${userIdToExport}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to export data archive");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExecuteAnonymization = async () => {
    if (!userToAnonymize || confirmText !== "ANONYMIZE") {
      alert("Please type 'ANONYMIZE' in all caps to confirm.");
      return;
    }

    try {
      await apiClient.post(`/privacy/anonymize/${userToAnonymize.id}`, {
        reason: anonymizeReason,
      });
      alert("PII scrubbed and anonymized irreversibly. Financial audit ledger retained as required by law.");
      setIsAnonymizeModalOpen(false);
      setUserToAnonymize(null);
      setConfirmText("");
      fetchInitialData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to anonymize data");
    }
  };

  const requestColumns: Column<PrivacyRequest>[] = [
    {
      header: "Request Type",
      accessorKey: "requestType",
      cell: (row) => (
        <span
          style={{
            fontWeight: 700,
            fontSize: "0.8rem",
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
            background: row.requestType === "DATA_ERASURE" ? "var(--danger-light)" : "var(--primary-50)",
            color: row.requestType === "DATA_ERASURE" ? "var(--danger-dark)" : "var(--primary-700)",
          }}
        >
          {row.requestType?.replace("_", " ")}
        </span>
      ),
    },
    {
      header: "Requested By",
      accessorKey: "user",
      cell: (row) => `${row.user?.firstName || "User"} ${row.user?.lastName || ""}`,
    },
    {
      header: "Reason / Context",
      accessorKey: "reason",
      cell: (row) => (
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {row.reason}
        </span>
      ),
    },
    {
      header: "Date Logged",
      accessorKey: "createdAt",
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
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
            color: row.status === "COMPLETED" ? "var(--success-dark)" : "var(--warning-dark)",
          }}
        >
          {row.status === "COMPLETED" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
          {row.status}
        </span>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {row.requestType === "DATA_EXPORT" && row.status === "COMPLETED" && (
            <Button
              size="sm"
              variant="outline"
              icon={<Download size={13} />}
              onClick={() => handleDownloadZip(row.id)}
            >
              Download ZIP
            </Button>
          )}
          {row.requestType === "DATA_EXPORT" && row.status !== "COMPLETED" && (
            <Button
              size="sm"
              variant="primary"
              icon={<FileJson size={13} />}
              onClick={() => handleProcessExport(row.id)}
            >
              Process Archive
            </Button>
          )}
          {row.requestType === "DATA_ERASURE" && row.status !== "COMPLETED" && (
            <Button
              size="sm"
              variant="outline"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              icon={<Trash2 size={13} />}
              onClick={() => {
                const stud = students.find((s) => s.userId === row.user?.id || s.id === row.user?.id) || students[0];
                if (stud) {
                  setUserToAnonymize(stud);
                  setIsAnonymizeModalOpen(true);
                }
              }}
            >
              Review Erasure
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldCheck className="text-brand" size={26} />
            DPDP Act 2023 Compliance & Privacy Center
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Verifiable parental consent (Sec 9), structured data portability (Sec 11), and irreversible anonymization (Sec 12)
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            variant="outline"
            style={{ color: "var(--danger-dark)", borderColor: "var(--danger-light)" }}
            icon={<Trash2 size={15} />}
            onClick={() => {
              setUserToAnonymize(null);
              setIsAnonymizeModalOpen(true);
            }}
          >
            Right to Erasure
          </Button>
          <Button
            variant="outline"
            icon={<Plus size={15} />}
            onClick={() => setIsRequestModalOpen(true)}
          >
            New Privacy Request
          </Button>
          <Button
            icon={<Shield size={16} />}
            onClick={() => setIsConsentModalOpen(true)}
          >
            Record Parental Consent
          </Button>
        </div>
      </div>

      {/* Statutory DPDP Compliance KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>
            Verifiable Consents (Sec 9)
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.4rem" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>{stats?.activeConsents || 0}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--success-dark)", fontWeight: 700 }}>
              {stats?.consentRate || 100}% Active
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.2rem" }}>
            {stats?.withdrawnConsents || 0} Withdrawn / Revoked
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--primary-700)", fontWeight: 700, textTransform: "uppercase" }}>
            Data Subject Requests
          </span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.4rem 0 0", color: "var(--primary-700)" }}>
            {stats?.totalRequests || requests.length}
          </p>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.2rem" }}>
            {stats?.completedExports || 0} Export Archives Sealed
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid var(--danger)" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--danger-dark)", fontWeight: 700, textTransform: "uppercase" }}>
            Pending Erasures (Sec 12)
          </span>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.4rem 0 0", color: "var(--danger-dark)" }}>
            {stats?.pendingErasure || 0}
          </p>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Statutory clock: 30 days max response
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary-700)", fontWeight: 700, fontSize: "0.8rem" }}>
            <ShieldCheck size={16} />
            Data Protection Officer (DPO)
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, marginTop: "0.35rem" }}>
            {stats?.dpoOfficer?.name || "Institutional Grievance Officer"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
            {stats?.dpoOfficer?.email || "dpo@school.internal"} • {stats?.dpoOfficer?.phone || "+91 80 2345 6789"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-default)" }}>
        <button
          onClick={() => setActiveTab("consents")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "consents" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "consents" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Section 9: Parental Consents
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "requests" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "requests" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Privacy Requests Queue ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab("export")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "export" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "export" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <FileJson size={15} />
          Section 11: Data Portability Export
        </button>
      </div>

      {/* Tab 1: Parental Consents */}
      {activeTab === "consents" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.25rem", alignItems: "start" }}>
          {/* Student Selector Card */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Select Student</h3>
            <div style={{ marginBottom: "0.75rem" }}>
              <Input
                placeholder="Search by name or admission no..."
                value={studentSearchConsent}
                onChange={(e) => setStudentSearchConsent(e.target.value)}
                style={{ fontSize: "0.82rem" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "400px", overflowY: "auto" }}>
              {(students || [])
                .filter((s) => {
                  if (!studentSearchConsent.trim()) return true;
                  const query = studentSearchConsent.toLowerCase();
                  const name = `${s.user?.firstName || ""} ${s.user?.lastName || ""}`.toLowerCase();
                  const adm = (s.admissionNumber || "").toLowerCase();
                  return name.includes(query) || adm.includes(query);
                })
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveStudentId(s.id);
                      fetchStudentConsents(s.id);
                    }}
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: "none",
                      background: activeStudentId === s.id ? "var(--primary-50)" : "transparent",
                      color: activeStudentId === s.id ? "var(--primary-700)" : "var(--text-primary)",
                      fontWeight: activeStudentId === s.id ? 700 : 500,
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      transition: "background 0.2s ease",
                    }}
                  >
                    {s.user?.firstName} {s.user?.lastName} (Adm: {s.admissionNumber || s.id.slice(0, 5)})
                  </button>
                ))}
              {students.filter((s) => {
                if (!studentSearchConsent.trim()) return true;
                const query = studentSearchConsent.toLowerCase();
                const name = `${s.user?.firstName || ""} ${s.user?.lastName || ""}`.toLowerCase();
                const adm = (s.admissionNumber || "").toLowerCase();
                return name.includes(query) || adm.includes(query);
              }).length === 0 && (
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "center", padding: "1rem" }}>
                  No students found matching &quot;{studentSearchConsent}&quot;
                </div>
              )}
            </div>
          </div>

          {/* Consents Record Viewer */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                Verifiable Consent Ledger (DPDP Act Sec 9)
              </h3>
              <Button size="sm" onClick={() => setIsConsentModalOpen(true)} icon={<Plus size={14} />}>
                Record Consent
              </Button>
            </div>

            {selectedStudentConsents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {selectedStudentConsents.map((c: ConsentRecord) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-surface)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                          {c.purpose?.replace(/_/g, " ")}
                        </span>
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: "var(--radius-full)",
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            background: c.isGranted ? "var(--success-light)" : "var(--danger-light)",
                            color: c.isGranted ? "var(--success-dark)" : "var(--danger-dark)",
                          }}
                        >
                          {c.isGranted ? "CONSENT GRANTED" : "WITHDRAWN"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        Recorded At: {new Date(c.grantedAt || c.createdAt).toLocaleString()} | IP: {c.ipAddress || "127.0.0.1"}
                      </div>
                    </div>

                    <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                      Audit Ref: {c.id?.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
                No consent records logged for this student. Click "Record Consent" to capture verifiable parental authorization.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Requests Queue */}
      {activeTab === "requests" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <DataTable
            columns={requestColumns}
            data={requests}
            isLoading={isLoading}
            emptyMessage="No data subject requests recorded."
          />
        </div>
      )}

      {/* Tab 3: Data Portability & Erasure Tools */}
      {activeTab === "export" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Section 11 Data Portability Card */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary-600)", marginBottom: "0.5rem" }}>
              <Download size={22} />
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                Section 11: Data Portability Export
              </h3>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Generates an encrypted, machine-readable JSON archive containing all personal data, academic transcripts, attendance logs, and fee receipts.
            </p>

            <div style={{ marginTop: "1rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Choose Student to Export</label>
              <select
                value={exportUserId}
                onChange={(e) => setExportUserId(e.target.value)}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", marginTop: "0.25rem" }}
              >
                <option value="">-- Select Student / User --</option>
                {(students || []).map((s) => (
                  <option key={s.id} value={s.userId || s.id}>
                    {s.user?.firstName} {s.user?.lastName} (Adm: {s.admissionNumber})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: "1.25rem" }}>
              <Button
                onClick={() => handleDownloadExport(exportUserId || user?.id || "")}
                disabled={isExporting}
                icon={<Download size={15} />}
              >
                {isExporting ? "Generating Archive..." : "Export Full JSON Archive"}
              </Button>
            </div>
          </div>

          {/* Section 12 Right to Erasure Card */}
          <div className="card" style={{ padding: "1.5rem", border: "1px solid var(--danger-light)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--danger)", marginBottom: "0.5rem" }}>
              <Trash2 size={22} />
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                Section 12: Irreversible Anonymization
              </h3>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Permanently scrubs names, emails, phone numbers, and Aadhaar numbers. Financial audit ledgers and sequence keys are preserved as mandated by Indian statutory accounting laws.
            </p>

            <div style={{ marginTop: "1.25rem" }}>
              <Button
                variant="outline"
                style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                icon={<AlertTriangle size={15} />}
                onClick={() => {
                  if (students.length > 0) {
                    setUserToAnonymize(students[0]);
                    setIsAnonymizeModalOpen(true);
                  }
                }}
              >
                Execute Right to Erasure
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Consent Modal */}
      <Modal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        title="Record Verifiable Parental Consent"
      >
        <form onSubmit={handleGrantConsent} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Student</label>
            <select
              value={consentStudentId}
              onChange={(e) => setConsentStudentId(e.target.value)}
              className="input-field"
              required
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="">-- Choose Student --</option>
              {(students || []).map((s: StudentRecord) => (
                <option key={s.id} value={s.id}>
                  {s.user?.firstName} {s.user?.lastName} (Adm: {s.admissionNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Consent Purpose</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="ACADEMIC_PROCESSING">Core Academic Processing & Report Cards</option>
              <option value="BIOMETRIC_ATTENDANCE">Biometric / Facial Recognition Attendance</option>
              <option value="MEDIA_PHOTOGRAPHS">School Media, Yearbook & Website Photographs</option>
              <option value="HEALTH_RECORDS">Student Health & Medical Records</option>
              <option value="THIRD_PARTY_ANALYTICS">Educational Learning Analytics</option>
            </select>
          </div>

          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isGranted}
                onChange={(e) => setIsGranted(e.target.checked)}
              />
              Parent verified identity and affirmatively granted consent
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsConsentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Record Consent</Button>
          </div>
        </form>
      </Modal>

      {/* New Privacy Request Modal */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="Submit Data Subject Privacy Request"
      >
        <form onSubmit={handleCreatePrivacyRequest} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Request Type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="input-field"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="DATA_EXPORT">Data Portability Export (JSON Archive)</option>
              <option value="DATA_ERASURE">Right to Erasure / Account Anonymization</option>
              <option value="CONSENT_REVOCATION">Parental Consent Revocation</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Reason / Details</label>
            <Input
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      {/* Anonymize Confirmation Modal */}
      {isAnonymizeModalOpen && (
        <Modal
          isOpen={isAnonymizeModalOpen}
          onClose={() => {
            setIsAnonymizeModalOpen(false);
            setUserToAnonymize(null);
            setConfirmText("");
          }}
          title="⚠️ Irreversible PII Anonymization (DPDP Act Sec 12)"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Select Student for Erasure / Anonymization
              </label>
              <select
                value={userToAnonymize?.id || ""}
                onChange={(e) => {
                  const stud = students.find((s) => s.id === e.target.value);
                  setUserToAnonymize(stud || null);
                }}
                className="input-field"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", marginTop: "0.25rem" }}
              >
                <option value="">-- Choose a student to anonymize --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user?.firstName} {s.user?.lastName} (Adm: {s.admissionNumber || s.id.slice(0, 5)})
                  </option>
                ))}
              </select>
            </div>

            {userToAnonymize ? (
              <div style={{ background: "var(--danger-light)", padding: "1rem", borderRadius: "var(--radius-md)", color: "var(--danger-dark)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                <strong>WARNING:</strong> This action cannot be undone. All personally identifiable information for student <strong>{userToAnonymize.user?.firstName} {userToAnonymize.user?.lastName}</strong> (email, phone, address, Aadhaar) will be permanently redacted and cryptographic hashes generated for statutory compliance logs.
              </div>
            ) : (
              <div style={{ background: "var(--bg-elevated)", padding: "0.75rem", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Please select a student from the list above to proceed with DPDP Right to Erasure.
              </div>
            )}

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                To proceed, type <strong>ANONYMIZE</strong> below:
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ANONYMIZE"
                disabled={!userToAnonymize}
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsAnonymizeModalOpen(false);
                  setUserToAnonymize(null);
                  setConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button
                style={{ background: "var(--danger)", color: "white" }}
                disabled={!userToAnonymize || confirmText !== "ANONYMIZE"}
                onClick={handleExecuteAnonymization}
              >
                Permanently Anonymize
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
