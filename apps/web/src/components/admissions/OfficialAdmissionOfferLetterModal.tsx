"use client";

import React, { useRef } from "react";
import { Printer, X, Award, CheckCircle2, ShieldCheck, School, Building } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSchool } from "@/hooks/useSchool";

export interface AdmissionOfferData {
  id: string;
  applicationNo: string;
  studentName: string;
  classApplied: string;
  parentName?: string;
  parentPhone?: string;
  createdAt?: string | Date;
}

interface OfficialAdmissionOfferLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AdmissionOfferData | null;
}

export function OfficialAdmissionOfferLetterModal({
  isOpen,
  onClose,
  data,
}: OfficialAdmissionOfferLetterModalProps) {
  const schoolConfig = useSchool();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const schoolName = schoolConfig.schoolName || "SUNRISE PUBLIC SCHOOL";
  const affiliationNo = schoolConfig.affiliationNo
    ? `Affiliation No: ${schoolConfig.affiliationNo}`
    : "Recognized Senior Secondary Educational Institution";
  const fullAddress = schoolConfig.fullAddress || "Institutional Area, Main Campus";
  const contactInfo = `${schoolConfig.email || "admissions@school.internal"} • ${schoolConfig.phone || "+91 80 2345 6789"}`;

  const offerRefNo = `ADM-OFFER-2026-${(data.applicationNo || data.id.slice(0, 6)).toUpperCase()}`;
  const issueDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "none",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "840px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Modal Toolbar (hidden in print) */}
        <div
          className="no-print"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.85rem 1.25rem",
            borderBottom: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Award className="text-brand" size={22} />
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Provisional Admission Offer Letter Preview
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                background: "var(--success-light)",
                color: "var(--success-dark)",
                fontWeight: 700,
              }}
            >
              Official Document
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Button
              variant="primary"
              size="sm"
              icon={<Printer size={14} />}
              onClick={handlePrint}
            >
              Print / Save PDF
            </Button>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem",
                color: "var(--text-secondary)",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div style={{ overflowY: "auto", padding: "1.5rem", background: "#f8fafc" }}>
          <div
            id="printable-admission-letter"
            className="printable-document"
            ref={printRef}
            style={{
              background: "#ffffff",
              color: "#1e293b",
              padding: "2.5rem 3rem",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              maxWidth: "760px",
              margin: "0 auto",
              fontFamily: "'Inter', sans-serif",
              position: "relative",
              border: "1px solid #e2e8f0",
              lineHeight: 1.6,
            }}
          >
            {/* Watermark */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) rotate(-25deg)",
                opacity: 0.035,
                fontSize: "5.5rem",
                fontWeight: 900,
                color: "#0f172a",
                pointerEvents: "none",
                userSelect: "none",
                textAlign: "center",
                lineHeight: 1.1,
                zIndex: 0,
              }}
            >
              PROVISIONAL ADMISSION<br />
              OFFER OF ENROLLMENT
            </div>

            {/* Letterhead Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1.5rem",
                borderBottom: "2px solid #0f172a",
                paddingBottom: "1.25rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  flexShrink: 0,
                  boxShadow: "0 4px 10px rgba(30, 58, 138, 0.25)",
                }}
              >
                <School size={32} />
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <h1
                  style={{
                    fontSize: "1.45rem",
                    fontWeight: 900,
                    margin: 0,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#0f172a",
                  }}
                >
                  {schoolName}
                </h1>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>
                  {affiliationNo}
                </p>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                  {fullAddress} • Email: {contactInfo}
                </p>
              </div>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  border: "2px dashed #94a3b8",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  color: "#64748b",
                  textAlign: "center",
                  padding: "4px",
                }}
              >
                <ShieldCheck size={20} color="#0284c7" />
                <span>SEAL VALID</span>
              </div>
            </div>

            {/* Ref and Date Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.82rem",
                color: "#475569",
                margin: "1.25rem 0 1rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div>
                <strong>Ref. No: </strong>
                <span style={{ fontFamily: "monospace", color: "#0f172a", fontWeight: 700 }}>{offerRefNo}</span>
              </div>
              <div>
                <strong>Date: </strong>
                <span style={{ color: "#0f172a" }}>{issueDate}</span>
              </div>
            </div>

            {/* Document Title Banner */}
            <div style={{ textAlign: "center", margin: "1rem 0 1.25rem", position: "relative", zIndex: 1 }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#0284c7",
                  background: "#e0f2fe",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "100px",
                }}
              >
                Academic Session: 2026 – 2027
              </span>
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 900,
                  margin: "0.5rem 0 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#0f172a",
                }}
              >
                Provisional Offer of Admission
              </h2>
            </div>

            {/* Recipient Addressee Block */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "0.85rem 1.15rem",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div>To,</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", marginTop: "0.15rem" }}>
                Parent/Guardian of {data.studentName}
              </div>
              <div style={{ color: "#475569", fontSize: "0.8rem" }}>
                Guardian Name: {data.parentName || "Parent / Guardian"} • Phone: {data.parentPhone || "Registered Contact"}
              </div>
              <div style={{ color: "#0284c7", fontSize: "0.8rem", fontWeight: 600, marginTop: "0.2rem" }}>
                Application No: {data.applicationNo}
              </div>
            </div>

            {/* Formal Letter Body */}
            <div style={{ fontSize: "0.85rem", color: "#334155", position: "relative", zIndex: 1 }}>
              <p style={{ margin: "0 0 0.85rem" }}>
                Dear Parent / Guardian,
              </p>
              <p style={{ margin: "0 0 0.85rem" }}>
                On behalf of the Management and Admissions Committee of <strong>{schoolName}</strong>, we are pleased to offer provisional admission to your ward, <strong>{data.studentName}</strong>, into <strong>{data.classApplied}</strong> for the forthcoming <strong>Academic Session 2026 – 2027</strong>.
              </p>
              <p style={{ margin: "0 0 1rem" }}>
                This offer of admission has been granted in recognition of the candidate&apos;s academic evaluation, evaluation interview, and institutional capacity standards.
              </p>

              {/* Conditions Table */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "0.85rem 1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#0f172a", marginBottom: "0.4rem" }}>
                  Important Terms & Confirmation Deadlines:
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.8rem", color: "#475569" }}>
                  <li style={{ marginBottom: "0.3rem" }}>
                    <strong>Fee Remittance:</strong> The admission registration fee and first-quarter composite fee must be deposited within <strong>7 business days</strong> of this letter.
                  </li>
                  <li style={{ marginBottom: "0.3rem" }}>
                    <strong>Original Document Verification:</strong> Submission of the original Transfer Certificate (countersigned if from another state/board) and Birth Certificate is mandatory prior to commencement of classes.
                  </li>
                  <li style={{ marginBottom: "0.3rem" }}>
                    <strong>Orientation & Kits:</strong> Student orientation and distribution of textbooks/uniform sets will be held prior to term start as per the academic calendar.
                  </li>
                  <li>
                    <strong>Statutory Compliance:</strong> This admission is governed by institutional policies, code of conduct, and affiliating board norms.
                  </li>
                </ul>
              </div>

              <p style={{ margin: "0 0 1.25rem" }}>
                We extend a warm welcome to you and your child into our school community and look forward to partnering with you in nurturing their holistic educational journey.
              </p>
            </div>

            {/* Signature Block */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginTop: "2rem",
                paddingTop: "1.5rem",
                borderTop: "1px dashed #cbd5e1",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div style={{ textAlign: "center", width: "180px" }}>
                <div style={{ height: "35px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "cursive", fontSize: "1.1rem", color: "#475569" }}>V. Saxena</span>
                </div>
                <div style={{ borderTop: "1.5px solid #475569", paddingTop: "0.3rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>Dean of Admissions</div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Enrolment & Registry Division</div>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "75px",
                    height: "75px",
                    borderRadius: "50%",
                    border: "2px double #0284c7",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0284c7",
                    margin: "0 auto 0.25rem",
                    fontSize: "0.55rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    lineHeight: 1.1,
                  }}
                >
                  <ShieldCheck size={20} />
                  <span>ADMISSION</span>
                  <span>SEAL</span>
                </div>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Official Institutional Seal</div>
              </div>

              <div style={{ textAlign: "center", width: "180px" }}>
                <div style={{ height: "35px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "cursive", fontSize: "1.1rem", color: "#0284c7" }}>Dr. K. Anand</span>
                </div>
                <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "0.3rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800 }}>Principal / Head of School</div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{schoolName}</div>
                </div>
              </div>
            </div>

            {/* Document Footnote */}
            <div
              style={{
                marginTop: "1.25rem",
                paddingTop: "0.4rem",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.65rem",
                color: "#94a3b8",
                position: "relative",
                zIndex: 1,
              }}
            >
              <span>Security Key: SEC-ADM-{data.id.slice(0, 10).toUpperCase()}</span>
              <span>This provisional offer letter is valid subject to fulfillment of admission criteria.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
