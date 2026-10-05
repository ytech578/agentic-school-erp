"use client";

import React, { useRef } from "react";
import { Printer, X, Award, ShieldCheck, School, Calendar, Clock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSchool } from "@/hooks/useSchool";

export interface ExamScheduleItem {
  date: string;
  time: string;
  subjectCode: string;
  subjectName: string;
  maxMarks: number;
}

export interface HallTicketData {
  examName: string;
  academicSession?: string;
  student: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    sectionName: string;
    dob?: string;
  };
  schedule: ExamScheduleItem[];
}

interface OfficialHallTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HallTicketData | null;
}

export function OfficialHallTicketModal({
  isOpen,
  onClose,
  data,
}: OfficialHallTicketModalProps) {
  const schoolConfig = useSchool();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const schoolName = schoolConfig.schoolName || "SUNRISE PUBLIC SCHOOL";
  const affiliationNo = schoolConfig.affiliationNo
    ? `Affiliation No: ${schoolConfig.affiliationNo}`
    : "Affiliated Senior Secondary Educational Board";
  const fullAddress = schoolConfig.fullAddress || "Institutional Area, Main Campus";
  const contactInfo = `${schoolConfig.email || "exams@school.internal"} • ${schoolConfig.phone || "+91 80 2345 6789"}`;

  const studentName = `${data.student.firstName} ${data.student.lastName}`.trim();
  const academicSession = data.academicSession || "Academic Session: 2026 – 2027";
  const hallTicketNo = `HT-${data.student.admissionNumber || data.student.rollNumber || "2026-01"}`;

  const defaultSchedule: ExamScheduleItem[] = data.schedule?.length > 0 ? data.schedule : [
    { date: "15 Oct 2026", time: "09:30 AM - 12:30 PM", subjectCode: "ENG-101", subjectName: "English Language & Literature", maxMarks: 80 },
    { date: "17 Oct 2026", time: "09:30 AM - 12:30 PM", subjectCode: "MTH-201", subjectName: "Mathematics Core", maxMarks: 80 },
    { date: "19 Oct 2026", time: "09:30 AM - 12:30 PM", subjectCode: "SCI-301", subjectName: "General Science & Laboratory Practicum", maxMarks: 80 },
    { date: "22 Oct 2026", time: "09:30 AM - 12:30 PM", subjectCode: "SST-401", subjectName: "Social Science & Contemporary Studies", maxMarks: 80 },
    { date: "24 Oct 2026", time: "09:30 AM - 11:30 AM", subjectCode: "CSC-501", subjectName: "Computer Applications & Coding", maxMarks: 50 },
  ];

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
            <Award className="text-brand" size={22} />
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Official Examination Admit Card & Hall Ticket
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                background: "var(--primary-50)",
                color: "var(--primary-700)",
                fontWeight: 700,
              }}
            >
              Certified Entry Pass
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
            id="printable-hall-ticket"
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
              lineHeight: 1.5,
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
              EXAMINATION DIVISION<br />
              HALL TICKET
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
                <School size={36} />
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
                  {fullAddress} • Center Code: EX-1049 • Contact: {contactInfo}
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
                <span>OFFICIAL ADMIT CARD</span>
              </div>
            </div>

            {/* Document Title Banner */}
            <div style={{ textAlign: "center", margin: "1.25rem 0 1rem", position: "relative", zIndex: 1 }}>
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
                {academicSession}
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
                {data.examName} — Examination Admit Card & Hall Ticket
              </h2>
            </div>

            {/* Candidate Bio & Photo Layout */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px",
                gap: "1.25rem",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "1rem 1.25rem",
                marginBottom: "1.25rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.82rem" }}>
                <div>
                  <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>CANDIDATE NAME</span>
                  <strong style={{ fontSize: "1rem", color: "#0f172a" }}>{studentName}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>HALL TICKET NO. / ROLL NO.</span>
                  <strong style={{ fontSize: "1rem", color: "#0284c7", fontFamily: "monospace" }}>
                    {data.student.rollNumber || hallTicketNo}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>ADMISSION NUMBER</span>
                  <strong style={{ color: "#0f172a" }}>{data.student.admissionNumber}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>CLASS & SECTION</span>
                  <strong style={{ color: "#0f172a" }}>
                    {data.student.className} – Section {data.student.sectionName}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>EXAMINATION CENTER</span>
                  <strong style={{ color: "#0f172a" }}>Main Campus Hall A / Wing B</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>REPORTING TIME</span>
                  <strong style={{ color: "#166534" }}>09:00 AM Sharp</strong>
                </div>
              </div>

              {/* Photo Box */}
              <div
                style={{
                  border: "1.5px dashed #94a3b8",
                  borderRadius: "6px",
                  background: "#ffffff",
                  height: "140px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.5rem",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                    marginBottom: "0.4rem",
                  }}
                >
                  <UserCheck size={24} />
                </div>
                <span style={{ fontSize: "0.62rem", color: "#64748b", fontWeight: 600 }}>
                  Candidate Photograph
                </span>
                <span style={{ fontSize: "0.55rem", color: "#94a3b8" }}>
                  (Attested by Principal)
                </span>
              </div>
            </div>

            {/* Examination Paper Schedule Table */}
            <div style={{ marginBottom: "1.25rem", position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#334155" }}>
                  Timetable & Paper Verification Schedule
                </h3>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Duration: As indicated per paper</span>
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
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700 }}>Date</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700 }}>Time</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700 }}>Subject Code & Title</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Max Marks</th>
                    <th style={{ padding: "0.5rem 0.75rem", fontWeight: 700, textAlign: "center" }}>Invigilator Initial</th>
                  </tr>
                </thead>
                <tbody>
                  {defaultSchedule.map((p, i) => (
                    <tr
                      key={p.subjectCode + i}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                      }}
                    >
                      <td style={{ padding: "0.45rem 0.75rem", fontWeight: 600, color: "#0f172a" }}>{p.date}</td>
                      <td style={{ padding: "0.45rem 0.75rem", color: "#475569" }}>{p.time}</td>
                      <td style={{ padding: "0.45rem 0.75rem" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0284c7", marginRight: "0.4rem" }}>
                          {p.subjectCode}
                        </span>
                        <strong style={{ color: "#1e293b" }}>{p.subjectName}</strong>
                      </td>
                      <td style={{ padding: "0.45rem 0.75rem", textAlign: "center", color: "#64748b" }}>{p.maxMarks}</td>
                      <td style={{ padding: "0.45rem 0.75rem", textAlign: "center", color: "#cbd5e1", fontSize: "0.7rem" }}>
                        _______________
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mandatory Instructions to Candidates */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "0.85rem 1rem",
                marginBottom: "1.5rem",
                fontSize: "0.75rem",
                color: "#475569",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Mandatory Examination Instructions:
              </div>
              <ol style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.5 }}>
                <li>Candidates must carry this original Admit Card along with their official School Identity Badge.</li>
                <li>Entry into the examination hall closes exactly 15 minutes before the scheduled commencement of the test.</li>
                <li>Calculators, digital smart watches, mobile phones, and unauthorized paper materials are strictly prohibited.</li>
                <li>Write your Roll Number clearly on both the question paper and answer booklet. No supplementary sheets without roll numbers will be graded.</li>
              </ol>
            </div>

            {/* Signatures & Seal Block */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginTop: "1.5rem",
                paddingTop: "1.25rem",
                borderTop: "1px dashed #cbd5e1",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div style={{ textAlign: "center", width: "170px" }}>
                <div style={{ height: "35px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ borderBottom: "1px dotted #94a3b8", width: "120px" }} />
                </div>
                <div style={{ borderTop: "1.5px solid #475569", paddingTop: "0.3rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700 }}>Candidate&apos;s Signature</div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>To be signed before Invigilator</div>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "70px",
                    height: "70px",
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
                  <ShieldCheck size={18} />
                  <span>EXAM CELL</span>
                  <span>STAMP</span>
                </div>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Office of Examinations</div>
              </div>

              <div style={{ textAlign: "center", width: "180px" }}>
                <div style={{ height: "35px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "cursive", fontSize: "1.1rem", color: "#0284c7" }}>Dr. K. Anand</span>
                </div>
                <div style={{ borderTop: "1.5px solid #0f172a", paddingTop: "0.3rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800 }}>Controller of Examinations</div>
                  <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{schoolName}</div>
                </div>
              </div>
            </div>

            {/* Document Footer */}
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
              <span>Security Key: SEC-HT-{hallTicketNo}</span>
              <span>This admit card is non-transferable and remains property of the examination division.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
