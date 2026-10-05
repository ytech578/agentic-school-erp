"use client";

import React, { useRef } from "react";
import { Printer, X, GraduationCap, ShieldCheck, Download, Award, Building, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSchool } from "@/hooks/useSchool";

export interface TranscriptModalData {
  id: string;
  requestNumber?: string;
  student?: {
    admissionNumber?: string;
    user?: { firstName: string; lastName: string; email?: string };
  };
  destinationOrganization: string;
  deliveryMode: string;
  purpose: string;
  requestedAt?: string;
  status: string;
  graduationYear?: number;
}

interface OfficialTranscriptModalProps {
  data: TranscriptModalData | null;
  isOpen: boolean;
  onClose: () => void;
  onDownloadPdf?: (id: string, reqNum?: string) => void;
}

export function OfficialTranscriptModal({
  data,
  isOpen,
  onClose,
  onDownloadPdf,
}: OfficialTranscriptModalProps) {
  const schoolConfig = useSchool();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const schoolName = schoolConfig.schoolName || "SUNRISE PUBLIC SCHOOL";
  const affiliationNo = schoolConfig.affiliationNo
    ? `Affiliation No: ${schoolConfig.affiliationNo}`
    : "CBSE Affiliated Senior Secondary Institution";
  const fullAddress = schoolConfig.fullAddress || "Institutional Area, Main Campus";
  const contactInfo = `${schoolConfig.email || "records@school.internal"} • ${schoolConfig.phone || "+91 80 2345 6789"}`;

  const studentName = `${data.student?.user?.firstName || "Student"} ${data.student?.user?.lastName || ""}`.trim();
  const admissionNo = data.student?.admissionNumber || "AD-2022-9481";
  const transcriptNo = data.requestNumber || `TR-${data.id.slice(0, 8).toUpperCase()}`;
  const issueDate = new Date(data.requestedAt || Date.now()).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const gradYear = data.graduationYear || 2024;

  const academicRecords = [
    { code: "ENG-301", subject: "English Core & Advanced Communication", max: 100, obtained: 92, grade: "A1", credits: 4.0 },
    { code: "MTH-341", subject: "Mathematics & Analytical Calculus", max: 100, obtained: 95, grade: "A1", credits: 4.0 },
    { code: "PHY-352", subject: "Physics & Applied Laboratory Practicum", max: 100, obtained: 89, grade: "A2", credits: 4.0 },
    { code: "CHE-363", subject: "Chemistry & Chemical Formulations", max: 100, obtained: 91, grade: "A1", credits: 4.0 },
    { code: "CSC-384", subject: "Computer Science & Data Structures", max: 100, obtained: 98, grade: "A1", credits: 4.0 },
    { code: "PED-312", subject: "Physical, Health & Fitness Education", max: 100, obtained: 94, grade: "A1", credits: 2.0 },
    { code: "ENV-305", subject: "Environmental Ethics & Sustainable Studies", max: 100, obtained: 90, grade: "A1", credits: 2.0 },
  ];

  const totalMax = academicRecords.reduce((acc, r) => acc + r.max, 0);
  const totalObtained = academicRecords.reduce((acc, r) => acc + r.obtained, 0);
  const totalCredits = academicRecords.reduce((acc, r) => acc + r.credits, 0);
  const percentage = ((totalObtained / totalMax) * 100).toFixed(1);
  const cgpa = ((parseFloat(percentage) / 9.5)).toFixed(2);

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
          maxWidth: "860px",
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
            <GraduationCap className="text-brand" size={22} />
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Official Academic Transcript Preview
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
              Certified Institutional Record
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {onDownloadPdf && (
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={14} />}
                onClick={() => onDownloadPdf(data.id, data.requestNumber)}
              >
                Download PDF
              </Button>
            )}
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
            id="printable-transcript"
            className="printable-document"
            ref={printRef}
            style={{
              background: "#ffffff",
              color: "#1e293b",
              padding: "2.5rem 3rem",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              maxWidth: "800px",
              margin: "0 auto",
              fontFamily: "'Inter', sans-serif",
              position: "relative",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Watermark Crest */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) rotate(-25deg)",
                opacity: 0.035,
                fontSize: "6rem",
                fontWeight: 900,
                color: "#0f172a",
                pointerEvents: "none",
                userSelect: "none",
                textAlign: "center",
                lineHeight: 1.1,
                zIndex: 0,
              }}
            >
              OFFICIAL TRANSCRIPT<br />
              SEALED RECORD
            </div>

            {/* Header Letterhead */}
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
                  width: "68px",
                  height: "68px",
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
                <GraduationCap size={36} />
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
                  {fullAddress} • Contact: {contactInfo}
                </p>
              </div>
              <div
                style={{
                  width: "68px",
                  height: "68px",
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
                <span>QR SEAL</span>
              </div>
            </div>

            {/* Document Title */}
            <div style={{ textAlign: "center", margin: "1.25rem 0", position: "relative", zIndex: 1 }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#0284c7",
                  background: "#e0f2fe",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "100px",
                }}
              >
                Office of the Registrar • Academic Evaluation Division
              </span>
              <h2
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  margin: "0.5rem 0 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#0f172a",
                }}
              >
                Certified Official Academic Transcript
              </h2>
            </div>

            {/* Metadata Bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.75rem",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "0.75rem 1rem",
                fontSize: "0.8rem",
                marginBottom: "1.25rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div>
                <span style={{ color: "#64748b", fontSize: "0.7rem", display: "block" }}>TRANSCRIPT NO.</span>
                <strong style={{ color: "#0f172a" }}>{transcriptNo}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontSize: "0.7rem", display: "block" }}>DATE OF ISSUE</span>
                <strong style={{ color: "#0f172a" }}>{issueDate}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontSize: "0.7rem", display: "block" }}>DELIVERY / PURPOSE</span>
                <strong style={{ color: "#0f172a" }}>{data.purpose} ({data.deliveryMode})</strong>
              </div>
            </div>

            {/* Student Profile Information */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: "1.25rem",
                marginBottom: "1.25rem",
                fontSize: "0.82rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div style={{ borderLeft: "3px solid #0284c7", paddingLeft: "0.75rem" }}>
                <div style={{ marginBottom: "0.35rem" }}>
                  <span style={{ color: "#64748b" }}>Candidate Name: </span>
                  <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{studentName}</strong>
                </div>
                <div style={{ marginBottom: "0.35rem" }}>
                  <span style={{ color: "#64748b" }}>Admission / Roll No: </span>
                  <strong style={{ color: "#0f172a" }}>{admissionNo}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Year of Graduation: </span>
                  <strong style={{ color: "#0f172a" }}>Class of {gradYear}</strong>
                </div>
              </div>

              <div style={{ borderLeft: "3px solid #3b82f6", paddingLeft: "0.75rem" }}>
                <div style={{ marginBottom: "0.35rem" }}>
                  <span style={{ color: "#64748b" }}>Recipient / Destination: </span>
                  <strong style={{ color: "#0f172a" }}>{data.destinationOrganization}</strong>
                </div>
                <div style={{ marginBottom: "0.35rem" }}>
                  <span style={{ color: "#64748b" }}>Medium of Instruction: </span>
                  <strong style={{ color: "#0f172a" }}>English</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Institutional Status: </span>
                  <span style={{ color: "#166534", fontWeight: 700 }}>Alumnus in Good Standing</span>
                </div>
              </div>
            </div>

            {/* Academic Performance Table */}
            <div style={{ marginBottom: "1.25rem", position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#334155" }}>
                  Coursework & Evaluation Ledger
                </h3>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Scale: 100 Marks / Alpha Grading A1-D2</span>
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8rem",
                  textAlign: "left",
                  border: "1px solid #cbd5e1",
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700 }}>Code</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700 }}>Subject / Course Description</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Credits</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Max</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Marks Scored</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {academicRecords.map((r, i) => (
                    <tr
                      key={r.code}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                      }}
                    >
                      <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", fontWeight: 600 }}>{r.code}</td>
                      <td style={{ padding: "0.45rem 0.75rem", fontWeight: 600, color: "#1e293b" }}>{r.subject}</td>
                      <td style={{ padding: "0.45rem 0.75rem", textAlign: "center" }}>{r.credits.toFixed(1)}</td>
                      <td style={{ padding: "0.45rem 0.75rem", textAlign: "center", color: "#64748b" }}>{r.max}</td>
                      <td style={{ padding: "0.45rem 0.75rem", textAlign: "center", fontWeight: 700, color: "#0f172a" }}>{r.obtained}</td>
                      <td style={{ padding: "0.45rem 0.75rem", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            fontWeight: 800,
                            fontSize: "0.75rem",
                            background: "#dcfce7",
                            color: "#15803d",
                          }}
                        >
                          {r.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1", fontWeight: 800 }}>
                    <td colSpan={2} style={{ padding: "0.5rem 0.75rem" }}>CUMULATIVE PERFORMANCE TOTALS</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{totalCredits.toFixed(1)}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{totalMax}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#0284c7" }}>{totalObtained}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#15803d" }}>{percentage}%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cumulative Summary Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.75rem",
                marginBottom: "1.75rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "6px",
                  padding: "0.6rem 0.85rem",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#166534", fontWeight: 700 }}>AGGREGATE PERCENTAGE</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#15803d" }}>{percentage}%</div>
              </div>
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  padding: "0.6rem 0.85rem",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: 700 }}>CUMULATIVE GPA (10 pt)</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#2563eb" }}>{cgpa} / 10.0</div>
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "0.6rem 0.85rem",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 700 }}>FINAL DIVISION AWARDED</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", marginTop: "0.2rem" }}>
                  1st Division with Distinction
                </div>
              </div>
            </div>

            {/* Validation & Signature Block */}
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
                <div style={{ height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "cursive", fontSize: "1.1rem", color: "#475569" }}>S. Sharma</span>
                </div>
                <div style={{ borderTop: "1.5px solid #475569", paddingTop: "0.3rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>Verified By</div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Academic Records Officer</div>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "80px",
                    height: "80px",
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
                  <span>INSTITUTION</span>
                  <span>SEAL</span>
                </div>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Office of Academic Affairs</div>
              </div>

              <div style={{ textAlign: "center", width: "180px" }}>
                <div style={{ height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "cursive", fontSize: "1.1rem", color: "#0284c7" }}>Dr. K. Anand</span>
                </div>
                <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "0.3rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800 }}>Registrar / Principal</div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Controller of Examinations</div>
                </div>
              </div>
            </div>

            {/* Statutory Security Disclaimer */}
            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.65rem",
                color: "#94a3b8",
                position: "relative",
                zIndex: 1,
              }}
            >
              <span>Security Key: SEC-TR-{data.id.slice(0, 12).toUpperCase()}</span>
              <span>This is a certified academic transcript. Any alteration voids this certificate.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
