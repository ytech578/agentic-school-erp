"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateStaffSchema, UpdateStaffInput } from "@school-erp/shared";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { StaffForm } from "@/components/forms/StaffForm";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function StaffEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(UpdateStaffSchema),
    defaultValues: {
      role: "TEACHER",
      employmentType: "FULL_TIME",
      bloodGroup: "UNKNOWN",
    }
  });

  useEffect(() => {
    const fetchOptionsAndStaff = async () => {
      try {
        const [depRes, desRes, staffRes] = await Promise.all([
          apiClient.get("/staff/departments"),
          apiClient.get("/staff/designations"),
          apiClient.get(`/staff/${id}`),
        ]);
        setDepartments(depRes.data.data || []);
        setDesignations(desRes.data.data || []);
        
        const staffData = staffRes.data.data;
        if (staffData) {
          reset({
            firstName: staffData.user?.firstName || "",
            lastName: staffData.user?.lastName || "",
            email: staffData.user?.email || "",
            phone: staffData.user?.phone || "",
            role: staffData.user?.role || "TEACHER",
            employeeId: staffData.employeeId || "",
            departmentId: staffData.departmentId || "",
            designationId: staffData.designationId || "",
            employmentType: staffData.employmentType || "FULL_TIME",
            gender: staffData.gender || "MALE",
            bloodGroup: staffData.bloodGroup || "UNKNOWN",
            dateOfBirth: staffData.dateOfBirth ? new Date(staffData.dateOfBirth).toISOString().split('T')[0] : "",
            joinDate: staffData.joinDate ? new Date(staffData.joinDate).toISOString().split('T')[0] : "",
            address: staffData.address || "",
            aadhaarNumber: staffData.aadhaarNumber || "",
            panNumber: staffData.panNumber || "",
          });
        }
      } catch (err) {
        console.error("Failed to load staff details or options", err);
        setError("Failed to load staff details");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOptionsAndStaff();
  }, [id, reset]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.put(`/staff/${id}`, data);
      router.push(`/staff/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update staff");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href={`/staff/${id}`} style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Edit Staff Profile</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Update details for this staff member
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "var(--danger-50)", color: "var(--danger)", borderRadius: "var(--radius-md)", border: "1px solid var(--danger-100)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: "2rem" }}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          <StaffForm register={register} errors={errors} departments={departments} designations={designations} />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", borderTop: "1px solid var(--border-light)", paddingTop: "1.5rem" }}>
            <Button type="button" variant="secondary" onClick={() => router.push(`/staff/${id}`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save size={18} style={{ marginRight: "0.5rem" }} />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
