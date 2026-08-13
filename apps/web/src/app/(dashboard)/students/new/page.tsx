"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateStudentSchema, CreateStudentInput } from "@school-erp/shared";
import { apiClient } from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
          
          {/* Academic Details Section */}
          <section>
            <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Academic Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input
                label="Admission Number"
                {...register("admissionNumber")}
                error={errors.admissionNumber?.message}
                required
              />
              <Input
                label="Roll Number"
                {...register("rollNumber")}
                error={errors.rollNumber?.message}
              />
              <Input
                label="Admission Date"
                type="date"
                {...register("admissionDate")}
                error={errors.admissionDate?.message}
              />
              <Input
                label="Previous School"
                {...register("previousSchool")}
                error={errors.previousSchool?.message}
              />
            </div>
          </section>

          {/* Personal Details Section */}
          <section>
            <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Personal Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input
                label="First Name"
                {...register("firstName")}
                error={errors.firstName?.message}
                required
              />
              <Input
                label="Last Name"
                {...register("lastName")}
                error={errors.lastName?.message}
                required
              />
              <Input
                label="Student Email"
                type="email"
                {...register("email")}
                error={errors.email?.message}
                required
              />
              <Input
                label="Student Phone"
                {...register("phone")}
                error={errors.phone?.message}
              />
              <Input
                label="Date of Birth"
                type="date"
                {...register("dateOfBirth")}
                error={errors.dateOfBirth?.message}
              />
              
              <div className="input-container">
                <label className="input-label">Gender</label>
                <select className="input-field" {...register("gender")} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
                {errors.gender && <span className="input-error">{errors.gender.message}</span>}
              </div>

              <div className="input-container">
                <label className="input-label">Blood Group</label>
                <select className="input-field" {...register("bloodGroup")} style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                  <option value="UNKNOWN">Unknown</option>
                  <option value="A_POS">A+</option>
                  <option value="A_NEG">A-</option>
                  <option value="B_POS">B+</option>
                  <option value="B_NEG">B-</option>
                  <option value="O_POS">O+</option>
                  <option value="O_NEG">O-</option>
                  <option value="AB_POS">AB+</option>
                  <option value="AB_NEG">AB-</option>
                </select>
              </div>

              <Input
                label="Nationality"
                {...register("nationality")}
                error={errors.nationality?.message}
              />
            </div>
          </section>

          {/* Primary Guardian Section */}
          <section>
            <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Primary Guardian</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Input
                label="First Name"
                {...register("guardianFirstName")}
                error={errors.guardianFirstName?.message}
              />
              <Input
                label="Last Name"
                {...register("guardianLastName")}
                error={errors.guardianLastName?.message}
              />
              <Input
                label="Relationship"
                {...register("guardianRelationship")}
                placeholder="e.g. Father, Mother"
                error={errors.guardianRelationship?.message}
              />
              <Input
                label="Phone Number"
                {...register("guardianPhone")}
                error={errors.guardianPhone?.message}
              />
              <Input
                label="Email"
                type="email"
                {...register("guardianEmail")}
                error={errors.guardianEmail?.message}
              />
            </div>
          </section>

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
