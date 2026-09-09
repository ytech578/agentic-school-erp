"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateStaffSchema, CreateStaffInput } from "@school-erp/shared";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { StaffForm } from "@/components/forms/StaffForm";
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
          
          <StaffForm register={register} errors={errors} departments={departments} designations={designations} />

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
