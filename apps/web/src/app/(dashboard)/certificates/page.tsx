"use client";

import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSchool } from "@/hooks/useSchool";
import { formatDate } from "@/lib/formatters";
import QRCode from "qrcode";
import { 
  FileCheck, 
  Plus, 
  Search, 
  Download, 
  QrCode, 
  CheckCircle2, 
  XCircle, 
  Award,
  Eye,
  Printer,
  Building,
  Calendar,
  User,
  ShieldCheck,
  GraduationCap
} from "lucide-react";

interface GuardianInfo {
  firstName: string;
  lastName: string;
  relationship: string;
}

interface EnrollmentInfo {
  section?: {
    name?: string;
    class?: { name?: string };
  };
}

interface StudentProfile {
  id: string;
  admissionNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  admissionDate?: string;
  guardians?: GuardianInfo[];
  enrollments?: EnrollmentInfo[];
  user?: { firstName: string; lastName: string; email?: string };
}

interface CertificateTemplate {
  id: string;
  name: string;
  type: string;
  headerText?: string;
  bodyTemplate?: string;
  footerText?: string;
  signatoryTitle?: string;
}

interface CertificateRecord {
  id: string;
  certificateNumber: string;
  studentId: string;
  student?: StudentProfile;
  template?: CertificateTemplate;
  type?: string;
  status?: string;
  isRevoked?: boolean;
  issueDate?: string;
  issuedAt?: string;
  verificationHash: string;
  revokeReason?: string;
  reason?: string;
  leavingReason?: string;
  conductRemark?: string;
  remarks?: string;
  school?: any;
}

interface VerificationResult {
  valid?: boolean;
  isValid?: boolean;
  message?: string;
  student?: { name?: string; user?: { firstName: string; lastName: string } };
  studentName?: string;
  admissionNumber?: string;
  certificateNumber?: string;
  type?: string;
  template?: CertificateTemplate;
  school?: { name: string };
  schoolName?: string;
  issuedAt?: string;
  issueDate?: string;
  status?: string;
  isRevoked?: boolean;
  conductRemark?: string;
}

