"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateStaffSchema, CreateStaffInput } from "@school-erp/shared";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function StaffOnboardingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateStaffSchema),
    defaultValues: {
      role: "TEACHER",
      employmentType: "FULL_TIME",
      bloodGroup: "UNKNOWN",
    }
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [depRes, desRes] = await Promise.all([
          apiClient.get("/staff/departments"),
          apiClient.get("/staff/designations"),
        ]);
        setDepartments(depRes.data.data || []);
        setDesignations(desRes.data.data || []);
      } catch (err) {
        console.error("Failed to load departments/designations", err);
      }
    };
    fetchOptions();
  }, []);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/staff", data);
      router.push("/staff");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to onboard staff");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/staff" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Onboard Staff</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Register a new teacher or administrative staff member
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
          
          <section>
            <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Professional Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input
                label="Employee ID *"
                placeholder="e.g. EMP001"
                {...register("employeeId")}
                error={errors.employeeId?.message}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Role *</label>
                <select 
                  {...register("role")}
                  style={{
                    width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                    fontSize: "0.875rem", color: "var(--text-primary)"
                  }}
                >
                  <option value="TEACHER">Teacher</option>
                  <option value="SCHOOL_ADMIN">Admin</option>
                  <option value="PRINCIPAL">Principal</option>
                </select>
                {errors.role?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.role.message as string}</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Department *</label>
                <select 
                  {...register("departmentId")}
                  style={{
                    width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                    fontSize: "0.875rem", color: "var(--text-primary)"
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.departmentId?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.departmentId.message as string}</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Designation *</label>
                <select 
                  {...register("designationId")}
                  style={{
                    width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                    fontSize: "0.875rem", color: "var(--text-primary)"
                  }}
                >
                  <option value="">Select Designation</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.designationId?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.designationId.message as string}</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Employment Type *</label>
                <select 
                  {...register("employmentType")}
                  style={{
                    width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                    fontSize: "0.875rem", color: "var(--text-primary)"
                  }}
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="VISITING">Visiting</option>
                </select>
                {errors.employmentType?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.employmentType.message as string}</span>}
              </div>

              <Input
                label="Join Date *"
                type="date"
                {...register("joinDate")}
                error={errors.joinDate?.message}
              />
            </div>
          </section>

          <section>
            <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Personal Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input
                label="First Name *"
                placeholder="John"
                {...register("firstName")}
                error={errors.firstName?.message}
              />
              <Input
                label="Last Name *"
                placeholder="Doe"
                {...register("lastName")}
                error={errors.lastName?.message}
              />
              <Input
                label="Email *"
                type="email"
                placeholder="john.doe@school.edu.in"
                {...register("email")}
                error={errors.email?.message}
              />
              <Input
                label="Phone"
                placeholder="+91-9876543210"
                {...register("phone")}
                error={errors.phone?.message}
              />
            </div>
          </section>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem", borderTop: "1px solid var(--border-light)", paddingTop: "1.5rem" }}>
            <Button type="button" variant="ghost" onClick={() => router.push("/staff")}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <Save size={18} style={{ marginRight: "0.5rem" }} />
              Register Staff
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
