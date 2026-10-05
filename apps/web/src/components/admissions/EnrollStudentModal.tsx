"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/axios";
import { 
  UserCheck, 
  CheckCircle2, 
  Hash, 
  BookOpen, 
  Users, 
  Sparkles, 
  Copy, 
  Check, 
  AlertCircle,
  Loader2,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

interface EnrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: {
    id: string;
    applicationNo: string;
    studentName: string;
    classApplied: string;
    parentName?: string;
    parentPhone?: string;
    interviewNotes?: string | null;
  } | null;
  onSuccess: () => void;
}

export function EnrollStudentModal({
  isOpen,
  onClose,
  application,
  onSuccess,
}: EnrollStudentModalProps) {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [copied, setCopied] = useState(false);

  // Success result state
  const [resultData, setResultData] = useState<{
    student: any;
    enrollment?: any;
    temporaryPassword?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && application?.id) {
      loadPreview();
    } else {
      setResultData(null);
      setSelectedClassId("");
      setSelectedSectionId("");
      setAdmissionNumber("");
      setRollNumber("");
    }
  }, [isOpen, application?.id]);

  const loadPreview = async () => {
    if (!application?.id) return;
    setLoadingPreview(true);
    setResultData(null);
    try {
      const res = await apiClient.get(`/admissions/applications/${application.id}/enrollment-preview`);
      const data = res.data?.data || res.data || {};
      const classList = data.classes || [];
      setClasses(classList);
      setAdmissionNumber(data.nextAdmissionNumber || "ADM261701");

      // Intelligently find matching class based on classApplied & interviewNotes
      const textToMatch = `${application.classApplied || ""} ${application.interviewNotes || ""}`.toLowerCase();
      let matchedClass = classList[0];

      // Try numeric match
      const numMatch = textToMatch.match(/(?:class|grade|standard|std)?\s*(\d{1,2})/i);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        const found = classList.find((c: any) => c.numericLevel === num || c.name.toLowerCase().includes(`class ${num}`));
        if (found) matchedClass = found;
      } else if (/\bone\b|\bfirst\b/i.test(textToMatch)) {
        matchedClass = classList.find((c: any) => c.name.toLowerCase().includes("class 1")) || classList[0];
      }

      if (matchedClass) {
        setSelectedClassId(matchedClass.id);
        const sections = matchedClass.sections || [];
        
        // Match section (e.g. section b, in section b)
        let matchedSection = sections[0];
        const secMatch = textToMatch.match(/(?:section|\b)\s*([a-e])\b/i);
        if (secMatch) {
          const secLetter = secMatch[1].toUpperCase();
          const foundSec = sections.find((s: any) => s.name.toUpperCase() === secLetter);
          if (foundSec) matchedSection = foundSec;
        }

        if (matchedSection) {
          setSelectedSectionId(matchedSection.id);
          const activeCount = matchedSection._count?.enrollments || 0;
          setRollNumber(String(activeCount + 1).padStart(2, "0"));
        }
      }
    } catch (e) {
      console.error("Failed to load enrollment preview:", e);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Re-calculate roll number when section changes
  useEffect(() => {
    if (!selectedClassId || !selectedSectionId) return;
    const currentClass = classes.find((c) => c.id === selectedClassId);
    const currentSection = currentClass?.sections?.find((s: any) => s.id === selectedSectionId);
    if (currentSection) {
      const activeCount = currentSection._count?.enrollments || 0;
      setRollNumber(String(activeCount + 1).padStart(2, "0"));
    }
  }, [selectedClassId, selectedSectionId, classes]);

  const handleEnroll = async () => {
    if (!application?.id || !selectedClassId || !selectedSectionId) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post(`/admissions/applications/${application.id}/convert`, {
        classId: selectedClassId,
        sectionId: selectedSectionId,
        rollNumber: rollNumber || undefined,
      });
      const data = res.data?.data || res.data;
      setResultData(data);
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to enroll student.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClassObj = classes.find((c) => c.id === selectedClassId);
  const sectionsList = selectedClassObj?.sections || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={resultData ? "Student Successfully Enrolled! 🎉" : "Enroll Applicant as Formal Student"}
      maxWidth="580px"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {resultData ? (
          /* SUCCESS VIEW */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", padding: "0.5rem 0" }}>
            <div style={{
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              borderRadius: "var(--radius-xl)",
              padding: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem"
            }}>
              <div style={{
                background: "var(--status-success)",
                color: "#FFFFFF",
                borderRadius: "var(--radius-full)",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <CheckCircle2 size={26} />
              </div>
              <div>
                <h4 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                  {application?.studentName} is Officially Enrolled!
                </h4>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Record synchronized into Academic Year roster, class timetable, and attendance registry.
                </p>
              </div>
            </div>

            {/* Credential & Roll Details Box */}
            <div style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "1rem",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem"
            }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>ADMISSION NUMBER</span>
                <p style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--brand-primary)", marginTop: "0.15rem" }}>
                  {resultData.student?.admissionNumber || admissionNumber}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>ROLL NUMBER</span>
                <p style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.15rem" }}>
                  #{resultData.student?.rollNumber || rollNumber}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>ASSIGNED CLASS</span>
                <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginTop: "0.15rem" }}>
                  {selectedClassObj?.name} — Section {sectionsList.find((s: any) => s.id === selectedSectionId)?.name}
                </p>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>PORTAL LOGIN PASSWORD</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.15rem" }}>
                  <code style={{ fontSize: "var(--text-xs)", background: "var(--bg-elevated)", padding: "0.2rem 0.4rem", borderRadius: "var(--radius-sm)", color: "var(--brand-teal)", fontWeight: 700 }}>
                    {resultData.temporaryPassword || "Std@2026!"}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resultData.temporaryPassword || "");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    title="Copy Password"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
                  >
                    {copied ? <Check size={14} color="var(--status-success)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <Link
                href="/students"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "var(--text-xs)",
                  color: "var(--brand-primary)",
                  fontWeight: 600,
                  textDecoration: "none"
                }}
              >
                View in Students Directory <ArrowRight size={14} />
              </Link>
              <Button onClick={onClose} variant="primary">
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <>
            {loadingPreview ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "0.75rem" }}>
                <Loader2 size={28} className="animate-spin" color="var(--brand-primary)" />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  Analyzing enrollment capacity and sequencing...
                </span>
              </div>
            ) : (
              <>
                {/* Candidate Overview Card */}
                <div style={{
                  background: "var(--bg-surface)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-default)",
                  padding: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand-primary)", letterSpacing: "0.05em" }}>
                      {application?.applicationNo}
                    </span>
                    <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.15rem" }}>
                      {application?.studentName}
                    </h3>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                      Class Applied: <strong style={{ color: "var(--text-primary)" }}>{application?.classApplied}</strong>
                      {application?.parentName && ` • Parent: ${application.parentName}`}
                    </p>
                  </div>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "0.25rem 0.6rem",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "var(--status-success)"
                  }}>
                    ACCEPTED
                  </span>
                </div>

                {/* Class & Section Selection Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Target Class *
                    </label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => {
                        setSelectedClassId(e.target.value);
                        const c = classes.find((cl) => cl.id === e.target.value);
                        if (c && c.sections?.length > 0) {
                          setSelectedSectionId(c.sections[0].id);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.75rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        outline: "none"
                      }}
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Target Section *
                    </label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.625rem 0.75rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        outline: "none"
                      }}
                    >
                      {sectionsList.map((sec: any) => (
                        <option key={sec.id} value={sec.id}>
                          Section {sec.name} ({sec._count?.enrollments || 0} enrolled)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Admission No & Roll No Sequence Preview */}
                <div style={{
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-subtle)",
                  padding: "1rem",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem"
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                      <Hash size={13} color="var(--brand-primary)" />
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                        CONTINUATION ADMISSION NO
                      </label>
                    </div>
                    <input
                      type="text"
                      value={admissionNumber}
                      onChange={(e) => setAdmissionNumber(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.65rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        outline: "none"
                      }}
                    />
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "0.25rem", display: "block" }}>
                      Auto-matched with school numbering sequence
                    </span>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                      <Users size={13} color="var(--brand-teal)" />
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                        SECTION ROLL NUMBER
                      </label>
                    </div>
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.65rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        outline: "none"
                      }}
                    />
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "0.25rem", display: "block" }}>
                      Next sequential seat in this section
                    </span>
                  </div>
                </div>

                {/* Info Note */}
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(99, 102, 241, 0.05)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)"
                }}>
                  <Sparkles size={16} color="var(--brand-primary)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                  <span>
                    Enrolling will automatically provision portal credentials, assign the continuation admission ID, register the student in the class timetable, and create active academic enrollments.
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <Button variant="ghost" onClick={onClose} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEnroll}
                    isLoading={submitting}
                    disabled={!selectedClassId || !selectedSectionId}
                    style={{
                      background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      fontWeight: 600
                    }}
                    leftIcon={<UserCheck size={16} />}
                  >
                    Confirm & Enroll Student
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