const formatDateWords = (dateString?: string): string => {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

export default function CertificatesPage() {
  const { schoolName, affiliationNo, fullAddress, phone, email, principalName, boardType } = useSchool();

  const [activeTab, setActiveTab] = useState<"certificates" | "verify">("certificates");
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [issuedCerts, setIssuedCerts] = useState<CertificateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Student filter inside issue modal
  const [studentSearchInModal, setStudentSearchInModal] = useState("");

  // Issue modal
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [certType, setCertType] = useState<"TRANSFER_CERTIFICATE" | "BONAFIDE" | "CHARACTER">("BONAFIDE");
  
  // Dynamic fields per certificate type
  const [leavingReason, setLeavingReason] = useState("Parent's Transfer / Relocating");
  const [bonafidePurpose, setBonafidePurpose] = useState("Passport Application");
  const [academicSession, setAcademicSession] = useState("2026-2027");
  const [conductRating, setConductRating] = useState("Good");
  const [duesCleared, setDuesCleared] = useState("Yes, cleared up to date");
  const [promotedClass, setPromotedClass] = useState("Yes, qualified for promotion");
  const [issueRemarks, setIssueRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Certificate Viewer Modal
  const [selectedCertForView, setSelectedCertForView] = useState<CertificateRecord | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Verification tab state
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [templRes, studRes, certsRes] = await Promise.allSettled([
        apiClient.get("/certificates/templates"),
        apiClient.get("/students?limit=200"),
        apiClient.get("/certificates"),
      ]);

      if (templRes.status === "fulfilled") {
        const rawTempls = templRes.value.data?.data || templRes.value.data || [];
        const templs = Array.isArray(rawTempls?.items)
          ? rawTempls.items
          : Array.isArray(rawTempls)
          ? rawTempls
          : [];
        setTemplates(templs);
        if (templs.length > 0) {
          setSelectedTemplateId(templs[0].id);
          const tType = templs[0].type as any;
          if (tType === "TRANSFER_CERTIFICATE" || tType === "BONAFIDE" || tType === "CHARACTER") {
            setCertType(tType);
          }
        }
      }

      if (studRes.status === "fulfilled") {
        const rawStuds = studRes.value.data?.data || studRes.value.data || [];
        const studs = Array.isArray(rawStuds?.items)
          ? rawStuds.items
          : Array.isArray(rawStuds)
          ? rawStuds
          : [];
        setStudents(studs);
      }

      if (certsRes.status === "fulfilled") {
        const rawCerts = certsRes.value.data?.data || certsRes.value.data || [];
        const certs = Array.isArray(rawCerts?.items)
          ? rawCerts.items
          : Array.isArray(rawCerts)
          ? rawCerts
          : [];
        setIssuedCerts(certs);
      }
    } catch (err) {
      console.error("Failed to load certificates data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      const tType = tmpl.type as any;
      if (tType === "TRANSFER_CERTIFICATE" || tType === "BONAFIDE" || tType === "CHARACTER") {
        setCertType(tType);
      }
    }
  };

  // Generate QR code for the Certificate Viewer modal
  useEffect(() => {
    if (selectedCertForView?.verificationHash) {
      const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify-certificate/${selectedCertForView.verificationHash}`;
      QRCode.toDataURL(verifyUrl, {
        width: 140,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(""));
    } else {
      setQrCodeDataUrl("");
    }
  }, [selectedCertForView]);

  const handleIssueCertificate = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert("Please select a student member.");
      return;
    }

    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
    const resolvedType = certType || selectedTemplate?.type || "BONAFIDE";

    let resolvedReason = issueRemarks;
    if (resolvedType === "TRANSFER_CERTIFICATE") {
      resolvedReason = leavingReason;
    } else if (resolvedType === "BONAFIDE") {
      resolvedReason = bonafidePurpose;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post("/certificates/issue", {
        studentId: selectedStudentId,
        templateId: selectedTemplateId || undefined,
        type: resolvedType,
        reason: resolvedReason,
        leavingReason: resolvedType === "TRANSFER_CERTIFICATE" ? leavingReason : undefined,
        conductRemark: conductRating,
        remarks: issueRemarks,
      });

      const newCert = res.data?.data || res.data;
      setIssuedCerts((prev) => [newCert, ...prev]);
      setIsIssueModalOpen(false);
      setIssueRemarks("");
      // Open the new certificate directly for viewing & printing
      setSelectedCertForView(newCert);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to generate certificate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!verifyHash.trim()) return;
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const res = await apiClient.get(`/certificates/verify/${encodeURIComponent(verifyHash.trim())}`);
      setVerifyResult(res.data?.data || res.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setVerifyResult({
        valid: false,
        message: error?.response?.data?.message || "Certificate verification failed or invalid signature.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRevoke = async (certId: string) => {
    const reason = prompt("Enter official reason for revocation:");
    if (!reason) return;

    try {
      await apiClient.put(`/certificates/${certId}/revoke`, { reason });
      setIssuedCerts((prev) =>
        prev.map((c) => (c.id === certId ? { ...c, status: "REVOKED", isRevoked: true, revokeReason: reason } : c))
      );
      if (selectedCertForView?.id === certId) {
        setSelectedCertForView((prev) => (prev ? { ...prev, status: "REVOKED", isRevoked: true } : null));
      }
      alert("Certificate has been officially revoked.");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to revoke certificate.");
    }
  };

  const handleDownload = async (certId: string, certNumber: string) => {
    try {
      const res = await apiClient.get(`/certificates/${certId}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `certificate-${(certNumber || certId).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(
        error?.response?.data?.message ||
          "Failed to download certificate PDF. Please ensure you are authenticated.",
      );
    }
  };

  const filteredStudentsForModal = useMemo(() => {
    if (!studentSearchInModal.trim()) return students;
    const q = studentSearchInModal.toLowerCase();
    return students.filter((s) => {
      const fullName = `${s.user?.firstName || ""} ${s.user?.lastName || ""}`.toLowerCase();
      const adm = (s.admissionNumber || "").toLowerCase();
      return fullName.includes(q) || adm.includes(q);
    });
  }, [students, studentSearchInModal]);

  const safeIssuedCerts = Array.isArray(issuedCerts) ? issuedCerts : [];
  const filteredCerts = safeIssuedCerts.filter((c) => {
    const q = searchTerm.toLowerCase();
    const certNum = (c.certificateNumber || "").toLowerCase();
    const hash = (c.verificationHash || "").toLowerCase();
    const studName = `${c.student?.user?.firstName || ""} ${c.student?.user?.lastName || ""}`.toLowerCase();
    return certNum.includes(q) || hash.includes(q) || studName.includes(q);
  });

  const selectedStudentForIssue = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const columns: Column<CertificateRecord>[] = [
    {
      header: "Cert Number",
      accessorKey: "certificateNumber",
      cell: (row) => (
        <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--primary-700)" }}>
          {row.certificateNumber}
        </span>
      ),
    },
    {
      header: "Student Name",
      accessorKey: "student",
      cell: (row) => {
        const fullName = `${row.student?.user?.firstName || "Student"} ${row.student?.user?.lastName || ""}`.trim();
        const currentClass = row.student?.enrollments?.[0]?.section?.class?.name;
        const currentSection = row.student?.enrollments?.[0]?.section?.name;
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{fullName}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              Adm: {row.student?.admissionNumber || "N/A"} {currentClass ? `• ${currentClass} ${currentSection || ""}` : ""}
            </div>
          </div>
        );
      },
    },
    {
      header: "Certificate Type",
      accessorKey: "type",
      cell: (row) => {
        const typeStr = row.type || row.template?.type || "BONAFIDE";
        const displayName =
          typeStr === "TRANSFER_CERTIFICATE"
            ? "Transfer Certificate (TC)"
            : typeStr === "CHARACTER"
            ? "Character & Conduct"
            : "Bonafide Certificate";

        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 600, fontSize: "0.85rem" }}>
            <Award size={15} style={{ color: "var(--primary-600)" }} />
            {displayName}
          </span>
        );
      },
    },
    {
      header: "Issue Date",
      accessorKey: "issueDate",
      cell: (row) => {
        const d = row.issueDate || row.issuedAt;
        return d ? formatDate(d) : "N/A";
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const isRevoked = row.isRevoked || row.status === "REVOKED";
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
              background: isRevoked ? "var(--danger-light)" : "var(--success-light)",
              color: isRevoked ? "var(--danger-dark)" : "var(--success-dark)",
            }}
          >
            {isRevoked ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
            {isRevoked ? "REVOKED" : "VALID / ISSUED"}
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
            variant="outline"
            size="sm"
            onClick={() => setSelectedCertForView(row)}
            icon={<Eye size={13} />}
            title="View & Print Official Certificate"
          >
            View & Print
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownload(row.id, row.certificateNumber)}
            icon={<Download size={13} />}
            title="Download PDF directly"
          >
            PDF
          </Button>
          {!row.isRevoked && row.status !== "REVOKED" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRevoke(row.id)}
              style={{ color: "var(--danger)" }}
              title="Officially revoke this certificate"
            >
              Revoke
            </Button>
          )}
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
            <FileCheck className="text-brand" size={26} />
            Certificates & Institutional Credentials
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Authentic Transfer Certificates (TC), Student Bonafide, Character & Conduct with Cryptographic SHA-256 & QR Verification
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            icon={<Plus size={16} />}
            onClick={() => setIsIssueModalOpen(true)}
          >
            Issue New Certificate
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-default)" }}>
        <button
          onClick={() => setActiveTab("certificates")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "certificates" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "certificates" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Issued Certificates Registry ({safeIssuedCerts.length})
        </button>
        <button
          onClick={() => setActiveTab("verify")}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "verify" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "verify" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <QrCode size={15} />
          Digital Verification Portal
        </button>
      </div>

      {/* Tab 1: Issued Certificates */}
      {activeTab === "certificates" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ marginBottom: "1rem", maxWidth: "340px", position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
            <Input
              placeholder="Search by student, certificate #, or hash..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "2rem" }}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredCerts}
            isLoading={isLoading}
            emptyMessage="No certificates issued yet. Click 'Issue New Certificate' to generate an authentic official certificate."
          />
        </div>
      )}

      {/* Tab 2: Digital Verification Checker */}
      {activeTab === "verify" && (
        <div className="card" style={{ padding: "2rem", maxWidth: "680px", margin: "0 auto", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ display: "inline-flex", padding: "0.75rem", background: "var(--primary-50)", borderRadius: "50%", color: "var(--primary-600)", marginBottom: "0.5rem" }}>
              <QrCode size={36} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.25rem 0" }}>
              Official Cryptographic Certificate Verifier
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Scan the QR code printed on the official certificate or paste its unique 64-character SHA-256 hash below
            </p>
          </div>

          <form onSubmit={handleVerify} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <Input
              placeholder="Paste 64-character verification hash..."
              value={verifyHash}
              onChange={(e) => setVerifyHash(e.target.value)}
              required
            />
            <Button type="submit" disabled={isVerifying}>
              {isVerifying ? "Verifying..." : "Verify"}
            </Button>
          </form>

          {verifyResult && (() => {
            const isCertValid = Boolean(verifyResult.valid ?? verifyResult.isValid);
            const certDate = verifyResult.issueDate || verifyResult.issuedAt;
            const certStatus = verifyResult.isRevoked || verifyResult.status === "REVOKED" ? "REVOKED" : (verifyResult.status || "GENUINE / VALID");
            const studentDisplayName = verifyResult.studentName || verifyResult.student?.name || (verifyResult.student?.user ? `${verifyResult.student.user.firstName} ${verifyResult.student.user.lastName || ''}`.trim() : "Student");
            const certTypeTitle = verifyResult.template?.name || verifyResult.type?.replace(/_/g, " ") || "Official Certificate";
            const schoolDisplayName = verifyResult.schoolName || verifyResult.school?.name || schoolName;

            return (
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: "var(--radius-lg)",
                  border: `1px solid ${isCertValid ? "var(--success)" : "var(--danger)"}`,
                  background: isCertValid ? "var(--success-light)" : "var(--danger-light)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  {isCertValid ? (
                    <CheckCircle2 size={24} style={{ color: "var(--success-dark)" }} />
                  ) : (
                    <XCircle size={24} style={{ color: "var(--danger-dark)" }} />
                  )}
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: isCertValid ? "var(--success-dark)" : "var(--danger-dark)" }}>
                    {isCertValid ? "GENUINE & AUTHENTIC INSTITUTIONAL CERTIFICATE" : "VERIFICATION FAILED"}
                  </h3>
                </div>

                {isCertValid ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                    <div><strong>Student Name:</strong> {studentDisplayName}</div>
                    <div><strong>Certificate Number:</strong> {verifyResult.certificateNumber}</div>
                    <div><strong>Certificate Type:</strong> {certTypeTitle}</div>
                    <div><strong>Issuing Institution:</strong> {schoolDisplayName}</div>
                    <div><strong>Date of Issue:</strong> {certDate ? formatDate(certDate) : "N/A"}</div>
                    {verifyResult.conductRemark && <div><strong>Conduct Rating:</strong> {verifyResult.conductRemark}</div>}
                    <div>
                      <strong>Integrity Status:</strong>{" "}
                      <span style={{ fontWeight: 700, color: certStatus === "REVOKED" ? "var(--danger)" : "var(--success-dark)" }}>
                        {certStatus}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--danger-dark)" }}>
                    {verifyResult.message || "This hash does not match any genuine issued certificate in the official registry."}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── Issue Certificate Modal ─── */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title="Issue Official Institutional Certificate"
        maxWidth="680px"
      >
        <form onSubmit={handleIssueCertificate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Certificate Type Selection */}
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem", display: "block" }}>
              Certificate Document Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {[
                { type: "BONAFIDE", label: "Bonafide", icon: Award },
                { type: "TRANSFER_CERTIFICATE", label: "Transfer (TC)", icon: GraduationCap },
                { type: "CHARACTER", label: "Character & Conduct", icon: ShieldCheck },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    setCertType(item.type as any);
                    const matchedTmpl = templates.find((t) => t.type === item.type);
                    if (matchedTmpl) setSelectedTemplateId(matchedTmpl.id);
                  }}
                  style={{
                    padding: "0.6rem 0.5rem",
                    borderRadius: "var(--radius-md)",
                    border: certType === item.type ? "2px solid var(--primary-600)" : "1px solid var(--border-default)",
                    background: certType === item.type ? "var(--primary-50)" : "var(--bg-surface)",
                    color: certType === item.type ? "var(--primary-700)" : "var(--text-primary)",
                    fontWeight: certType === item.type ? 700 : 500,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "0.8rem",
                    transition: "all 0.15s ease",
                  }}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Student Filter & Select */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Select Student ({students.length} total active students)
              </label>
              <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                {filteredStudentsForModal.length} matching
              </span>
            </div>

            <div style={{ position: "relative", marginBottom: "0.5rem" }}>
              <Search size={14} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
              <Input
                placeholder="Type to filter student by name or admission number..."
                value={studentSearchInModal}
                onChange={(e) => setStudentSearchInModal(e.target.value)}
                style={{ paddingLeft: "1.8rem", fontSize: "0.8rem", height: "34px" }}
              />
            </div>

            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="input-field"
              required
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="">-- Choose Student --</option>
              {filteredStudentsForModal.map((s: StudentProfile) => {
                const currentClass = s.enrollments?.[0]?.section?.class?.name;
                const currentSection = s.enrollments?.[0]?.section?.name;
                return (
                  <option key={s.id} value={s.id}>
                    {s.user?.firstName} {s.user?.lastName} [Adm: {s.admissionNumber || s.id.slice(0, 6)}] {currentClass ? `(${currentClass} ${currentSection || ""})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Contextual Student Particulars Preview */}
          {selectedStudentForIssue && (
            <div style={{ padding: "0.6rem 0.8rem", background: "var(--bg-app)", borderRadius: "var(--radius-md)", fontSize: "0.75rem", color: "var(--text-secondary)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              <div>Father: <strong>{selectedStudentForIssue.guardians?.find(g => (g.relationship || '').toLowerCase().includes('father'))?.firstName || "Recorded on file"}</strong></div>
              <div>Mother: <strong>{selectedStudentForIssue.guardians?.find(g => (g.relationship || '').toLowerCase().includes('mother'))?.firstName || "Recorded on file"}</strong></div>
              <div>DOB: <strong>{formatDate(selectedStudentForIssue.dateOfBirth)}</strong></div>
              <div>Class: <strong>{selectedStudentForIssue.enrollments?.[0]?.section?.class?.name || "Standard Student"} {selectedStudentForIssue.enrollments?.[0]?.section?.name || ""}</strong></div>
            </div>
          )}

          {/* Transfer Certificate Specific Fields */}
          {certType === "TRANSFER_CERTIFICATE" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>
                  Reason for Leaving School
                </label>
                <select
                  value={leavingReason}
                  onChange={(e) => setLeavingReason(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
                >
                  <option value="Parent's Transfer / Relocating">Parent's Transfer / Relocating</option>
                  <option value="Higher Education / Boarding">Higher Education / Boarding</option>
                  <option value="Completed Course of Study">Completed Course of Study</option>
                  <option value="Personal / Domestic Reasons">Personal / Domestic Reasons</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>
                  General Conduct & Character
                </label>
                <select
                  value={conductRating}
                  onChange={(e) => setConductRating(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
                >
                  <option value="Exemplary">Exemplary / Outstanding</option>
                  <option value="Good">Good</option>
                  <option value="Satisfactory">Satisfactory</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>
                  School Dues Clearance
                </label>
                <Input
                  value={duesCleared}
                  onChange={(e) => setDuesCleared(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>
                  Qualified for Promotion
                </label>
                <Input
                  value={promotedClass}
                  onChange={(e) => setPromotedClass(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Bonafide Certificate Specific Fields */}
          {certType === "BONAFIDE" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>
                  Purpose of Certificate
                </label>
                <select
                  value={bonafidePurpose}
                  onChange={(e) => setBonafidePurpose(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
                >
                  <option value="Passport Application">Passport Application</option>
                  <option value="Visa / International Travel">Visa / International Travel</option>
                  <option value="Bank Account Opening">Bank Account Opening</option>
                  <option value="Scholarship / Financial Assistance">Scholarship / Financial Assistance</option>
                  <option value="Government Concession / Bus Pass">Government Concession / Bus Pass</option>
                  <option value="Admission to Higher Education">Admission to Higher Education</option>
                  <option value="Official Institutional Verification">Official Institutional Verification</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>
                  Academic Session
                </label>
                <Input
                  value={academicSession}
                  onChange={(e) => setAcademicSession(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Character Certificate Specific Fields */}
          {certType === "CHARACTER" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>
                  Moral Character & Conduct Rating
                </label>
                <select
                  value={conductRating}
                  onChange={(e) => setConductRating(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "0.45rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
                >
                  <option value="Exemplary">Exemplary / Outstanding</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Satisfactory">Satisfactory</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem", display: "block" }}>
                  Special Achievements / Honors
                </label>
                <Input
                  placeholder="e.g. Active in Sports & Science Club"
                  value={issueRemarks}
                  onChange={(e) => setIssueRemarks(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Official Administrative Remarks
            </label>
            <Input
              placeholder="e.g. All academic records verified and sealed"
              value={issueRemarks}
              onChange={(e) => setIssueRemarks(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.75rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsIssueModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Generating Certificate..." : "Issue & Seal Certificate"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Real Official Certificate Viewer & Printable Sheet Modal ─── */}
      {selectedCertForView && (() => {
        const cert = selectedCertForView;
        const student = cert.student;
        const studentName = `${student?.user?.firstName || "Student"} ${student?.user?.lastName || ""}`.trim();
        const fatherObj = student?.guardians?.find((g) => (g.relationship || '').toLowerCase().includes("father"));
        const motherObj = student?.guardians?.find((g) => (g.relationship || '').toLowerCase().includes("mother"));
        const fatherName = fatherObj ? `${fatherObj.firstName} ${fatherObj.lastName}`.trim() : "Recorded in School Register";
        const motherName = motherObj ? `${motherObj.firstName} ${motherObj.lastName}`.trim() : "Recorded in School Register";
        const className = `${student?.enrollments?.[0]?.section?.class?.name || "Class 10"} ${student?.enrollments?.[0]?.section?.name || "A"}`.trim();
        const dobFormatted = formatDate(student?.dateOfBirth);
        const dobWords = formatDateWords(student?.dateOfBirth);
        const issueDateFormatted = formatDate(cert.issueDate || cert.issuedAt || new Date());
        
        const certTypeKey = cert.type || cert.template?.type || "BONAFIDE";
        const titleBadge =
          certTypeKey === "TRANSFER_CERTIFICATE"
            ? "TRANSFER CERTIFICATE"
            : certTypeKey === "CHARACTER"
            ? "CHARACTER & CONDUCT CERTIFICATE"
            : "STUDENT BONAFIDE CERTIFICATE";

        return (
          <Modal
            isOpen={Boolean(selectedCertForView)}
            onClose={() => setSelectedCertForView(null)}
            title={`Official Certificate — ${cert.certificateNumber}`}
            maxWidth="880px"
          >
            <div
              id="printable-certificate"
              className="official-certificate-sheet"
              style={{
                backgroundColor: "#ffffff",
                color: "#0f172a",
                fontFamily: "var(--font-sans)",
                padding: "2rem",
                borderRadius: "var(--radius-md)",
                border: "4px double #1e3a8a",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                position: "relative",
              }}
            >
              {/* Certificate Header / Official Letterhead */}
              <div style={{ textAlign: "center", borderBottom: "2px solid #0f172a", paddingBottom: "1rem", marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}>
                  <Building size={24} color="#1e3a8a" />
                  <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: "#1e3a8a", letterSpacing: "0.03em" }}>
                    {schoolName.toUpperCase()}
                  </h1>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: "0.25rem", fontWeight: 600 }}>
                  Recognized & Affiliated to {boardType} Board • Affiliation No: {affiliationNo}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
                  {fullAddress} • Phone: {phone} • Email: {email}
                </div>

                {/* Ornate Certificate Badge Title */}
                <div style={{ marginTop: "1rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.4rem 1.8rem",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      borderRadius: "6px",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      letterSpacing: "0.08em",
                      border: "1px solid #334155",
                    }}
                  >
                    {titleBadge}
                  </span>
                </div>
              </div>

              {/* Meta details bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.825rem", borderBottom: "1px dashed #cbd5e1", paddingBottom: "0.6rem", marginBottom: "1.25rem" }}>
                <div>Certificate No: <strong style={{ fontFamily: "monospace", color: "#1e40af" }}>{cert.certificateNumber}</strong></div>
                <div>Admission No: <strong>{student?.admissionNumber || "ADM2026/001"}</strong></div>
                <div>Date of Issue: <strong>{issueDateFormatted}</strong></div>
              </div>

              {/* Certificate Specific Layouts */}
              {certTypeKey === "TRANSFER_CERTIFICATE" && (
                <div style={{ fontSize: "0.85rem", lineHeight: 1.8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "0.35rem 0", width: "45%", color: "#475569", fontWeight: 600 }}>1. Name of the Pupil:</td>
                        <td style={{ padding: "0.35rem 0", fontWeight: 700, color: "#0f172a" }}>{studentName}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>2. Father's / Guardian's Name:</td>
                        <td style={{ padding: "0.35rem 0", fontWeight: 600 }}>{fatherName}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>3. Mother's Name:</td>
                        <td style={{ padding: "0.35rem 0", fontWeight: 600 }}>{motherName}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>4. Nationality:</td>
                        <td style={{ padding: "0.35rem 0" }}>Indian</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>5. Date of Birth (in figures & words):</td>
                        <td style={{ padding: "0.35rem 0" }}>{dobFormatted} ({dobWords})</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>6. Class in which pupil last studied:</td>
                        <td style={{ padding: "0.35rem 0", fontWeight: 700 }}>{className}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>7. School / Board Annual Examination:</td>
                        <td style={{ padding: "0.35rem 0" }}>Passed and Promoted</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>8. Subjects Studied:</td>
                        <td style={{ padding: "0.35rem 0" }}>English, Mathematics, Science, Social Science, Hindi / Second Language</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>9. Month up to which school dues paid:</td>
                        <td style={{ padding: "0.35rem 0", color: "#059669", fontWeight: 600 }}>All school dues cleared</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>10. General Conduct:</td>
                        <td style={{ padding: "0.35rem 0", fontWeight: 700 }}>{cert.conductRemark || "Good & Diligent"}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "0.35rem 0", color: "#475569", fontWeight: 600 }}>11. Reason for Leaving School:</td>
                        <td style={{ padding: "0.35rem 0", fontWeight: 600 }}>{cert.leavingReason || cert.reason || "Parent's Transfer / Relocating"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {certTypeKey === "BONAFIDE" && (
                <div style={{ fontSize: "0.95rem", lineHeight: 2, padding: "1rem 0", textAlign: "justify" }}>
                  <p>
                    This is to formally certify that Master / Miss <strong style={{ color: "#1e3a8a", textDecoration: "underline" }}>{studentName}</strong>, 
                    bearing Admission Number <strong>{student?.admissionNumber || "ADM2026/001"}</strong>, Son / Daughter of 
                    Shri <strong>{fatherName}</strong> and Smt. <strong>{motherName}</strong>, is a genuine and bona fide student 
                    of <strong>{schoolName}</strong>, currently enrolled and studying in <strong>{className}</strong> for 
                    the Academic Session <strong>{academicSession}</strong>.
                  </p>
                  <p style={{ marginTop: "1rem" }}>
                    According to the official admission records of this institution, their recorded Date of Birth is <strong>{dobFormatted}</strong> ({dobWords}).
                  </p>
                  <p style={{ marginTop: "1rem" }}>
                    To the best of our knowledge, their general conduct and progress in academic pursuits have been <strong>{cert.conductRemark || "Good"}</strong>. 
                    This official certificate is issued upon parent's request for the specific purpose of <strong>{cert.reason || "Official Verification / Passport Application"}</strong>.
                  </p>
                </div>
              )}

              {certTypeKey === "CHARACTER" && (
                <div style={{ fontSize: "0.95rem", lineHeight: 2, padding: "1rem 0", textAlign: "justify" }}>
                  <p>
                    This is to certify that <strong style={{ color: "#1e3a8a", textDecoration: "underline" }}>{studentName}</strong>, 
                    bearing Admission Number <strong>{student?.admissionNumber || "ADM2026/001"}</strong>, Son / Daughter of 
                    Shri <strong>{fatherName}</strong>, has been a bonafide student of <strong>{schoolName}</strong> studying in <strong>{className}</strong>.
                  </p>
                  <p style={{ marginTop: "1rem" }}>
                    During their tenure at this educational institution, they have consistently maintained an <strong style={{ color: "#059669" }}>{cert.conductRemark || "Exemplary"}</strong> standard of moral character, discipline, and personal conduct.
                  </p>
                  <p style={{ marginTop: "1rem" }}>
                    They have actively participated in school curricular and co-curricular programs and exhibited high integrity and cooperation with staff and peers. 
                    We wish the student grand success in all their future academic and personal pursuits.
                  </p>
                </div>
              )}

              {/* Cryptographic QR & Verification Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                {/* QR Code */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="Certificate Verification QR Code" style={{ width: "90px", height: "90px", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                  ) : (
                    <div style={{ width: "90px", height: "90px", border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <QrCode size={40} color="#94a3b8" />
                    </div>
                  )}
                  <div style={{ fontSize: "0.7rem", color: "#64748b", maxWidth: "160px" }}>
                    <div><strong>Scan to Authenticate</strong></div>
                    <div>Instant cryptographic verification on school digital ledger</div>
                  </div>
                </div>

                {/* Signatures */}
                <div style={{ display: "flex", gap: "2.5rem", textAlign: "center" }}>
                  <div>
                    <div style={{ width: "130px", borderBottom: "1px solid #0f172a", marginBottom: "0.35rem", height: "35px" }}></div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1e293b" }}>Class Teacher</div>
                  </div>
                  <div>
                    <div style={{ width: "160px", borderBottom: "1px solid #0f172a", marginBottom: "0.35rem", height: "35px" }}></div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1e293b" }}>{principalName || "Principal / Head of School"}</div>
                    <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Official Seal & Signature</div>
                  </div>
                </div>
              </div>

              {/* Tamper Proof Hash */}
              <div style={{ marginTop: "1rem", fontSize: "0.65rem", color: "#94a3b8", textAlign: "center", fontFamily: "monospace", wordBreak: "break-all" }}>
                Tamper-evident verification hash: {cert.verificationHash}
              </div>
            </div>

            {/* Action Bar (Hidden in Print) */}
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem", borderTop: "1px solid var(--border-light)", paddingTop: "1rem" }}>
              <Button variant="ghost" onClick={() => setSelectedCertForView(null)}>
                Close
              </Button>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  variant="outline"
                  icon={<Download size={15} />}
                  onClick={() => handleDownload(cert.id, cert.certificateNumber)}
                >
                  Download PDF
                </Button>
                <Button
                  icon={<Printer size={15} />}
                  onClick={() => window.print()}
                >
                  Print Official Certificate
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
