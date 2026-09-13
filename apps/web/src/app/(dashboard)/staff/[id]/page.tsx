"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { 
  ArrowLeft, Edit, Mail, Phone, MapPin, Briefcase, 
  UserCheck, UserX, Loader2, AlertCircle 
} from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/store/auth.store";

export default function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { user: currentUser } = useAuthStore();
  
  const [staff, setStaff] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Status management state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [resignDate, setResignDate] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchStaffDetails = async () => {
    try {
      const response = await apiClient.get(`/staff/${id}`);
      setStaff(response.data.data);
    } catch (error) {
      console.error("Failed to load staff details", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffDetails();
  }, [id]);

  const handleOpenStatusModal = () => {
    setStatusError(null);
    setStatusReason("");
    setResignDate(new Date().toISOString().split("T")[0]);
    setIsStatusModalOpen(true);
  };

  const handleStatusSubmit = async () => {
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const willBeActive = !staff.isActive;
      await apiClient.patch(`/staff/${id}/status`, {
        isActive: willBeActive,
        resignDate: willBeActive ? undefined : (resignDate ? new Date(resignDate).toISOString() : new Date().toISOString()),
        reason: statusReason.trim() || undefined,
      });
      await fetchStaffDetails();
      setIsStatusModalOpen(false);
    } catch (err: any) {
      setStatusError(err.response?.data?.message || "Failed to update staff status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading profile...</div>;
  }

  if (!staff) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2 style={{ marginBottom: "1rem" }}>Staff not found</h2>
        <Button onClick={() => router.push("/staff")}>Back to Directory</Button>
      </div>
    );
  }

  const canManageStatus = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(currentUser?.role || '');

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1000px", margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/staff" style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft size={20} />
          </Link>
          <h1 style={{ marginBottom: 0 }}>Staff Profile</h1>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {canManageStatus && (
            <Button
              variant="outline"
              onClick={handleOpenStatusModal}
              style={{
                borderColor: staff.isActive ? "var(--status-danger)40" : "var(--status-success)40",
                color: staff.isActive ? "var(--status-danger)" : "var(--status-success)",
              }}
            >
              {staff.isActive ? (
                <>
                  <UserX size={16} style={{ marginRight: "0.5rem" }} />
                  Deactivate / Relieve Staff
                </>
              ) : (
                <>
                  <UserCheck size={16} style={{ marginRight: "0.5rem" }} />
                  Reactivate Staff
                </>
              )}
            </Button>
          )}
          <Button variant="secondary" onClick={() => router.push(`/staff/${id}/edit`)}>
            <Edit size={16} style={{ marginRight: "0.5rem" }} />
            Edit Profile
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
        
        {/* Left Column: Quick Info */}
        <div className="card" style={{ padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1rem" }}>
          <div style={{ 
            width: "120px", height: "120px", borderRadius: "50%", 
            backgroundColor: "var(--primary-100)", color: "var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "3rem", fontWeight: "bold"
          }}>
            {staff.user?.firstName?.[0]}{staff.user?.lastName?.[0]}
          </div>
          
          <div>
            <h2 style={{ marginBottom: "0.25rem" }}>{staff.user?.firstName} {staff.user?.lastName}</h2>
            <div style={{ 
              display: "inline-block", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)", 
              backgroundColor: "var(--primary-50)", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600,
              marginTop: "0.5rem"
            }}>
              {staff.user?.role}
            </div>
          </div>

          <div style={{ width: "100%", height: "1px", backgroundColor: "var(--border-light)", margin: "1rem 0" }} />

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              <Briefcase size={16} />
              <span>EMP ID: {staff.employeeId}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              <Mail size={16} />
              <span>{staff.user?.email}</span>
            </div>
            {staff.user?.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <Phone size={16} />
                <span>{staff.user.phone}</span>
              </div>
            )}
            {staff.address && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <MapPin size={16} />
                <span>{staff.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <div className="card" style={{ padding: "2rem" }}>
            <h3 style={{ marginBottom: "1.5rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.75rem" }}>Employment Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Department</p>
                <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>{staff.department?.name || "N/A"}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Designation</p>
                <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>{staff.designation?.name || "N/A"}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Employment Type</p>
                <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>{staff.employmentType.replace('_', ' ')}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Join Date</p>
                <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>{new Date(staff.joinDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: "2rem" }}>
            <h3 style={{ marginBottom: "1.5rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.75rem" }}>Personal Information</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Gender</p>
                <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>{staff.gender || "N/A"}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Blood Group</p>
                <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>{staff.bloodGroup?.replace('_', ' ') || "N/A"}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Date of Birth</p>
                <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>{staff.dateOfBirth ? new Date(staff.dateOfBirth).toLocaleDateString() : "N/A"}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Status</p>
                <p style={{ fontWeight: 600, color: staff.isActive ? "var(--success)" : "var(--status-danger)" }}>
                  {staff.isActive ? "Active" : `Inactive (Relieved ${staff.resignDate ? new Date(staff.resignDate).toLocaleDateString() : ''})`}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Staff Status & Relieving Lifecycle Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={staff.isActive ? "Deactivate / Relieve Staff Member" : "Reactivate Staff Member"}
        footer={
          <div style={{ display: "flex", gap: "0.75rem", width: "100%", justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => setIsStatusModalOpen(false)} disabled={isUpdatingStatus}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusSubmit}
              disabled={isUpdatingStatus}
              style={{
                background: staff.isActive ? "var(--status-danger)" : "var(--status-success)",
                color: "white",
                fontWeight: 600,
              }}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="spin" size={16} style={{ marginRight: "0.5rem" }} />
                  Updating...
                </>
              ) : staff.isActive ? (
                "Confirm Relieving & Deactivation"
              ) : (
                "Confirm Reactivation"
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

          {staff.isActive && (
            <div>
              <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
                Relieving / Resignation Date
              </label>
              <input
                type="date"
                value={resignDate}
                onChange={(e) => setResignDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.35rem" }}>
              Reason or Reference Notes
            </label>
            <textarea
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Formal resignation accepted, retirement, or transfer..."
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
            {staff.isActive
              ? "Relieving this staff member will revoke their portal access, mark their profile as inactive, and record their resignation timestamp for institutional HR records."
              : "Reactivating this staff member will re-enable their portal login and mark their institutional profile as active."}
          </div>
        </div>
      </Modal>
    </div>
  );
}
