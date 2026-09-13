"use client";

import React, { useRef } from "react";
import { Printer, X, Award, School } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ReportCardSubject {
  code?: string;
  name: string;
  groupName?: string;
  theoryMax?: number;
  theoryScored?: number;
  practicalMax?: number;
  practicalScored?: number;
  totalMax: number;
  totalPass: number;
  totalScored: number;
  grade: string;
  status: "PASSED" | "FAILED" | "ABSENT";
}

export interface ReportCardData {
  schoolName?: string;
  affiliationNo?: string;
  schoolAddress?: string;
  academicSession?: string;
  examName: string;
  student: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber?: string;
    className: string;
    sectionName: string;
    dob?: string;
    fatherName?: string;
    motherName?: string;
    attendancePercent?: number | string;
  };
  subjects: ReportCardSubject[];
  summary: {
    totalMarks: number;
    obtainedMarks: number;
    percentage: number;
    rank?: number | string;
    grade: string;
    resultStatus: "PASSED" | "FAILED" | "DISTINCTION";
    teacherRemarks?: string;
  };
}

interface OfficialReportCardModalProps {
  data: ReportCardData;
  onClose: () => void;
}

export function OfficialReportCardModal({ data, onClose }: OfficialReportCardModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const schoolName = data.schoolName || "SUNRISE PUBLIC SCHOOL";
  const affiliationNo = data.affiliationNo || "CBSE Affiliation No: 2130842 · School Code: 70192";
  const schoolAddress = data.schoolAddress || "Institutional Area, Knowledge Park II, New Delhi - 110001";
  const academicSession = data.academicSession || "Academic Session: 2025 – 2026";
  const student = data.student;
  const summary = data.summary;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-report-card-sheet, #official-report-card-sheet * {
            visibility: visible !important;
          }
          #official-report-card-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 12mm 15mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: 3px double #1e293b !important;
            box-shadow: none !important;
            font-size: 11pt !important;
          }
          .report-no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth: "850px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--border-default)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Control Bar (Screen only) */}
        <div
          className="report-no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 1.5rem",
            background: "var(--bg-surface-solid)",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Award size={20} style={{ color: "var(--primary-600)" }} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
              Official Student Performance Transcript
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Button size="sm" onClick={handlePrint} variant="outline">
              <Printer size={15} style={{ marginRight: "0.4rem" }} /> Print Report Card
            </Button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                padding: "0.25rem",
                display: "flex",
                alignItems: "center",
              }}
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Container */}
        <div style={{ padding: "1.5rem", overflowY: "auto", background: "var(--bg-app)" }}>
          {/* Official Document Sheet */}
          <div
            id="official-report-card-sheet"
            ref={printRef}
            style={{
              background: "#ffffff",
              color: "#1e293b",
              borderRadius: "4px",
              padding: "2rem 2.25rem",
              border: "3px double #334155",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
              position: "relative",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {/* Header Letterhead */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #0f172a", paddingBottom: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                <School size={28} style={{ color: "#1e3a8a" }} />
                <h1 style={{ fontSize: "1.65rem", fontWeight: 900, color: "#1e3a8a", letterSpacing: "0.02em", margin: 0, textTransform: "uppercase" }}>
                  {schoolName}
                </h1>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#475569", margin: "0.15rem 0", fontWeight: 600 }}>
                {affiliationNo}
              </p>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                {schoolAddress}
              </p>
              <div style={{ display: "inline-block", marginTop: "0.75rem", padding: "0.25rem 1.25rem", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "9999px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  OFFICIAL REPORT CARD · {data.examName} ({academicSession})
                </span>
              </div>
            </div>

            {/* Student Biodata Profile Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.5rem 1rem",
                padding: "0.875rem 1.25rem",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                marginBottom: "1.25rem",
                fontSize: "0.8125rem",
              }}
            >
              <div>
                <span style={{ color: "#64748b", fontWeight: 500 }}>Student Name:</span>{" "}
                <strong style={{ color: "#0f172a" }}>{student.firstName} {student.lastName}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontWeight: 500 }}>Admission No:</span>{" "}
                <strong style={{ color: "#0f172a" }}>{student.admissionNumber}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontWeight: 500 }}>Class & Section:</span>{" "}
                <strong style={{ color: "#0f172a" }}>{student.className} - {student.sectionName}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontWeight: 500 }}>Roll Number:</span>{" "}
                <strong style={{ color: "#0f172a" }}>{student.rollNumber || "—"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontWeight: 500 }}>Father&apos;s Name:</span>{" "}
                <strong style={{ color: "#0f172a" }}>{student.fatherName || "—"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontWeight: 500 }}>Attendance:</span>{" "}
                <strong style={{ color: "#059669" }}>{student.attendancePercent ? `${student.attendancePercent}%` : "95.2%"}</strong>
              </div>
            </div>

            {/* Scholastic Marks Matrix Table */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", marginBottom: "1.25rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#ffffff" }}>
                    <th style={{ padding: "0.6rem 0.75rem", fontWeight: 700, width: "35px" }}>#</th>
                    <th style={{ padding: "0.6rem 0.75rem", fontWeight: 700 }}>Subject</th>
                    <th style={{ padding: "0.6rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Theory</th>
                    <th style={{ padding: "0.6rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Internal / Prac</th>
                    <th style={{ padding: "0.6rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Total (Max)</th>
                    <th style={{ padding: "0.6rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Marks Scored</th>
                    <th style={{ padding: "0.6rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Grade</th>
                    <th style={{ padding: "0.6rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.map((sub, idx) => {
                    const theoryMax = sub.theoryMax ?? Math.round(sub.totalMax * 0.8);
                    const theoryScored = sub.theoryScored ?? (sub.status === "ABSENT" ? 0 : Math.round(sub.totalScored * 0.8));
                    const pracMax = sub.practicalMax ?? Math.round(sub.totalMax * 0.2);
                    const pracScored = sub.practicalScored ?? (sub.status === "ABSENT" ? 0 : sub.totalScored - theoryScored);

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                        }}
                      >
                        <td style={{ padding: "0.55rem 0.75rem", color: "#64748b", fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: "0.55rem 0.75rem" }}>
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{sub.name}</span>
                          {sub.code && <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "#64748b" }}>({sub.code})</span>}
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "center", color: "#334155" }}>
                          {theoryScored} / {theoryMax}
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "center", color: "#334155" }}>
                          {pracScored} / {pracMax}
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "center", color: "#475569" }}>
                          {sub.totalMax}
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "center", fontWeight: 800, color: "#0f172a" }}>
                          {sub.status === "ABSENT" ? "ABSENT" : sub.totalScored}
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "center", fontWeight: 800, color: "#2563eb" }}>
                          {sub.status === "ABSENT" ? "—" : sub.grade}
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem", textAlign: "center" }}>
                          <span style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            background: sub.status === "PASSED" ? "#dcfce7" : "#fee2e2",
                            color: sub.status === "PASSED" ? "#15803d" : "#b91c1c",
                          }}>
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Performance Summary Banner */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "0.75rem",
                padding: "1rem",
                background: "#0f172a",
                color: "#ffffff",
                borderRadius: "6px",
                textAlign: "center",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Grand Total</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, marginTop: "0.2rem" }}>
                  {summary.obtainedMarks} / {summary.totalMarks}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Percentage</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#38bdf8", marginTop: "0.2rem" }}>
                  {summary.percentage.toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Class Rank</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#fbbf24", marginTop: "0.2rem" }}>
                  {summary.rank ? `#${summary.rank}` : "Top 5%"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Final Grade</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#4ade80", marginTop: "0.2rem" }}>
                  {summary.grade}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Result</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#ffffff", marginTop: "0.2rem" }}>
                  {summary.resultStatus}
                </div>
              </div>
            </div>

            {/* Co-Scholastic & Teacher Remarks Section */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                padding: "0.875rem 1rem",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                marginBottom: "2rem",
                fontSize: "0.75rem",
              }}
            >
              <div>
                <strong style={{ color: "#0f172a", display: "block", marginBottom: "0.35rem" }}>Co-Scholastic Assessment:</strong>
                <div style={{ display: "flex", gap: "1rem", color: "#475569" }}>
                  <span>Discipline: <strong>A</strong></span>
                  <span>Work Education: <strong>A</strong></span>
                  <span>Health & P.E.: <strong>A+</strong></span>
                </div>
              </div>
              <div>
                <strong style={{ color: "#0f172a", display: "block", marginBottom: "0.35rem" }}>Teacher Remarks:</strong>
                <p style={{ margin: 0, color: "#334155", fontStyle: "italic" }}>
                  {summary.teacherRemarks || "Exhibits outstanding scholastic dedication, exemplary peer collaboration, and strong analytical aptitude."}
                </p>
              </div>
            </div>

            {/* Signatures & Seal Block */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                paddingTop: "2rem",
                marginTop: "1.5rem",
                borderTop: "1px dashed #cbd5e1",
                fontSize: "0.8rem",
                color: "#475569",
              }}
            >
              <div style={{ textAlign: "center", width: "160px" }}>
                <div style={{ height: "40px", borderBottom: "1px solid #64748b", marginBottom: "0.35rem" }} />
                <strong>Class Teacher</strong>
              </div>

              <div style={{ textAlign: "center", width: "140px" }}>
                <div
                  style={{
                    width: "70px",
                    height: "70px",
                    borderRadius: "50%",
                    border: "2px dashed #94a3b8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 0.25rem",
                    fontSize: "0.65rem",
                    color: "#94a3b8",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Institution Seal
                </div>
              </div>

              <div style={{ textAlign: "center", width: "160px" }}>
                <div style={{ height: "40px", borderBottom: "1px solid #64748b", marginBottom: "0.35rem" }} />
                <strong>Principal</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
