"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import {
  IndianRupee,
  ShieldCheck,
  CreditCard as CardIcon,
  Loader2,
  Info,
  QrCode,
  Copy,
  CheckCircle2,
  Smartphone,
  Image as ImageIcon,
  Building2,
  Globe,
  Lock,
  ArrowRight,
  Printer,
  Sparkles,
  AlertCircle,
  X,
  BadgeCheck
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrencyINR as formatCurrency } from "@/lib/formatters";

type PaymentMethodType = "ONLINE_UPI" | "BANK_QR" | "ONLINE_CARD" | "NETBANKING" | "BANK_TRANSFER";

export default function ParentFeesPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    student: any;
    amount: number;
    method: PaymentMethodType;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);
  const [receiptDetails, setReceiptDetails] = useState<any>(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [parentUtr, setParentUtr] = useState("");
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const fetchReceiptDetails = async (receiptNum: string) => {
    setIsLoadingReceipt(true);
    try {
      const res = await apiClient.get(`/fees/receipts/${receiptNum}`);
      setReceiptDetails(res.data?.data || res.data);
    } catch (e) {
      console.error("Failed to load formal receipt details", e);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  useEffect(() => {
    if (user?.role && user.role !== "PARENT") {
      if (["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(user.role)) {
        router.replace("/fees");
      } else {
        router.replace("/dashboard");
      }
      return;
    }
    fetchDues();
    fetchPaymentSettings();
  }, [user, router]);

  const fetchPaymentSettings = async () => {
    try {
      const res = await apiClient.get("/fees/settings/payment");
      const settings = res.data?.data || res.data || null;
      setPaymentSettings(settings);
    } catch (e) {
      console.error("Failed to load school payment options", e);
    }
  };

  const fetchDues = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/fees/parent/dues");
      setStudents(res.data?.data || res.data || []);
    } catch (err) {
      console.error("Failed to fetch dues", err);
    } finally {
      setIsLoading(false);
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

  // Open modal and pre-generate authentic order for UPI/Razorpay
  const handleOpenPaymentModal = async (student: any) => {
    const defaultMode: PaymentMethodType =
      paymentSettings?.defaultMode === "BANK_QR" && paymentSettings?.uploadedQrImageUrl
        ? "BANK_QR"
        : paymentSettings?.defaultMode === "BANK_TRANSFER"
        ? "BANK_TRANSFER"
        : paymentSettings?.defaultMode === "RAZORPAY_CHECKOUT"
        ? "ONLINE_CARD"
        : "ONLINE_UPI";

    setPaymentModal({
      open: true,
      student,
      amount: student.outstandingDue,
      method: defaultMode,
    });
    setParentUtr("");
    setPaymentError(null);
    setSuccessReceipt(null);

    // Pre-create dynamic order
    setIsGeneratingOrder(true);
    try {
      const res = await apiClient.post("/fees/orders/create", {
        studentId: student.studentId,
        amount: student.outstandingDue,
      });
      setCreatedOrder(res.data?.data || res.data);
    } catch (e) {
      console.warn("Could not pre-create online order, fallback to standard VPA", e);
    } finally {
      setIsGeneratingOrder(false);
    }
  };

  // Execute Payment based on chosen method
  const handlePay = async () => {
    if (!paymentModal) return;
    setIsProcessing(true);
    setPaymentError(null);

    // If Razorpay Card or NetBanking selected, open the official Razorpay Checkout modal
    if (paymentModal.method === "ONLINE_CARD" || paymentModal.method === "NETBANKING") {
      try {
        const loaded = await loadRazorpayCheckout();
        if (!loaded) {
          throw new Error("Razorpay gateway SDK failed to load. Please check your connection.");
        }

        let order = createdOrder;
        if (!order || order.amount !== paymentModal.amount) {
          const res = await apiClient.post("/fees/orders/create", {
            studentId: paymentModal.student.studentId,
            amount: paymentModal.amount,
          });
          order = res.data?.data || res.data;
          setCreatedOrder(order);
        }

        const options = {
          key: order.razorpayKeyId,
          amount: Math.round(order.amount * 100),
          currency: order.currency || "INR",
          name: order.schoolName || "School Fee Gateway",
          description: `Fee Payment for ${paymentModal.student.firstName} ${paymentModal.student.lastName}`,
          order_id: order.orderId,
          handler: async function (response: any) {
            try {
              const verifyRes = await apiClient.post("/fees/orders/verify", {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                studentId: paymentModal.student.studentId,
                amount: paymentModal.amount,
                remarks: `Parent Portal Online Payment (${paymentModal.method})`,
              });
              const receipt =
                verifyRes.data?.data?.receipt?.receiptNumber ||
                verifyRes.data?.receipt?.receiptNumber ||
                "RCT-PAID-OK";
              setSuccessReceipt(receipt);
              fetchReceiptDetails(receipt);
              fetchDues();
            } catch (err: any) {
              setPaymentError(err.response?.data?.message || "Cryptographic payment verification failed.");
            } finally {
              setIsProcessing(false);
            }
          },
          prefill: {
            name: user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "",
            email: user?.email || "",
          },
          theme: {
            color: "#2563EB",
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      } catch (err: any) {
        setPaymentError(err.message || "Failed to initialize payment gateway.");
        setIsProcessing(false);
        return;
      }
    }

    // Direct UPI / Bank QR / NEFT Bank Transfer reconciliation
    try {
      const res = await apiClient.post("/fees/parent/pay", {
        studentId: paymentModal.student.studentId,
        amount: paymentModal.amount,
        paymentMode:
          paymentModal.method === "BANK_TRANSFER"
            ? "NEFT"
            : paymentModal.method === "BANK_QR"
            ? "ONLINE_UPI"
            : "ONLINE_UPI",
        transactionRef: parentUtr.trim() || undefined,
      });

      const receiptNumber =
        res.data?.data?.receiptNumber || res.data?.receiptNumber || "RCT-ONLINE-OK";
      setSuccessReceipt(receiptNumber);
      fetchReceiptDetails(receiptNumber);
      fetchDues();
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || "Payment submission failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const activeVpa =
    createdOrder?.upiVpa || paymentSettings?.schoolUpiVpa || "schoolfees@razorpay";
  const activeSchoolName =
    createdOrder?.schoolName || paymentSettings?.payeeMerchantName || "School Fee Gateway";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .formal-fee-receipt, .formal-fee-receipt * {
            visibility: visible;
          }
          .formal-fee-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            padding: 1.5rem !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      {/* Premium Header Banner — Agentic Deep Navy & Electric Blue Palette */}
      <div
        style={{
          background: "linear-gradient(135deg, #0D1B36 0%, #1E3A8A 50%, #0891B2 100%)",
          borderRadius: "1.25rem",
          padding: "2.25rem 2rem",
          color: "white",
          boxShadow: "0 12px 30px -6px rgba(37, 99, 235, 0.28)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        {/* Background Ambient Glow */}
        <div
          style={{
            position: "absolute",
            top: "-40%",
            right: "-10%",
            width: "320px",
            height: "320px",
            background: "radial-gradient(circle, rgba(34, 211, 238, 0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.12)", padding: "0.3rem 0.75rem", borderRadius: "2rem", marginBottom: "0.75rem", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <Sparkles size={14} style={{ color: "#38bdf8" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Parent Fee & Gateway Portal
            </span>
          </div>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            Student Fees & Direct Payments
          </h1>
          <p style={{ opacity: 0.88, marginTop: "0.35rem", fontSize: "0.9375rem", maxWidth: "600px", lineHeight: 1.5 }}>
            Securely review outstanding academic dues and pay instantly via Dynamic NPCI UPI QR, official bank counter QR, cards, or direct institutional transfer.
          </p>
        </div>

        <div
          style={{
            background: "rgba(255, 255, 255, 0.14)",
            padding: "1.25rem",
            borderRadius: "1rem",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <ShieldCheck size={38} style={{ color: "#38bdf8" }} />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-secondary)" }}>
          <Loader2 className="spin" size={36} style={{ margin: "0 auto", color: "var(--primary-600)" }} />
          <p style={{ marginTop: "1rem", fontSize: "0.9375rem", fontWeight: 500 }}>
            Loading your student fee account details...
          </p>
        </div>
      ) : students.length === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: "1rem",
            border: "1px solid var(--border-default)",
            padding: "3.5rem 2rem",
            textAlign: "center",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--brand-blue-subtle)", color: "var(--brand-blue)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <Info size={32} />
          </div>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>No Students Linked</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            No student profiles were found linked to your parent account. Please contact the school administration.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
          {students.map((student) => {
            const hasDue = Number(student.outstandingDue) > 0;
            return (
              <div
                key={student.studentId}
                style={{
                  background: "var(--bg-surface)",
                  borderRadius: "1.125rem",
                  boxShadow: "var(--shadow-sm)",
                  border: "1px solid var(--border-default)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                }}
              >
                {/* Student Profile Card Header */}
                <div
                  style={{
                    padding: "1.25rem 1.5rem",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    background: "var(--bg-surface-hover)",
                  }}
                >
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "0.875rem",
                      background: "linear-gradient(135deg, #2563EB 0%, #0891B2 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: "1.25rem",
                      boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)",
                      flexShrink: 0,
                    }}
                  >
                    {student.firstName?.[0]}
                    {student.lastName?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {student.firstName} {student.lastName}
                    </h3>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                      Class: <strong>{student.className}</strong> • Adm: {student.admissionNumber}
                    </p>
                  </div>
                  {hasDue ? (
                    <span
                      style={{
                        padding: "0.25rem 0.625rem",
                        borderRadius: "2rem",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: "var(--risk-high-bg)",
                        color: "var(--risk-high)",
                        border: "1px solid rgba(220, 38, 38, 0.25)",
                      }}
                    >
                      Due
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: "0.25rem 0.625rem",
                        borderRadius: "2rem",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: "var(--risk-low-bg)",
                        color: "var(--risk-low)",
                        border: "1px solid rgba(5, 150, 105, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <BadgeCheck size={13} />
                      Cleared
                    </span>
                  )}
                </div>

                {/* Fee Breakdown Stats */}
                <div style={{ padding: "1.5rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Total Annual Fees</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9375rem" }}>
                      {formatCurrency(student.totalFee)}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Amount Paid</span>
                    <span style={{ fontWeight: 600, color: "var(--success)", fontSize: "0.9375rem" }}>
                      {formatCurrency(student.totalPaid)}
                    </span>
                  </div>

                  <div style={{ height: "1px", background: "var(--border-default)", margin: "0.35rem 0" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.9375rem" }}>
                      Outstanding Dues
                    </span>
                    <span
                      style={{
                        fontSize: "1.375rem",
                        fontWeight: 800,
                        color: hasDue ? "var(--risk-high)" : "var(--risk-low)",
                        background: hasDue ? "var(--risk-high-bg)" : "var(--risk-low-bg)",
                        padding: "0.25rem 0.875rem",
                        borderRadius: "2rem",
                        border: hasDue ? "1px solid rgba(220, 38, 38, 0.2)" : "1px solid rgba(5, 150, 105, 0.2)",
                      }}
                    >
                      {formatCurrency(student.outstandingDue)}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div
                  style={{
                    padding: "1.25rem 1.5rem",
                    background: "var(--bg-surface-hover)",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <Button
                    style={{
                      width: "100%",
                      background: hasDue ? "var(--primary-600)" : "var(--bg-surface)",
                      color: hasDue ? "#ffffff" : "var(--text-tertiary)",
                      border: hasDue ? "none" : "1px solid var(--border-default)",
                      boxShadow: hasDue ? "0 4px 12px rgba(37, 99, 235, 0.25)" : "none",
                      fontWeight: 700,
                      padding: "0.75rem",
                    }}
                    disabled={!hasDue}
                    onClick={() => handleOpenPaymentModal(student)}
                  >
                    {hasDue ? (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <Lock size={15} />
                        Pay Fees Now &bull; {formatCurrency(student.outstandingDue)}
                      </span>
                    ) : (
                      "All Academic Fees Paid"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enterprise Multi-Option Payment Modal */}
      {paymentModal && paymentModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {successReceipt ? (
            /* Formal Institutional Payment Receipt Card */
            <div
              className="formal-fee-receipt"
              style={{
                background: "var(--bg-surface)",
                padding: "2rem 2.25rem",
                borderRadius: "1.25rem",
                maxWidth: "680px",
                width: "100%",
                boxShadow: "var(--modal-shadow)",
                border: "2px solid var(--border-default)",
                animation: "zoomIn 0.2s ease-out",
                position: "relative",
                maxHeight: "92vh",
                overflowY: "auto",
              }}
            >
              {isLoadingReceipt ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-secondary)" }}>
                  <Loader2 className="spin" size={36} style={{ margin: "0 auto 1rem", color: "var(--primary-600)" }} />
                  <p style={{ fontWeight: 600 }}>Loading Official School Letterhead & Receipt Details...</p>
                </div>
              ) : (
                <>
                  {/* Official Letterhead */}
                  <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: "1.25rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <Building2 size={24} style={{ color: "var(--primary-600)" }} />
                        <h2 style={{ fontSize: "1.375rem", fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "-0.01em" }}>
                          {receiptDetails?.school?.name || activeSchoolName}
                        </h2>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>
                        {receiptDetails?.school?.address ? `${receiptDetails.school.address}, ${receiptDetails.school.city || ''} ${receiptDetails.school.state || ''} ${receiptDetails.school.pinCode || ''}` : "CBSE / ICSE Affiliated Higher Secondary Educational Institution"}
                      </p>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                        {receiptDetails?.school?.affiliationNo ? `Affiliation No: ${receiptDetails.school.affiliationNo} • ` : ""}
                        {receiptDetails?.school?.phone ? `Tel: ${receiptDetails.school.phone} • ` : ""}
                        {receiptDetails?.school?.email || "accounts@school.edu.in"}
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ 
                        display: "inline-flex", 
                        alignItems: "center", 
                        gap: "0.3rem", 
                        padding: "0.3rem 0.65rem", 
                        background: "rgba(16, 185, 129, 0.12)", 
                        color: "#059669", 
                        border: "1px solid rgba(16, 185, 129, 0.3)", 
                        borderRadius: "2rem", 
                        fontSize: "0.75rem", 
                        fontWeight: 700 
                      }}>
                        <BadgeCheck size={14} />
                        Official Fee Voucher
                      </span>
                      <div style={{ fontSize: "0.813rem", fontWeight: 800, color: "#0f172a", marginTop: "0.5rem" }}>
                        Receipt #: {receiptDetails?.receiptNumber || successReceipt}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                        Date: {receiptDetails?.payment?.paymentDate ? new Date(receiptDetails.payment.paymentDate).toLocaleDateString() : new Date().toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Student & Payment Metadata Grid */}
                  <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", marginBottom: "1.25rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.813rem" }}>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", display: "block" }}>Student Name</span>
                      <strong style={{ color: "#0f172a" }}>{receiptDetails?.student?.name || `${paymentModal?.student?.firstName} ${paymentModal?.student?.lastName}`}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", display: "block" }}>Admission No / Roll No</span>
                      <strong style={{ color: "#0f172a" }}>
                        {receiptDetails?.student?.admissionNumber || paymentModal?.student?.admissionNumber} 
                        {receiptDetails?.student?.rollNumber ? ` • Roll: ${receiptDetails.student.rollNumber}` : ""}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", display: "block" }}>Class & Section</span>
                      <strong style={{ color: "#0f172a" }}>{receiptDetails?.student?.class || paymentModal?.student?.className}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", display: "block" }}>Payment Mode & Ref</span>
                      <strong style={{ color: "#0f172a" }}>
                        {receiptDetails?.payment?.paymentMode || paymentModal?.method} 
                        {receiptDetails?.payment?.transactionRef ? ` (${receiptDetails.payment.transactionRef})` : ""}
                      </strong>
                    </div>
                  </div>

                  {/* Itemized Fee Breakdown Table */}
                  <div style={{ marginBottom: "1.25rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.813rem" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                          <th style={{ padding: "0.6rem 0.75rem", color: "#334155" }}>Fee Description</th>
                          <th style={{ padding: "0.6rem 0.75rem", color: "#334155" }}>Academic Period</th>
                          <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "#334155" }}>Amount (INR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(receiptDetails?.breakdown && receiptDetails.breakdown.length > 0) ? (
                          receiptDetails.breakdown.map((item: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: "#1e293b" }}>{item.head}</td>
                              <td style={{ padding: "0.6rem 0.75rem", color: "#64748b" }}>{item.period || "Current Term"}</td>
                              <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: "#1e293b" }}>Academic Term Fees</td>
                            <td style={{ padding: "0.6rem 0.75rem", color: "#64748b" }}>Annual 2026-27</td>
                            <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                              {formatCurrency(paymentModal?.amount || 0)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f8fafc", borderTop: "2px solid #0f172a" }}>
                          <td colSpan={2} style={{ padding: "0.75rem", fontWeight: 800, fontSize: "0.875rem", color: "#0f172a" }}>
                            Total Amount Received
                          </td>
                          <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 800, fontSize: "1.125rem", color: "#2563eb" }}>
                            {formatCurrency(receiptDetails?.payment?.amount || paymentModal?.amount || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Legal Signatory & Watermark Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: "1rem", borderTop: "1px dashed #cbd5e1", marginTop: "1rem", fontSize: "0.75rem", color: "#64748b" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#059669", fontWeight: 700 }}>
                        <ShieldCheck size={14} />
                        Verified Computer Generated Institutional Receipt
                      </div>
                      <div style={{ marginTop: "0.2rem" }}>
                        No physical signature required. Transaction logged cryptographically.
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ height: "24px", borderBottom: "1px solid #94a3b8", width: "120px", margin: "0 auto 0.25rem" }} />
                      <span style={{ fontWeight: 600, color: "#334155" }}>Accounts Officer</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="no-print" style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                    <Button
                      variant="outline"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => window.print()}
                    >
                      <Printer size={16} style={{ marginRight: "0.4rem" }} />
                      Print Official Receipt
                    </Button>
                    <Button
                      style={{ flex: 1, justifyContent: "center", background: "var(--primary-600)", color: "white", fontWeight: 700 }}
                      onClick={() => {
                        setPaymentModal(null);
                        setSuccessReceipt(null);
                        setReceiptDetails(null);
                      }}
                    >
                      Done &bull; View Fees
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Active Multi-Option Payment Gateway */
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "1.5rem",
                maxWidth: "520px",
                width: "100%",
                maxHeight: "92vh",
                overflowY: "auto",
                boxShadow: "var(--modal-shadow)",
                border: "1px solid var(--border-default)",
                position: "relative",
                padding: "2rem",
              }}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
              >
                <X size={20} />
              </button>

              {/* Modal Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <div
                  style={{
                    background: "rgba(37, 99, 235, 0.12)",
                    color: "var(--brand-blue)",
                    padding: "0.625rem",
                    borderRadius: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                    Secure Parent Fee Gateway
                  </h2>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                    {activeSchoolName}
                  </p>
                </div>
              </div>

              {/* Amount Summary Card */}
              <div
                style={{
                  background: "var(--bg-surface-hover)",
                  padding: "1rem 1.25rem",
                  borderRadius: "1rem",
                  marginBottom: "1.25rem",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.813rem" }}>Student Name</span>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                    {paymentModal.student.firstName} {paymentModal.student.lastName} ({paymentModal.student.className})
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border-subtle)" }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "0.875rem" }}>
                    Total Fee Payable
                  </span>
                  <span style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--primary-600)" }}>
                    {formatCurrency(paymentModal.amount)}
                  </span>
                </div>
              </div>

              {/* Error Banner */}
              {paymentError && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    background: "var(--risk-high-bg)",
                    border: "1px solid rgba(220, 38, 38, 0.25)",
                    borderRadius: "0.75rem",
                    color: "var(--risk-high)",
                    fontSize: "0.813rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Payment Methods Grid */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.625rem" }}>
                  Select Authentic Payment Method
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                  {/* Option 1: Dynamic UPI */}
                  <div
                    onClick={() => setPaymentModal({ ...paymentModal, method: "ONLINE_UPI" })}
                    style={{
                      padding: "0.75rem 0.5rem",
                      borderRadius: "0.75rem",
                      border: `2px solid ${paymentModal.method === "ONLINE_UPI" ? "var(--primary-600)" : "var(--border-default)"}`,
                      background: paymentModal.method === "ONLINE_UPI" ? "var(--brand-blue-subtle)" : "var(--bg-surface)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <QrCode size={22} style={{ color: paymentModal.method === "ONLINE_UPI" ? "var(--primary-600)" : "var(--text-secondary)", marginBottom: "0.35rem" }} />
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: paymentModal.method === "ONLINE_UPI" ? "var(--primary-600)" : "var(--text-primary)" }}>
                      Dynamic UPI
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>GPay / PhonePe</span>
                  </div>

                  {/* Option 2: School Bank QR */}
                  <div
                    onClick={() => setPaymentModal({ ...paymentModal, method: "BANK_QR" })}
                    style={{
                      padding: "0.75rem 0.5rem",
                      borderRadius: "0.75rem",
                      border: `2px solid ${paymentModal.method === "BANK_QR" ? "var(--primary-600)" : "var(--border-default)"}`,
                      background: paymentModal.method === "BANK_QR" ? "var(--brand-blue-subtle)" : "var(--bg-surface)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <ImageIcon size={22} style={{ color: paymentModal.method === "BANK_QR" ? "var(--primary-600)" : "var(--text-secondary)", marginBottom: "0.35rem" }} />
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: paymentModal.method === "BANK_QR" ? "var(--primary-600)" : "var(--text-primary)" }}>
                      Bank QR
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>School Standee</span>
                  </div>

                  {/* Option 3: Cards via Gateway */}
                  <div
                    onClick={() => setPaymentModal({ ...paymentModal, method: "ONLINE_CARD" })}
                    style={{
                      padding: "0.75rem 0.5rem",
                      borderRadius: "0.75rem",
                      border: `2px solid ${paymentModal.method === "ONLINE_CARD" ? "var(--primary-600)" : "var(--border-default)"}`,
                      background: paymentModal.method === "ONLINE_CARD" ? "var(--brand-blue-subtle)" : "var(--bg-surface)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CardIcon size={22} style={{ color: paymentModal.method === "ONLINE_CARD" ? "var(--primary-600)" : "var(--text-secondary)", marginBottom: "0.35rem" }} />
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: paymentModal.method === "ONLINE_CARD" ? "var(--primary-600)" : "var(--text-primary)" }}>
                      Cards / Gateway
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>Visa/Master/RuPay</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {/* Option 4: NetBanking */}
                  <div
                    onClick={() => setPaymentModal({ ...paymentModal, method: "NETBANKING" })}
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderRadius: "0.75rem",
                      border: `2px solid ${paymentModal.method === "NETBANKING" ? "var(--primary-600)" : "var(--border-default)"}`,
                      background: paymentModal.method === "NETBANKING" ? "var(--brand-blue-subtle)" : "var(--bg-surface)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Globe size={18} style={{ color: paymentModal.method === "NETBANKING" ? "var(--primary-600)" : "var(--text-secondary)" }} />
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: paymentModal.method === "NETBANKING" ? "var(--primary-600)" : "var(--text-primary)" }}>
                        Net Banking
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>50+ Indian Banks</div>
                    </div>
                  </div>

                  {/* Option 5: Bank Transfer (NEFT/RTGS) */}
                  <div
                    onClick={() => setPaymentModal({ ...paymentModal, method: "BANK_TRANSFER" })}
                    style={{
                      padding: "0.625rem 0.75rem",
                      borderRadius: "0.75rem",
                      border: `2px solid ${paymentModal.method === "BANK_TRANSFER" ? "var(--primary-600)" : "var(--border-default)"}`,
                      background: paymentModal.method === "BANK_TRANSFER" ? "var(--brand-blue-subtle)" : "var(--bg-surface)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Building2 size={18} style={{ color: paymentModal.method === "BANK_TRANSFER" ? "var(--primary-600)" : "var(--text-secondary)" }} />
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: paymentModal.method === "BANK_TRANSFER" ? "var(--primary-600)" : "var(--text-primary)" }}>
                        NEFT / RTGS
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>Direct Bank Wire</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* METHOD 1: Dynamic Amount UPI QR */}
              {paymentModal.method === "ONLINE_UPI" && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-default)",
                    borderRadius: "1rem",
                    padding: "1rem",
                    marginBottom: "1.25rem",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.813rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem" }}>
                    Scan with Any UPI App (Auto-Amount Encoded)
                  </div>

                  <div
                    style={{
                      display: "inline-block",
                      padding: "8px",
                      background: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  >
                    <img
                      src={
                        createdOrder?.qrCodeUrl ||
                        `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(
                          `upi://pay?pa=${activeVpa}&pn=${encodeURIComponent(
                            activeSchoolName,
                          )}&am=${paymentModal.amount}&cu=INR&tn=${encodeURIComponent(
                            `Fee ${paymentModal.student.admissionNumber}`,
                          )}`,
                        )}`
                      }
                      alt="NPCI Dynamic UPI QR"
                      style={{ width: "175px", height: "175px", display: "block" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    {["GPay", "PhonePe", "Paytm", "BHIM", "Cred"].map((app) => (
                      <span
                        key={app}
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.15rem 0.5rem",
                          background: "#f1f5f9",
                          borderRadius: "12px",
                          color: "#475569",
                          fontWeight: 600,
                        }}
                      >
                        {app}
                      </span>
                    ))}
                  </div>

                  {/* VPA Display & Copy */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.625rem",
                      padding: "0.4rem 0.75rem",
                      marginTop: "0.75rem",
                    }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>School UPI ID (VPA)</span>
                      <span style={{ fontSize: "0.813rem", fontWeight: 700, color: "#0f172a" }}>{activeVpa}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        copyToClipboard(activeVpa, "vpa");
                        setCopiedVpa(true);
                        setTimeout(() => setCopiedVpa(false), 2000);
                      }}
                      style={{ padding: "0.25rem 0.5rem", height: "auto", fontSize: "0.75rem" }}
                    >
                      {copiedVpa ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
                      <span style={{ marginLeft: "0.25rem" }}>{copiedVpa ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>

                  {/* Mobile Deep Link */}
                  {createdOrder?.upiUri && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => (window.location.href = createdOrder.upiUri)}
                      style={{ width: "100%", marginTop: "0.625rem", justifyContent: "center", fontSize: "0.813rem" }}
                    >
                      <Smartphone size={14} style={{ marginRight: "0.4rem" }} />
                      Open Installed UPI App
                    </Button>
                  )}
                </div>
              )}

              {/* METHOD 2: Official Bank Counter QR Standee */}
              {paymentModal.method === "BANK_QR" && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-default)",
                    borderRadius: "1rem",
                    padding: "1rem",
                    marginBottom: "1.25rem",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.813rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem" }}>
                    Official School Bank Counter QR Code
                  </div>

                  {paymentSettings?.uploadedQrImageUrl ? (
                    <>
                      <div
                        style={{
                          display: "inline-block",
                          padding: "8px",
                          background: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #cbd5e1",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        }}
                      >
                        <img
                          src={paymentSettings.uploadedQrImageUrl}
                          alt="Official School Bank Counter QR"
                          style={{ width: "185px", height: "185px", objectFit: "contain", display: "block" }}
                        />
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.5rem 0 0" }}>
                        Scan this bank standee QR with GPay/PhonePe and enter <strong>{formatCurrency(paymentModal.amount)}</strong>. Then enter your transaction UTR below.
                      </p>
                    </>
                  ) : (
                    <div style={{ padding: "1.75rem 1rem" }}>
                      <ImageIcon size={38} style={{ color: "var(--text-tertiary)", margin: "0 auto 0.75rem" }} />
                      <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                        No Counter QR Standee Uploaded
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0.25rem 0 0.75rem" }}>
                        The school administration has not uploaded a physical counter standee. You can still use Dynamic UPI QR or Razorpay Gateway.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentModal({ ...paymentModal, method: "ONLINE_UPI" })}
                      >
                        Switch to Dynamic UPI QR &rarr;
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* METHOD 3 & 4: Cards / NetBanking Info Card */}
              {(paymentModal.method === "ONLINE_CARD" || paymentModal.method === "NETBANKING") && (
                <div
                  style={{
                    background: "var(--bg-surface-hover)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "1rem",
                    padding: "1.25rem",
                    marginBottom: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Lock size={16} style={{ color: "var(--primary-600)" }} />
                    <span style={{ fontSize: "0.813rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      256-Bit Encrypted Razorpay Gateway
                    </span>
                  </div>

                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                    {paymentModal.method === "ONLINE_CARD"
                      ? "Pay securely with Visa, MasterCard, RuPay, Maestro, or Corporate Credit/Debit Cards with zero markup."
                      : "Pay securely via instant Net Banking through SBI, HDFC, ICICI, Axis, PNB, Kotak, and 50+ other Indian institutions."}
                  </p>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {paymentModal.method === "ONLINE_CARD"
                      ? ["Visa", "MasterCard", "RuPay", "Amex"].map((card) => (
                          <span
                            key={card}
                            style={{
                              fontSize: "0.688rem",
                              fontWeight: 600,
                              background: "var(--bg-surface)",
                              border: "1px solid var(--border-default)",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "6px",
                            }}
                          >
                            {card}
                          </span>
                        ))
                      : ["SBI", "HDFC", "ICICI", "Axis", "PNB", "Kotak"].map((b) => (
                          <span
                            key={b}
                            style={{
                              fontSize: "0.688rem",
                              fontWeight: 600,
                              background: "var(--bg-surface)",
                              border: "1px solid var(--border-default)",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "6px",
                            }}
                          >
                            {b}
                          </span>
                        ))}
                  </div>
                </div>
              )}

              {/* METHOD 5: Institutional Bank Wire (NEFT/RTGS) */}
              {paymentModal.method === "BANK_TRANSFER" && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-default)",
                    borderRadius: "1rem",
                    padding: "1rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <div style={{ fontSize: "0.813rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem", textAlign: "center" }}>
                    School Institutional Bank Account (NEFT / RTGS / IMPS)
                  </div>

                  {paymentSettings?.accountNumber ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.625rem", background: "#f8fafc", borderRadius: "6px" }}>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Account Holder</span>
                        <span style={{ fontSize: "0.813rem", fontWeight: 700, color: "#0f172a" }}>
                          {paymentSettings.accountHolder || activeSchoolName}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.625rem", background: "#f8fafc", borderRadius: "6px" }}>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Bank & Branch</span>
                        <span style={{ fontSize: "0.813rem", fontWeight: 600, color: "#0f172a" }}>
                          {paymentSettings.bankName || "Nationalized Bank"} {paymentSettings.branch ? `(${paymentSettings.branch})` : ""}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.625rem", background: "#f8fafc", borderRadius: "6px" }}>
                        <div>
                          <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>Account Number</span>
                          <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#0f172a", letterSpacing: "0.05em" }}>
                            {paymentSettings.accountNumber}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(paymentSettings.accountNumber, "acc")}
                          style={{ padding: "0.2rem 0.5rem", height: "auto", fontSize: "0.75rem" }}
                        >
                          {copiedField === "acc" ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
                          <span style={{ marginLeft: "0.25rem" }}>{copiedField === "acc" ? "Copied" : "Copy"}</span>
                        </Button>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.625rem", background: "#f8fafc", borderRadius: "6px" }}>
                        <div>
                          <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>IFSC Code</span>
                          <span style={{ fontSize: "0.813rem", fontWeight: 800, color: "#0f172a" }}>
                            {paymentSettings.ifscCode}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(paymentSettings.ifscCode, "ifsc")}
                          style={{ padding: "0.2rem 0.5rem", height: "auto", fontSize: "0.75rem" }}
                        >
                          {copiedField === "ifsc" ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
                          <span style={{ marginLeft: "0.25rem" }}>{copiedField === "ifsc" ? "Copied" : "Copy"}</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "1.25rem 0.5rem" }}>
                      <Building2 size={32} style={{ color: "#94a3b8", margin: "0 auto 0.5rem" }} />
                      <p style={{ fontSize: "0.813rem", fontWeight: 700, color: "#334155", margin: 0 }}>
                        Bank Wire Details Not Published
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0" }}>
                        Please pay using the Dynamic UPI QR or Cards via the Razorpay gateway.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* UTR / Reference No. Input for UPI / Bank Transfer */}
              {(paymentModal.method === "ONLINE_UPI" ||
                paymentModal.method === "BANK_QR" ||
                paymentModal.method === "BANK_TRANSFER") && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                    UPI / Bank Transfer UTR Number (Optional for Instant Reconciliation)
                  </label>
                  <input
                    type="text"
                    value={parentUtr}
                    onChange={(e) => setParentUtr(e.target.value)}
                    placeholder="e.g. 12-digit UPI Ref or IMPS/NEFT UTR"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.625rem",
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-surface)",
                      fontSize: "0.813rem",
                      color: "var(--text-primary)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Modal Buttons */}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Button
                  variant="outline"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setPaymentModal(null)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  style={{
                    flex: 2,
                    background: "var(--primary-600)",
                    color: "white",
                    fontWeight: 700,
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                  }}
                  onClick={handlePay}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="spin" size={16} style={{ marginRight: "0.5rem" }} />
                      Securing Payment...
                    </>
                  ) : paymentModal.method === "ONLINE_CARD" || paymentModal.method === "NETBANKING" ? (
                    <>
                      Proceed to Razorpay Checkout
                      <ArrowRight size={15} style={{ marginLeft: "0.4rem" }} />
                    </>
                  ) : (
                    <>
                      Confirm & Generate Receipt
                      <CheckCircle2 size={15} style={{ marginLeft: "0.4rem" }} />
                    </>
                  )}
                </Button>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", marginTop: "1.25rem", opacity: 0.7 }}>
                <ShieldCheck size={13} style={{ color: "var(--success)" }} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Secured by 256-Bit SSL Encryption. School Receipt Guaranteed.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
