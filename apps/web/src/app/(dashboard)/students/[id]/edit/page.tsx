"use client";

import { useState, useEffect, use } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateStudentSchema, CreateStudentInput } from "@school-erp/shared";
import { apiClient } from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StudentForm } from "@/components/forms/StudentForm";

export default function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(UpdateStudentSchema),
    defaultValues: {
      gender: "OTHER",
      bloodGroup: "UNKNOWN",
      nationality: "Indian",
      admissionDate: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (data: any) => {
    if (data.email === "") delete data.email;
    if (data.phone === "") delete data.phone;

    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.put(`/students/${id}`, data);
      router.push(`/students/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update student");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const res = await apiClient.get(`/students/${id}`);
        const s = res.data.data;
        if (s) {
          reset({
            firstName: s.user?.firstName || "",
            lastName: s.user?.lastName || "",
            email: s.user?.email || "",
            phone: s.user?.phone || "",
            admissionNumber: s.admissionNumber || "",
            rollNumber: s.rollNumber || "",
            gender: s.gender || "OTHER",
            bloodGroup: s.bloodGroup || "UNKNOWN",
            nationality: s.nationality || "Indian",
            admissionDate: s.admissionDate ? s.admissionDate.split('T')[0] : "",
            dateOfBirth: s.dateOfBirth ? s.dateOfBirth.split('T')[0] : "",
            religion: s.religion || "",
            caste: s.caste || "",
            aadhaarNumber: s.aadhaarNumber || "",
            address: s.address || "",
            city: s.city || "",
            state: s.state || "",
            pinCode: s.pinCode || "",
            medicalNotes: s.medicalNotes || "",
            previousSchool: s.previousSchool || "",
            guardianFirstName: s.guardians?.[0]?.firstName || "",
            guardianLastName: s.guardians?.[0]?.lastName || "",
            guardianRelationship: s.guardians?.[0]?.relationship || "",
            guardianPhone: s.guardians?.[0]?.phone || "",
            guardianEmail: s.guardians?.[0]?.email || "",
          });
        }
      } catch (err) {
        setError("Failed to load student details");
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudent();
  }, [id, reset]);

  if (isLoading) return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "800px", margin: "0 auto", paddingBottom: "2rem" }}>
      <div>
        <h1 style={{ marginBottom: "0.25rem" }}>Edit Student Profile</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Update student details
        </p>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "var(--danger-50)", color: "var(--danger)", borderRadius: "var(--radius-md)", border: "1px solid var(--danger-100)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: "2rem" }}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          <StudentForm register={register} errors={errors} />


          <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Admitting..." : "Admit Student"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
