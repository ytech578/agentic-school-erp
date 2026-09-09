"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateStudentSchema, CreateStudentInput } from "@school-erp/shared";
import { apiClient } from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StudentForm } from "@/components/forms/StudentForm";

export default function NewStudentPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateStudentSchema),
    defaultValues: {
      gender: "OTHER",
      bloodGroup: "UNKNOWN",
      nationality: "Indian",
      admissionDate: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.post("/students", data);
      router.push("/students");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to admit student");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "800px", margin: "0 auto", paddingBottom: "2rem" }}>
      <div>
        <h1 style={{ marginBottom: "0.25rem" }}>Admit New Student</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Fill in the details to register a new student to the school
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
