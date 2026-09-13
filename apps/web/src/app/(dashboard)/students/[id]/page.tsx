"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { 
  ArrowLeft, Edit, Mail, Phone, MapPin, Calendar, Users, 
  Droplet, User as UserIcon, ShieldAlert, CheckCircle2, UserCheck, UserX, Loader2 
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";

export default function StudentProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [student, setStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Status update state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<"ACTIVE" | "TRANSFERRED" | "DROPPED" | "GRADUATED">("TRANSFERRED");
  const [statusReason, setStatusReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchStudent = async () => {
    try {
      const response = await apiClient.get(`/students/${id}`);
      setStudent(response.data.data);
    } catch (error) {
      console.error("Failed to fetch student profile", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchStudent();
  }, [id]);

  const handleOpenStatusModal = () => {
    setStatusError(null);
    if (student?.isActive) {
      setTargetStatus("TRANSFERRED");
    } else {
      setTargetStatus("ACTIVE");
    }
    setStatusReason("");
    setIsStatusModalOpen(true);
  };

  const handleStatusSubmit = async () => {
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const willBeActive = targetStatus === "ACTIVE";
      await apiClient.patch(`/students/${id}/status`, {
        isActive: willBeActive,
        status: targetStatus,
        reason: statusReason.trim() || undefined,
      });
      await fetchStudent();
      setIsStatusModalOpen(false);
    } catch (err: any) {
      setStatusError(err.response?.data?.message || "Failed to update student status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return <div>Loading student profile...</div>;
  }

  if (!student) {
    return (
      <div>
        <h2>Student not found</h2>
        <Button onClick={() => router.push("/students")}>Back to Directory</Button>
      </div>
    );
  }

  const canManageStatus = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(currentUser?.role || '');
  const activeEnrollment = student.enrollments?.find((e: any) => e.status === 'ACTIVE') || student.enrollments?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Button variant="ghost" size="sm" onClick={() => router.push("/students")}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 style={{ marginBottom: "0.25rem" }}>
              {student.user.firstName} {student.user.lastName}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Admission No: {student.admissionNumber} | Roll No: {student.rollNumber || "N/A"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {canManageStatus && (
            <Button
              variant="outline"
              onClick={handleOpenStatusModal}
              style={{
                borderColor: student.isActive ? "var(--status-danger)40" : "var(--status-success)40",
                color: student.isActive ? "var(--status-danger)" : "var(--status-success)",
              }}
            >
              {student.isActive ? (
                <>
                  <UserX size={16} style={{ marginRight: "0.5rem" }} />
                  Deactivate / Transfer
                </>
              ) : (
                <>
                  <UserCheck size={16} style={{ marginRight: "0.5rem" }} />
                  Reactivate Student
                </>
              )}
            </Button>
          )}
          <Button variant="secondary" onClick={() => router.push(`/students/${id}/edit`)}>
            <Edit size={18} style={{ marginRight: "0.5rem" }} />
            Edit Profile
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
        {/* Left Column: Quick Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "var(--primary-100)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem", color: "var(--primary-600)" }}>
              {student.user.avatarUrl ? (
                <img src={student.user.avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <UserIcon size={40} />
              )}
            </div>
            <h3 style={{ marginBottom: "0.25rem" }}>{student.user.firstName} {student.user.lastName}</h3>
            
            {student.isActive ? (
              <span className="badge badge-success" style={{ marginBottom: "1.5rem" }}>
                Active Student ({activeEnrollment?.section?.class?.name} - {activeEnrollment?.section?.name})
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  marginBottom: "1.5rem",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                }}
              >
                Inactive &bull; {activeEnrollment?.status || 'Withdrawn'}
              </span>
            )}
            
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <Mail size={16} />
                <span>{student.user.email}</span>
              </div>
              {student.user.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  <Phone size={16} />
                  <span>{student.user.phone}</span>
                </div>
              )}
              {student.city && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  <MapPin size={16} />
                  <span>{student.city}{student.state ? `, ${student.state}` : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--border-light)" }}>
              Personal Details
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Date of Birth</p>
                <p style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Calendar size={16} /> {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Gender</p>
                <p style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Users size={16} /> {student.gender || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Blood Group</p>
                <p style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Droplet size={16} /> {student.bloodGroup}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Nationality</p>
                <p>{student.nationality}</p>
              </div>
            </div>
          </div>

          {student.guardians && student.guardians.length > 0 && (
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--border-light)" }}>
                Guardians
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {student.guardians.map((guardian: any) => (
                  <div key={guardian.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", backgroundColor: "var(--bg-main)", borderRadius: "var(--radius-md)" }}>
                    <div>
                      <p style={{ fontWeight: 500 }}>{guardian.firstName} {guardian.lastName}</p>
                      <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{guardian.relationship}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}><Phone size={14}/> {guardian.phone}</p>
                      {guardian.email && (
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}><Mail size={14}/> {guardian.email}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Student Status & Transfer Lifecycle Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={student.isActive ? "Deactivate or Transfer Student" : "Reactivate Student Account"}
        footer={
          <div style={{ display: "flex", gap: "0.75rem", width: "100%", justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => setIsStatusModalOpen(false)} disabled={isUpdatingStatus}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusSubmit}
              disabled={isUpdatingStatus}
              style={{
                background: targetStatus === "ACTIVE" ? "var(--status-success)" : "var(--status-danger)",
                color: "white",
                fontWeight: 600,
              }}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="spin" size={16} style={{ marginRight: "0.5rem" }} />
                  Saving Status...
                </>
              ) : targetStatus === "ACTIVE" ? (
                "Confirm Reactivation"
              ) : (
                "Confirm Status Update"
              )}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {statusError && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                background: "var(--risk-high-bg)",
                color: "var(--risk-high)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
              }}
            >
              {statusError}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Target Lifecycle Status
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as any)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
              }}
            >
              {student.isActive ? (
                <>
                  <option value="TRANSFERRED">Transferred (TC Issued to Another School)</option>
                  <option value="DROPPED">Dropped / Withdrawn</option>
                  <option value="GRADUATED">Graduated / Alumni</option>
                </>
              ) : (
                <option value="ACTIVE">Active (Re-admit & Restore Login Access)</option>
              )}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Reason or Reference Number (e.g. TC #1042 / Parental Relocation)
            </label>
            <textarea
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Enter official remarks or transfer certificate details..."
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          <div
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              background: "var(--bg-surface-hover)",
              border: "1px solid var(--border-default)",
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {targetStatus === "ACTIVE"
              ? "Reactivating this student will restore their portal login privileges and mark their latest enrollment as active."
              : "Updating status will revoke the student's active login access and update their enrollment records accordingly for institutional auditing."}
          </div>
        </div>
      </Modal>
    </div>
  );
}
