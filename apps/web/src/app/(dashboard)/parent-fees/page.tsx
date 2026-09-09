"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { IndianRupee, ShieldCheck, CreditCard as CardIcon, Loader2, Info } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrencyINR as formatCurrency } from "@/lib/formatters";

export default function ParentFeesPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; student: any; amount: number; method: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    fetchDues();
  }, []);

  const fetchDues = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/fees/parent/dues");
      setStudents(res.data.data || res.data || []);
    } catch (err) {
      console.error("Failed to fetch dues", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePay = async () => {
    if (!paymentModal) return;
    setIsProcessing(true);
    
    // Simulate secure payment delay
    setTimeout(async () => {
      try {
        const res = await apiClient.post("/fees/parent/pay", {
          studentId: paymentModal.student.studentId,
          amount: paymentModal.amount,
          paymentMode: paymentModal.method,
        });
        
        setSuccessReceipt(res.data.data?.receiptNumber || res.data?.receiptNumber || 'RCPT-ONLINE-123');
        fetchDues();
      } catch (err) {
        console.error("Payment failed", err);
      } finally {
        setIsProcessing(false);
      }
    }, 2000);
  };


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      {/* Header Banner - Green Theme */}
      <div style={{
        background: "linear-gradient(135deg, #0f766e 0%, #047857 100%)",
        borderRadius: "1rem",
        padding: "2rem",
        color: "white",
        boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.2)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Fees & Payments</h1>
          <p style={{ opacity: 0.9, marginTop: "0.5rem" }}>Securely manage and pay your children's school fees.</p>
        </div>
        <div style={{ 
          background: "rgba(255, 255, 255, 0.2)", 
          padding: "1rem", 
          borderRadius: "0.75rem",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.3)"
        }}>
          <ShieldCheck size={32} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
          <Loader2 className="spin" size={32} style={{ margin: "0 auto" }} />
          <p style={{ marginTop: "1rem" }}>Loading fee details...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <p>No students found linked to your account.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem" }}>
          {students.map(student => (
            <div key={student.studentId} style={{
              background: "white",
              borderRadius: "1rem",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              transition: "transform 0.2s",
              display: "flex",
              flexDirection: "column"
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "50%", background: "#ecfdf5", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#059669", fontWeight: 600, fontSize: "1.25rem"
                }}>
                  {student.firstName[0]}{student.lastName[0]}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.125rem", color: "#111827" }}>{student.firstName} {student.lastName}</h3>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>{student.className} • Adm: {student.admissionNumber}</p>
                </div>
              </div>
              
              <div style={{ padding: "1.5rem", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <span style={{ color: "#6b7280" }}>Total Annual Fee</span>
                  <span style={{ fontWeight: 500, color: "#374151" }}>{formatCurrency(student.totalFee)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <span style={{ color: "#6b7280" }}>Paid Amount</span>
                  <span style={{ fontWeight: 500, color: "#059669" }}>{formatCurrency(student.totalPaid)}</span>
                </div>
                <div style={{ margin: "1rem 0", height: "1px", background: "#e5e7eb" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#111827", fontWeight: 600 }}>Outstanding Balance</span>
                  <span style={{ 
                    fontSize: "1.25rem", 
                    fontWeight: 700, 
                    color: student.outstandingDue > 0 ? "#dc2626" : "#059669",
                    background: student.outstandingDue > 0 ? "#fef2f2" : "#ecfdf5",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "2rem"
                  }}>
                    {formatCurrency(student.outstandingDue)}
                  </span>
                </div>
              </div>

              <div style={{ padding: "1.25rem", background: "#f9fafb", borderTop: "1px solid #f3f4f6" }}>
                <Button 
                  style={{ 
                    width: "100%", 
                    background: student.outstandingDue > 0 ? "#0f766e" : "#e5e7eb",
                    color: student.outstandingDue > 0 ? "white" : "#9ca3af",
                    opacity: student.outstandingDue > 0 ? 1 : 0.7
                  }}
                  disabled={student.outstandingDue <= 0}
                  onClick={() => setPaymentModal({ open: true, student, amount: student.outstandingDue, method: 'ONLINE_UPI' })}
                >
                  {student.outstandingDue > 0 ? "Pay Now Securely" : "All Dues Cleared"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && paymentModal.open && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "var(--bg-overlay)",
          backdropFilter: "var(--modal-backdrop-blur)",
          WebkitBackdropFilter: "var(--modal-backdrop-blur)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "1rem", animation: "fadeIn 0.2s ease-out"
        }}>
          {successReceipt ? (
            <div style={{ background: "var(--bg-surface-solid)", backgroundColor: "var(--bg-surface-solid)", opacity: 1, padding: "3rem", borderRadius: "1.5rem", maxWidth: "450px", width: "100%", textAlign: "center", boxShadow: "var(--modal-shadow)", border: "1px solid var(--border-default)", animation: "zoomIn 0.2s ease-out" }}>
              <div style={{ width: "80px", height: "80px", background: "#ecfdf5", color: "#059669", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
                <ShieldCheck size={40} />
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Payment Successful!</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>Thank you. Your fee payment has been received securely.</p>
              <div style={{ background: "var(--bg-app)", padding: "1rem", borderRadius: "0.5rem", marginBottom: "2rem", display: "inline-block", border: "1px solid var(--border-default)" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>Receipt Number</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)" }}>{successReceipt}</p>
              </div>
              <Button style={{ width: "100%", background: "#0f766e" }} onClick={() => { setPaymentModal(null); setSuccessReceipt(null); }}>
                Done
              </Button>
            </div>
          ) : (
            <div style={{ background: "var(--bg-surface-solid)", backgroundColor: "var(--bg-surface-solid)", opacity: 1, padding: "2rem", borderRadius: "1.5rem", maxWidth: "500px", width: "100%", boxShadow: "var(--modal-shadow)", border: "1px solid var(--border-default)", animation: "zoomIn 0.2s ease-out" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Secure Checkout</h2>
                <ShieldCheck color="#059669" />
              </div>
              
              <div style={{ background: "#f9fafb", padding: "1.5rem", borderRadius: "1rem", marginBottom: "2rem", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ color: "#4b5563" }}>Student Name</span>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{paymentModal.student.firstName} {paymentModal.student.lastName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <span style={{ color: "#4b5563" }}>Payment For</span>
                  <span style={{ fontWeight: 600, color: "#111827" }}>Outstanding Fees</span>
                </div>
                <div style={{ margin: "1rem 0", height: "1px", background: "#e5e7eb" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#111827", fontWeight: 600 }}>Total Amount to Pay</span>
                  <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f766e" }}>{formatCurrency(paymentModal.amount)}</span>
                </div>
              </div>

              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "1rem" }}>Select Payment Method</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
                <div 
                  onClick={() => setPaymentModal({...paymentModal, method: 'ONLINE_UPI'})}
                  style={{
                    padding: "1rem", border: `2px solid ${paymentModal.method === 'ONLINE_UPI' ? '#0f766e' : '#e5e7eb'}`,
                    borderRadius: "0.75rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                    background: paymentModal.method === 'ONLINE_UPI' ? '#f0fdfa' : 'white'
                  }}
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" alt="UPI" style={{ height: "24px", marginBottom: "0.5rem" }} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 500, color: paymentModal.method === 'ONLINE_UPI' ? '#0f766e' : '#4b5563' }}>UPI App</span>
                </div>
                <div 
                  onClick={() => setPaymentModal({...paymentModal, method: 'ONLINE_CARD'})}
                  style={{
                    padding: "1rem", border: `2px solid ${paymentModal.method === 'ONLINE_CARD' ? '#0f766e' : '#e5e7eb'}`,
                    borderRadius: "0.75rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                    background: paymentModal.method === 'ONLINE_CARD' ? '#f0fdfa' : 'white'
                  }}
                >
                  <CardIcon size={24} color={paymentModal.method === 'ONLINE_CARD' ? '#0f766e' : '#9ca3af'} style={{ marginBottom: "0.5rem" }} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 500, color: paymentModal.method === 'ONLINE_CARD' ? '#0f766e' : '#4b5563' }}>Debit/Credit Card</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <Button variant="outline" style={{ flex: 1 }} onClick={() => setPaymentModal(null)} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button style={{ flex: 2, background: "#0f766e", color: "white" }} onClick={handlePay} disabled={isProcessing}>
                  {isProcessing ? <><Loader2 className="spin" size={18} style={{ marginRight: "0.5rem" }}/> Processing securely...</> : `Pay ${formatCurrency(paymentModal.amount)}`}
                </Button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "1.5rem", opacity: 0.6 }}>
                <ShieldCheck size={14} />
                <span style={{ fontSize: "0.75rem" }}>Secured by SSL. Payments are encrypted.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
