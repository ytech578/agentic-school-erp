"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Edit, Mail, Phone, MapPin, Calendar, Users, Droplet, User as UserIcon } from "lucide-react";

export default function StudentProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
    if (id) fetchStudent();
  }, [id]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
        <Button variant="secondary" onClick={() => router.push(`/students/${id}/edit`)}>
          <Edit size={18} style={{ marginRight: "0.5rem" }} />
          Edit Profile
        </Button>
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
            <span className="badge badge-success" style={{ marginBottom: "1.5rem" }}>Active Student</span>
            
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
    </div>
  );
}
