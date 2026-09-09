"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CollectFeeSchema } from "@school-erp/shared";
import { ArrowLeft, Save, IndianRupee } from "lucide-react";
import { formatCurrencyINR as formatCurrency } from "@/lib/formatters";

export default function CollectFeePage() {
  const { studentId } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const academicYearId = "AY2026-27"; // Hardcoded for MVP

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CollectFeeSchema),
    defaultValues: {
      studentId: studentId as string,
      academicYearId: academicYearId,
      amountPaid: 0,
      paymentMode: "CASH",
      transactionRef: "",
      remarks: "",
    },
  });

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const res = await apiClient.get(`/fees/students?academicYearId=${academicYearId}`);
        const allStudents = res.data.data || [];
        const found = allStudents.find((s: any) => s.id === studentId);
        
        if (found) {
          setStudent(found);
          setValue("amountPaid", found.outstandingDue);
        } else {
          setError("Student not found");
        }
      } catch (err) {
        setError("Failed to fetch student details");
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudent();
  }, [studentId, setValue]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/fees/collect", data);
      router.push("/fees");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMode = watch("paymentMode");

  if (isLoading) return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!student) return <div style={{ padding: "2rem", color: "var(--danger)" }}>{error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Button variant="ghost" onClick={() => router.back()} style={{ padding: "0.5rem" }}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Collect Fee</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Record a fee payment for {student.firstName} {student.lastName} ({student.admissionNumber})
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "var(--danger-50)", color: "var(--danger)", borderRadius: "var(--radius-md)", border: "1px solid var(--danger-100)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: "2rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", backgroundColor: "var(--bg-surface-hover)" }}>
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Total Fee</p>
          <p style={{ fontSize: "1.25rem", fontWeight: 600 }}>{formatCurrency(student.totalFee)}</p>
        </div>
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Paid Already</p>
          <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--success)" }}>{formatCurrency(student.totalPaid)}</p>
        </div>
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>Outstanding Due</p>
          <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--danger)" }}>{formatCurrency(student.outstandingDue)}</p>
        </div>
      </div>

      <div className="card" style={{ padding: "2rem" }}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <Input
              label="Amount to Pay *"
              type="number"
              {...register("amountPaid", { valueAsNumber: true })}
              error={errors.amountPaid?.message as string}
              min={1}
              max={student.outstandingDue}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Payment Mode *</label>
              <select 
                {...register("paymentMode")}
                style={{
                  width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                  fontSize: "0.875rem", color: "var(--text-primary)"
                }}
              >
                <option value="CASH">Cash</option>
                <option value="ONLINE">Online (UPI/Netbanking)</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DD">Demand Draft</option>
                <option value="CARD">Credit/Debit Card</option>
              </select>
              {errors.paymentMode?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.paymentMode.message as string}</span>}
            </div>
          </div>

          {(paymentMode === "ONLINE" || paymentMode === "CHEQUE" || paymentMode === "DD") && (
            <Input
              label="Transaction Ref / Cheque No. *"
              {...register("transactionRef")}
              error={errors.transactionRef?.message as string}
            />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Remarks (Optional)</label>
            <textarea
              {...register("remarks")}
              rows={3}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)", resize: "vertical"
              }}
              placeholder="e.g. Paid by father"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                alert(`Simulated: Payment link sent to Parent of ${student.firstName} via WhatsApp.`);
              }}
            >
              Simulate Payment Link (Razorpay)
            </Button>
            <div style={{ display: "flex", gap: "1rem" }}>
              <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting}>
                <IndianRupee size={16} style={{ marginRight: "0.5rem" }} />
                Record Payment
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
