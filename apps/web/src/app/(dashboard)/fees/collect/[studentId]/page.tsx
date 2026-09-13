"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CollectFeeSchema } from "@school-erp/shared";
import { ArrowLeft, Save, IndianRupee, QrCode, ExternalLink, CheckCircle2, Copy, X, CreditCard, Smartphone, ShieldCheck, RefreshCw, Building2, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { formatCurrencyINR as formatCurrency } from "@/lib/formatters";

export default function CollectFeePage() {
  const { studentId } = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"DYNAMIC_QR" | "BANK_QR" | "BANK_DETAILS">("DYNAMIC_QR");
  const [isVerifyingOrder, setIsVerifyingOrder] = useState(false);
  const [customTxRef, setCustomTxRef] = useState("");
  const [qrLoaded, setQrLoaded] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);

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
      academicYearId: "",
      amountPaid: 0,
      paymentMode: "CASH",
      transactionRef: "",
      remarks: "",
    },
  });

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const [studentsRes, yearsRes] = await Promise.all([
          apiClient.get("/fees/students"),
          apiClient.get("/schools/academic-years"),
        ]);
        const allStudents = studentsRes.data?.data || studentsRes.data || [];
        const found = allStudents.find((s: any) => s.id === studentId);
        
        const years = yearsRes.data?.data || yearsRes.data || [];
        const activeYear = years.find((y: any) => y.isActive) || years[0];
        if (activeYear) {
          setValue("academicYearId", activeYear.id);
        }

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

  const loadRazorpayCheckout = () => {
    return new Promise<boolean>((resolve) => {
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        return resolve(true);
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleVerifyPayment = async (
    orderId: string,
    paymentId: string,
    signature: string = "simulated_valid_sig"
  ) => {
    setIsVerifyingOrder(true);
    try {
      const res = await apiClient.post("/fees/orders/verify", {
        orderId,
        paymentId: paymentId || `pay_${Date.now().toString().slice(-8)}`,
        signature,
        studentId: studentId as string,
        amount: createdOrder.amount,
        academicYearId: student?.academicYearId,
        remarks: `Online Payment via Razorpay / UPI QR (${orderId})`,
      });
      const receiptNum = res.data?.data?.receipt?.receiptNumber || res.data?.receipt?.receiptNumber || "RCT-GENERATED";
      setSuccessReceipt(receiptNum);
    } catch (err: any) {
      alert(err.response?.data?.message || "Payment verification failed");
    } finally {
      setIsVerifyingOrder(false);
    }
  };

  const handleRazorpayCheckout = async () => {
    if (!createdOrder) return;
    const loaded = await loadRazorpayCheckout();
    if (!loaded) {
      alert("Failed to load Razorpay checkout. Please scan the QR code to pay.");
      return;
    }

    const options = {
      key: createdOrder.keyId || "rzp_test_placeholder_key",
      amount: createdOrder.amountInPaise || Math.round(createdOrder.amount * 100),
      currency: createdOrder.currency || "INR",
      name: createdOrder.schoolName || "School ERP",
      description: `Fee Collection for ${createdOrder.student?.name || "Student"}`,
      order_id: createdOrder.orderId?.startsWith("order_") && !createdOrder.orderId?.includes("placeholder") ? createdOrder.orderId : undefined,
      handler: async function (response: any) {
        await handleVerifyPayment(
          response.razorpay_order_id || createdOrder.orderId,
          response.razorpay_payment_id || `pay_${Date.now().toString().slice(-8)}`,
          response.razorpay_signature || "simulated_valid_sig"
        );
      },
      prefill: {
        name: createdOrder.student?.name,
        email: createdOrder.student?.email,
      },
      theme: {
        color: "#2563eb",
      },
      modal: {
        ondismiss: function () {
          console.log("Razorpay checkout modal dismissed");
        },
      },
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Razorpay open error", err);
      alert("Razorpay checkout popup could not be opened. You can scan the UPI QR code directly.");
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
                <option value="ONLINE_UPI">Online (UPI / QR / Razorpay)</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DEMAND_DRAFT">Demand Draft (DD)</option>
                <option value="NEFT">NEFT Transfer</option>
                <option value="RTGS">RTGS Transfer</option>
              </select>
              {errors.paymentMode?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.paymentMode.message as string}</span>}
            </div>
          </div>

          {paymentMode !== "CASH" && (
            <Input
              label="Transaction Ref / Cheque / UTR No. *"
              {...register("transactionRef")}
              error={errors.transactionRef?.message as string}
              placeholder="e.g. UPI Ref / UTR / Cheque No. / DD No."
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
              placeholder="e.g. Paid by father via counter QR"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
            <Button 
              type="button" 
              variant="outline" 
              isLoading={isGeneratingOrder}
              onClick={async () => {
                const amount = Number(watch("amountPaid"));
                if (!amount || amount <= 0) {
                  alert("Please enter a valid amount before generating a payment QR.");
                  return;
                }
                setIsGeneratingOrder(true);
                setSuccessReceipt(null);
                setCustomTxRef("");
                try {
                  const res = await apiClient.post("/fees/orders/create", {
                    studentId: studentId as string,
                    amount,
                    academicYearId: student?.academicYearId,
                  });
                  const order = res.data?.data || res.data;
                  setCreatedOrder(order);
                  setOrderModalOpen(true);
                } catch (err: any) {
                  alert(err.response?.data?.message || "Failed to generate Razorpay order");
                } finally {
                  setIsGeneratingOrder(false);
                }
              }}
            >
              <QrCode size={16} style={{ marginRight: "0.5rem" }} />
              Generate Razorpay Order & UPI QR
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

        {/* Razorpay UPI & Payment Link Modal */}
        {orderModalOpen && createdOrder && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}>
            <div style={{
              background: "var(--bg-surface)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-xl)",
              width: "100%",
              maxWidth: "480px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.75rem",
              position: "relative",
            }}>
              <button
                onClick={() => {
                  setOrderModalOpen(false);
                  if (successReceipt) router.push("/fees");
                }}
                style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
              >
                <X size={20} />
              </button>

              {successReceipt ? (
                /* Payment Success View */
                <div style={{ textAlign: "center", padding: "1rem 0" }}>
                  <div style={{
                    width: "64px",
                    height: "64px",
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "var(--success, #10b981)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1.25rem",
                  }}>
                    <CheckCircle2 size={38} />
                  </div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 700 }}>
                    Payment Verified Successfully!
                  </h3>
                  <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    The transaction has been reconciled and recorded in the system.
                  </p>

                  <div style={{
                    background: "var(--bg-surface-hover)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1rem",
                    marginBottom: "1.5rem",
                    border: "1px solid var(--border-default)",
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                      Sequential Receipt Number
                    </span>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary-600, #2563eb)", marginTop: "0.25rem" }}>
                      {successReceipt}
                    </div>
                    <div style={{ fontSize: "0.813rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      Amount: {formatCurrency(createdOrder.amount)} • Student: {createdOrder.student?.name}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <Button
                      variant="outline"
                      onClick={() => window.print()}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      Print Receipt
                    </Button>
                    <Button
                      onClick={() => {
                        setOrderModalOpen(false);
                        router.push("/fees");
                      }}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      Done & View Fees
                    </Button>
                  </div>
                </div>
              ) : (
                /* Active Payment / Multi-Option Gateway View */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
                    <div style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--primary-600)", padding: "0.5rem", borderRadius: "var(--radius-md)" }}>
                      <QrCode size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>Fee Collection & Payment Gateway</h3>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                        {createdOrder.schoolName} • Order ID: {createdOrder.orderId}
                      </p>
                    </div>
                  </div>

                  {/* Warning banner if authentic school VPA is not configured */}
                  {!createdOrder.isCustomVpa && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.5rem 0.75rem",
                      background: "#fffbeb",
                      border: "1px solid #fef3c7",
                      borderRadius: "var(--radius-md)",
                      marginBottom: "0.75rem",
                      fontSize: "0.75rem",
                      color: "#92400e"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0, color: "#d97706" }} />
                        <span>Default UPI VPA in use. Configure school VPA & Bank QR.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.open("/fees/settings", "_blank")}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#2563eb",
                          fontWeight: 700,
                          cursor: "pointer",
                          textDecoration: "underline",
                          fontSize: "0.75rem",
                          whiteSpace: "nowrap"
                        }}
                      >
                        Settings &rarr;
                      </button>
                    </div>
                  )}

                  {/* Optional School Management Custom Instruction */}
                  {createdOrder.instructions && (
                    <div style={{
                      padding: "0.4rem 0.75rem",
                      background: "rgba(59, 130, 246, 0.08)",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                      borderRadius: "var(--radius-md)",
                      marginBottom: "0.75rem",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)"
                    }}>
                      <strong style={{ color: "var(--text-primary)" }}>Note:</strong> {createdOrder.instructions}
                    </div>
                  )}

                  {/* Amount Summary */}
                  <div style={{
                    background: "var(--bg-surface-hover)",
                    borderRadius: "var(--radius-lg)",
                    padding: "0.75rem 1rem",
                    textAlign: "center",
                    marginBottom: "0.875rem",
                    border: "1px solid var(--border-default)",
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Amount Due</span>
                    <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.1rem" }}>
                      {formatCurrency(createdOrder.amount)}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Student: {createdOrder.student?.name} {createdOrder.student?.admissionNumber ? `(${createdOrder.student.admissionNumber})` : ""}
                    </span>
                  </div>

                  {/* Gateway Mode Tab Selector */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "0.375rem",
                    background: "var(--bg-surface-hover)",
                    padding: "0.25rem",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "0.875rem",
                  }}>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab("DYNAMIC_QR")}
                      style={{
                        padding: "0.4rem 0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.25rem",
                        background: activeModalTab === "DYNAMIC_QR" ? "#ffffff" : "transparent",
                        color: activeModalTab === "DYNAMIC_QR" ? "#1e293b" : "var(--text-secondary)",
                        boxShadow: activeModalTab === "DYNAMIC_QR" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      <QrCode size={13} />
                      <span>Dynamic QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModalTab("BANK_QR")}
                      style={{
                        padding: "0.4rem 0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.25rem",
                        background: activeModalTab === "BANK_QR" ? "#ffffff" : "transparent",
                        color: activeModalTab === "BANK_QR" ? "#1e293b" : "var(--text-secondary)",
                        boxShadow: activeModalTab === "BANK_QR" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      <ImageIcon size={13} />
                      <span>Official Bank QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModalTab("BANK_DETAILS")}
                      style={{
                        padding: "0.4rem 0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: "var(--radius-sm)",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.25rem",
                        background: activeModalTab === "BANK_DETAILS" ? "#ffffff" : "transparent",
                        color: activeModalTab === "BANK_DETAILS" ? "#1e293b" : "var(--text-secondary)",
                        boxShadow: activeModalTab === "BANK_DETAILS" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      <Building2 size={13} />
                      <span>Bank NEFT</span>
                    </button>
                  </div>

                  {/* Tab 1: Dynamic Amount QR */}
                  {activeModalTab === "DYNAMIC_QR" && (
                    <div style={{
                      background: "#ffffff",
                      borderRadius: "var(--radius-lg)",
                      padding: "0.875rem",
                      textAlign: "center",
                      border: "1px solid #e2e8f0",
                      marginBottom: "0.875rem",
                    }}>
                      <div style={{ fontSize: "0.813rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.4rem" }}>
                        NPCI UPI Dynamic QR (Auto-Amount Encoded)
                      </div>
                      
                      <div style={{
                        display: "inline-block",
                        padding: "6px",
                        background: "#ffffff",
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                      }}>
                        <img
                          src={createdOrder.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(createdOrder.upiUri || `upi://pay?pa=${createdOrder.upiVpa || 'schoolfees@razorpay'}&pn=${encodeURIComponent(createdOrder.schoolName || 'School ERP')}&am=${createdOrder.amount}&cu=INR`)}`}
                          alt="UPI Payment QR Code"
                          style={{ width: "180px", height: "180px", display: "block" }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "center", gap: "0.35rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                        {["GPay", "PhonePe", "Paytm", "BHIM", "Cred"].map((app) => (
                          <span key={app} style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", background: "#f1f5f9", borderRadius: "10px", color: "#475569", fontWeight: 500 }}>
                            {app}
                          </span>
                        ))}
                      </div>

                      {/* UPI VPA Display & Copy */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "var(--radius-md)",
                        padding: "0.35rem 0.65rem",
                        marginTop: "0.6rem",
                      }}>
                        <div style={{ textAlign: "left" }}>
                          <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>School UPI ID (VPA)</span>
                          <span style={{ fontSize: "0.813rem", fontWeight: 600, color: "#0f172a" }}>
                            {createdOrder.upiVpa || "schoolfees@razorpay"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(createdOrder.upiVpa || "schoolfees@razorpay");
                            setCopiedVpa(true);
                            setTimeout(() => setCopiedVpa(false), 2000);
                          }}
                          style={{ padding: "0.2rem 0.45rem", height: "auto", fontSize: "0.75rem" }}
                        >
                          {copiedVpa ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
                          <span style={{ marginLeft: "0.2rem" }}>{copiedVpa ? "Copied" : "Copy"}</span>
                        </Button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.6rem" }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (createdOrder.upiUri) {
                              window.location.href = createdOrder.upiUri;
                            }
                          }}
                          style={{ width: "100%", justifyContent: "center", fontSize: "0.75rem" }}
                        >
                          <Smartphone size={13} style={{ marginRight: "0.3rem" }} />
                          Open UPI App
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const plUrl = `https://pages.razorpay.com/pl_${createdOrder.orderId}`;
                            navigator.clipboard.writeText(plUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          style={{ width: "100%", justifyContent: "center", fontSize: "0.75rem" }}
                        >
                          {copiedLink ? <CheckCircle2 size={13} style={{ marginRight: "0.3rem", color: "var(--success)" }} /> : <Copy size={13} style={{ marginRight: "0.3rem" }} />}
                          {copiedLink ? "Link Copied!" : "Copy Pay Link"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Uploaded Official Bank QR Code */}
                  {activeModalTab === "BANK_QR" && (
                    <div style={{
                      background: "#ffffff",
                      borderRadius: "var(--radius-lg)",
                      padding: "1rem",
                      textAlign: "center",
                      border: "1px solid #e2e8f0",
                      marginBottom: "0.875rem",
                    }}>
                      <div style={{ fontSize: "0.813rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.5rem" }}>
                        School Bank / Counter QR Code
                      </div>
                      {createdOrder.uploadedQrImageUrl ? (
                        <>
                          <div style={{
                            display: "inline-block",
                            padding: "6px",
                            background: "#ffffff",
                            borderRadius: "10px",
                            border: "1px solid #cbd5e1",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                          }}>
                            <img
                              src={createdOrder.uploadedQrImageUrl}
                              alt="Official Bank QR Code"
                              style={{ width: "190px", height: "190px", objectFit: "contain", display: "block" }}
                            />
                          </div>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.5rem 0 0" }}>
                            Scan this bank-issued counter QR code with any UPI app. Ensure you enter <strong>{formatCurrency(createdOrder.amount)}</strong> during checkout.
                          </p>
                        </>
                      ) : (
                        <div style={{ padding: "1.5rem 0.5rem" }}>
                          <ImageIcon size={36} style={{ color: "#94a3b8", margin: "0 auto 0.75rem" }} />
                          <p style={{ fontSize: "0.813rem", fontWeight: 600, color: "#334155", margin: 0 }}>
                            No Official Bank QR Uploaded
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 1rem" }}>
                            School Admin or Principal can upload the school's bank counter QR (e.g. HDFC/ICICI/SBI) in Payment Options.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open("/fees/settings", "_blank")}
                          >
                            Upload Bank QR in Settings &rarr;
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Institutional Bank Account Details (NEFT/RTGS/IMPS) */}
                  {activeModalTab === "BANK_DETAILS" && (
                    <div style={{
                      background: "#ffffff",
                      borderRadius: "var(--radius-lg)",
                      padding: "1rem",
                      border: "1px solid #e2e8f0",
                      marginBottom: "0.875rem",
                    }}>
                      <div style={{ fontSize: "0.813rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.75rem", textAlign: "center" }}>
                        Institutional Bank Transfer (NEFT / RTGS / IMPS)
                      </div>

                      {createdOrder.bankDetails?.accountNumber ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.6rem", background: "#f8fafc", borderRadius: "6px" }}>
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Account Holder</span>
                            <span style={{ fontSize: "0.813rem", fontWeight: 600, color: "#0f172a" }}>
                              {createdOrder.bankDetails.accountHolder || createdOrder.schoolName}
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.6rem", background: "#f8fafc", borderRadius: "6px" }}>
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Bank Name</span>
                            <span style={{ fontSize: "0.813rem", fontWeight: 600, color: "#0f172a" }}>
                              {createdOrder.bankDetails.bankName || "Not configured"}
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.6rem", background: "#f8fafc", borderRadius: "6px" }}>
                            <div>
                              <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>Account Number</span>
                              <span style={{ fontSize: "0.813rem", fontWeight: 700, color: "#0f172a", letterSpacing: "0.05em" }}>
                                {createdOrder.bankDetails.accountNumber}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(createdOrder.bankDetails.accountNumber);
                                setCopiedBankField("acc");
                                setTimeout(() => setCopiedBankField(null), 2000);
                              }}
                              style={{ padding: "0.2rem 0.5rem", height: "auto", fontSize: "0.75rem" }}
                            >
                              {copiedBankField === "acc" ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
                              <span style={{ marginLeft: "0.25rem" }}>{copiedBankField === "acc" ? "Copied" : "Copy"}</span>
                            </Button>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.6rem", background: "#f8fafc", borderRadius: "6px" }}>
                            <div>
                              <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>IFSC Code</span>
                              <span style={{ fontSize: "0.813rem", fontWeight: 700, color: "#0f172a" }}>
                                {createdOrder.bankDetails.ifscCode}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(createdOrder.bankDetails.ifscCode);
                                setCopiedBankField("ifsc");
                                setTimeout(() => setCopiedBankField(null), 2000);
                              }}
                              style={{ padding: "0.2rem 0.5rem", height: "auto", fontSize: "0.75rem" }}
                            >
                              {copiedBankField === "ifsc" ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
                              <span style={{ marginLeft: "0.25rem" }}>{copiedBankField === "ifsc" ? "Copied" : "Copy"}</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: "1.25rem 0.5rem" }}>
                          <Building2 size={36} style={{ color: "#94a3b8", margin: "0 auto 0.75rem" }} />
                          <p style={{ fontSize: "0.813rem", fontWeight: 600, color: "#334155", margin: 0 }}>
                            No Bank Account Details Configured
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 1rem" }}>
                            Configure your school institutional bank account for direct NEFT/RTGS collections.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open("/fees/settings", "_blank")}
                          >
                            Configure Bank Account in Settings &rarr;
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enterprise Razorpay Gateway Checkout & Link Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleRazorpayCheckout}
                      style={{ width: "100%", justifyContent: "center", padding: "0.6rem" }}
                    >
                      <CreditCard size={15} style={{ marginRight: "0.5rem" }} />
                      Pay with Razorpay Checkout (Cards / NetBanking)
                    </Button>

                    {/* Counter Verification & Reconciliation Section */}
                    <div style={{
                      marginTop: "0.35rem",
                      paddingTop: "0.65rem",
                      borderTop: "1px solid var(--border-default)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                          Counter Confirmation / UTR Reference No.
                        </label>
                        <input
                          type="text"
                          value={customTxRef}
                          onChange={(e) => setCustomTxRef(e.target.value)}
                          placeholder="e.g. 12-digit UPI UTR / Bank Transfer Ref"
                          style={{
                            width: "100%",
                            padding: "0.45rem 0.65rem",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--secondary-400)",
                            backgroundColor: "var(--bg-surface)",
                            fontSize: "0.813rem",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>

                      <Button
                        type="button"
                        isLoading={isVerifyingOrder}
                        onClick={() => handleVerifyPayment(createdOrder.orderId, customTxRef)}
                        style={{ width: "100%", justifyContent: "center", background: "#059669", color: "#ffffff", padding: "0.6rem" }}
                      >
                        <ShieldCheck size={15} style={{ marginRight: "0.4rem" }} />
                        Confirm & Reconcile Payment
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
