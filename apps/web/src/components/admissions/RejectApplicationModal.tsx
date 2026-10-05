"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/axios";
import { AlertTriangle, XCircle, ShieldAlert } from "lucide-react";

interface RejectApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: {
    id: string;
    applicationNo: string;
    studentName: string;
    classApplied: string;
    parentName?: string;
  } | null;
  onSuccess: () => void;
}

const COMMON_REASONS = [
  "Seat capacity reached / No vacant seats available",
  "Did not meet age or academic prerequisite criteria",
  "Incomplete documentation / Verification not completed",
  "Applicant selected another institution / Parent withdrawn",
  "Entrance evaluation / Interview score below threshold",
  "Outside designated school transport / catchment zone",
];

export function RejectApplicationModal({
  isOpen,
  onClose,
  application,
  onSuccess,
}: RejectApplicationModalProps) {
  const [selectedReason, setSelectedReason] = useState(COMMON_REASONS[0]);
  const [customNotes, setCustomNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReject = async () => {
    if (!application?.id) return;
    setSubmitting(true);
    try {
      const fullReason = customNotes.trim()
        ? `${selectedReason}: ${customNotes.trim()}`
        : selectedReason;

      await apiClient.post(`/admissions/applications/${application.id}/reject`, {
        reason: fullReason,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to reject application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reject Admission Application"
      maxWidth="500px"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Warning Banner */}
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "1rem",
          borderRadius: "var(--radius-lg)",
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.25)"
        }}>
          <AlertTriangle size={20} color="var(--status-danger)" style={{ flexShrink: 0, marginTop: "0.15rem" }} />
          <div>
            <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
              Confirm Application Rejection
            </h4>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              Are you sure you want to mark application <strong>{application?.applicationNo}</strong> ({application?.studentName}) for <strong>{application?.classApplied}</strong> as Rejected?
            </p>
          </div>
        </div>

        {/* Reason Selector */}
        <div>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
            Primary Rejection Reason *
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
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
            {COMMON_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="Custom Reason">Custom Reason / Administrative Decision</option>
          </select>
        </div>

        {/* Custom Notes */}
        <div>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
            Internal Remarks / Notification Note (Optional)
          </label>
          <textarea
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            rows={3}
            placeholder="Add specific observations, committee notes, or feedback communicated to parent..."
            style={{
              width: "100%",
              padding: "0.625rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: "var(--text-sm)",
              outline: "none",
              resize: "vertical"
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            isLoading={submitting}
            style={{
              backgroundColor: "var(--status-danger)",
              borderColor: "var(--status-danger)",
              color: "#FFFFFF",
              fontWeight: 600
            }}
            leftIcon={<XCircle size={16} />}
          >
            Confirm Rejection
          </Button>
        </div>
      </div>
    </Modal>
  );
}
