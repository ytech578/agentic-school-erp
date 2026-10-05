"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/axios";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck,
  FileCheck,
  Loader2
} from "lucide-react";

export interface AdmissionDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

interface AdmissionDocumentVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: {
    id: string;
    applicationNo: string;
    studentName: string;
    classApplied: string;
    parentName?: string;
    status?: string;
  } | null;
}

const DOCUMENT_CHECKLIST = [
  { type: "BIRTH_CERTIFICATE", label: "Birth Certificate (Municipal/Govt issued)" },
  { type: "PREVIOUS_MARKSHEET", label: "Previous Academic Marksheet / Report Card" },
  { type: "TRANSFER_CERTIFICATE", label: "Transfer Certificate (TC) / School Leaving" },
  { type: "ADDRESS_PROOF", label: "Address Proof (Utility Bill / Passport / Lease)" },
  { type: "AADHAAR_IDENTIFICATION", label: "Student & Guardian Aadhaar / ID Proof" },
];

export function AdmissionDocumentVaultModal({
  isOpen,
  onClose,
  application,
}: AdmissionDocumentVaultModalProps) {
  const [documents, setDocuments] = useState<AdmissionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("BIRTH_CERTIFICATE");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen && application?.id) {
      fetchDocuments();
    } else {
      setDocuments([]);
      setUploadFile(null);
    }
  }, [isOpen, application]);

  const fetchDocuments = async () => {
    if (!application?.id) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/admissions/applications/${application.id}/documents`);
      const raw = res.data?.data || res.data || [];
      setDocuments(Array.isArray(raw) ? raw : []);
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!application?.id || !uploadFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("documentType", selectedDocType);

      await apiClient.post(`/admissions/applications/${application.id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadFile(null);
      fetchDocuments();
      alert("Admission document uploaded successfully!");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (docId: string, fileName: string) => {
    if (!application?.id) return;
    try {
      const res = await apiClient.get(`/admissions/applications/${application.id}/documents/${docId}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName || "admission-document");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download document");
    }
  };

  const handleDelete = async (docId: string) => {
    if (!application?.id) return;
    if (!confirm("Are you sure you want to delete this document from the vault?")) return;

    try {
      await apiClient.delete(`/admissions/applications/${application.id}/documents/${docId}`);
      fetchDocuments();
      alert("Document deleted successfully");
    } catch {
      alert("Failed to delete document");
    }
  };

  if (!isOpen || !application) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Document Vault: ${application.studentName} (${application.applicationNo})`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "75vh", overflowY: "auto" }}>
        {/* Applicant Header Info */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.85rem 1rem",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{application.studentName}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Applying for {application.classApplied} • Guardian: {application.parentName || "Parent"}
            </div>
          </div>
          <span
            style={{
              padding: "0.2rem 0.6rem",
              borderRadius: "100px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "var(--primary-50)",
              color: "var(--primary-700)",
            }}
          >
            {application.status || "APPLIED"}
          </span>
        </div>

        {/* Mandatory Document Checklist Status */}
        <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "1rem" }}>
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Mandatory Verification Checklist
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {DOCUMENT_CHECKLIST.map((item) => {
              const uploaded = documents.some((d) => d.documentType === item.type);
              return (
                <div
                  key={item.type}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.82rem",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "4px",
                    background: uploaded ? "var(--success-light)" : "var(--bg-surface)",
                  }}
                >
                  <span style={{ fontWeight: uploaded ? 600 : 400, color: uploaded ? "var(--success-dark)" : "var(--text-secondary)" }}>
                    {item.label}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      color: uploaded ? "var(--success-dark)" : "var(--warning-dark)",
                    }}
                  >
                    {uploaded ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {uploaded ? "Verified & Uploaded" : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upload Form */}
        <form
          onSubmit={handleFileUpload}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            padding: "1rem",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Upload size={16} />
            <span>Upload New Verification Document</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Document Type</label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="input-field"
                style={{ width: "100%", padding: "0.45rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", fontSize: "0.82rem" }}
              >
                {DOCUMENT_CHECKLIST.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.label}
                  </option>
                ))}
                <option value="GENERAL_DOCUMENT">Other Supporting Document</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Select File (PDF, PNG, JPG)</label>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                style={{ width: "100%", fontSize: "0.8rem", marginTop: "0.2rem" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="submit"
              size="sm"
              disabled={!uploadFile || isUploading}
              icon={isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            >
              {isUploading ? "Uploading..." : "Upload Document"}
            </Button>
          </div>
        </form>

        {/* Uploaded Documents List */}
        <div>
          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 700 }}>
            Stored Documents in Vault ({documents.length})
          </h4>

          {isLoading ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: "0 auto 0.5rem" }} />
              Loading document records...
            </div>
          ) : documents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <FileCheck size={18} color="var(--primary-600)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{doc.fileName}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                        {doc.documentType?.replace(/_/g, " ")} • {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Download size={13} />}
                      onClick={() => handleDownload(doc.id, doc.fileName)}
                    >
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ color: "var(--danger)" }}
                      icon={<Trash2 size={13} />}
                      onClick={() => handleDelete(doc.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)" }}>
              No documents uploaded yet. Upload the candidate&apos;s birth certificate or previous marksheets above.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
