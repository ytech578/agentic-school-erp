"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  Save,
  QrCode,
  Upload,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Eye,
  Trash2,
  Copy,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

export default function FeePaymentSettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedVpa, setCopiedVpa] = useState(false);

  // Form State
  const [upiVpa, setUpiVpa] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [razorpayEnabled, setRazorpayEnabled] = useState(true);
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [preferredMode, setPreferredMode] = useState("DYNAMIC_UPI_QR");
  const [customInstructions, setCustomInstructions] = useState("");

  // Simulated Preview Tab
  const [previewTab, setPreviewTab] = useState<"dynamic" | "uploaded" | "bank">("dynamic");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/fees/settings/payment");
      const data = res.data?.data || res.data || {};
      setUpiVpa(data.upiVpa || "");
      setPayeeName(data.payeeName || "");
      setQrCodeImageUrl(data.qrCodeImageUrl || "");
      setAccountNumber(data.accountNumber || "");
      setIfscCode(data.ifscCode || "");
      setBankName(data.bankName || "");
      setBranch(data.branch || "");
      setRazorpayEnabled(data.razorpayEnabled ?? true);
      setRazorpayKeyId(data.razorpayKeyId || "");
      setPreferredMode(data.preferredMode || "DYNAMIC_UPI_QR");
      setCustomInstructions(data.customInstructions || "");
    } catch (err: any) {
      console.error("Failed to load payment settings", err);
      setErrorMessage("Failed to load school payment settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG, JPG, WEBP, SVG).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setQrCodeImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiVpa || !upiVpa.includes("@")) {
      setErrorMessage("Please enter a valid UPI ID (e.g. schoolname@bank).");
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await apiClient.put("/fees/settings/payment", {
        upiVpa,
        payeeName: payeeName || "School ERP Fees",
        qrCodeImageUrl,
        accountNumber,
        ifscCode,
        bankName,
        branch,
        razorpayEnabled,
        razorpayKeyId,
        razorpayKeySecret,
        preferredMode,
        customInstructions,
      });

      setSuccessMessage("School Payment & UPI QR options updated successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Failed to save payment options.");
    } finally {
      setIsSaving(false);
    }
  };

  // Preview live URI
  const previewUri = `upi://pay?pa=${encodeURIComponent(upiVpa || "school@upi")}&pn=${encodeURIComponent(payeeName || "School Name")}&am=5000.00&cu=INR&tn=Fee%20Payment`;
  const previewDynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(previewUri)}`;

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        Loading payment gateway & QR configuration...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Button variant="ghost" onClick={() => router.push("/fees")} style={{ padding: "0.5rem" }}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 700 }}>
              Payment Options & School UPI QR
            </h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Configure school UPI VPA, upload bank merchant QR codes, and manage Razorpay gateway settings.
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div style={{
          padding: "1rem 1.25rem",
          background: "rgba(16, 185, 129, 0.1)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          color: "var(--success, #10b981)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}>
          <CheckCircle2 size={20} />
          <span style={{ fontWeight: 500 }}>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{
          padding: "1rem 1.25rem",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "var(--danger, #ef4444)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}>
          <AlertCircle size={20} />
          <span style={{ fontWeight: 500 }}>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.75rem", alignItems: "start" }}>
          
          {/* Left Column: Form Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Card 1: UPI & Merchant Profile */}
            <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "1rem" }}>
                <div style={{ background: "rgba(59, 130, 246, 0.12)", color: "var(--primary-600, #2563eb)", padding: "0.5rem", borderRadius: "var(--radius-md)" }}>
                  <Smartphone size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.063rem", fontWeight: 700 }}>1. School UPI & NPCI Payee Identity</h3>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                    Primary UPI ID used for generating scannable QR codes across fee collections.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <div>
                  <Input
                    label="School UPI ID (VPA) *"
                    value={upiVpa}
                    onChange={(e) => setUpiVpa(e.target.value)}
                    placeholder="e.g. greenfieldschool@icici"
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                    Bank-issued VPA (e.g. from ICICI, HDFC, SBI, Paytm Merchant)
                  </span>
                </div>

                <div>
                  <Input
                    label="Merchant / Payee Name *"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    placeholder="e.g. Greenfield Public School"
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                    Name shown on parents' screen when scanning in UPI apps
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Official Bank QR Upload */}
            <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "1rem" }}>
                <div style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--success, #10b981)", padding: "0.5rem", borderRadius: "var(--radius-md)" }}>
                  <QrCode size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.063rem", fontWeight: 700 }}>2. Official Bank QR Code Image (Optional)</h3>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                    Upload the physical counter QR standee or bank merchant QR code image.
                  </p>
                </div>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: "none" }}
                />

                {qrCodeImageUrl ? (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.5rem",
                    padding: "1rem",
                    background: "var(--bg-surface-hover)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-default)",
                  }}>
                    <img
                      src={qrCodeImageUrl}
                      alt="Uploaded School QR"
                      style={{ width: "110px", height: "110px", objectFit: "contain", borderRadius: "8px", background: "#ffffff", border: "1px solid #e2e8f0" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--success)" }}>
                        ✓ Bank QR Code Uploaded
                      </span>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Cashiers and parents can switch between the dynamic amount QR and this official bank QR.
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Replace Image
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setQrCodeImageUrl("")}
                          style={{ color: "var(--danger)" }}
                        >
                          <Trash2 size={14} style={{ marginRight: "0.25rem" }} />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed var(--secondary-400, #cbd5e1)",
                      borderRadius: "var(--radius-lg)",
                      padding: "2rem",
                      textAlign: "center",
                      cursor: "pointer",
                      background: "var(--bg-surface-hover)",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <Upload size={32} style={{ margin: "0 auto 0.75rem", color: "var(--primary-600)" }} />
                    <div style={{ fontWeight: 600, fontSize: "0.938rem", marginBottom: "0.25rem" }}>
                      Click to upload School Bank QR Code
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      Supports PNG, JPG, WEBP, SVG (Max 5MB)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Direct Bank Account Details (NEFT/RTGS) */}
            <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "1rem" }}>
                <div style={{ background: "rgba(245, 158, 11, 0.12)", color: "var(--warning, #f59e0b)", padding: "0.5rem", borderRadius: "var(--radius-md)" }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.063rem", fontWeight: 700 }}>3. School Bank Account (NEFT / RTGS / IMPS)</h3>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                    Institutional account details presented to parents choosing direct wire/net banking transfer.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <Input
                  label="Bank Name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                />
                <Input
                  label="Branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. Main City Branch"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <Input
                  label="Account Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 50100234567890"
                />
                <Input
                  label="IFSC Code"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                />
              </div>
            </div>

            {/* Card 4: Razorpay Online Gateway */}
            <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-default)", paddingBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ background: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", padding: "0.5rem", borderRadius: "var(--radius-md)" }}>
                    <CreditCard size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.063rem", fontWeight: 700 }}>4. Razorpay Gateway Integration</h3>
                    <p style={{ margin: "0.15rem 0 0", fontSize: "0.813rem", color: "var(--text-secondary)" }}>
                      Live or Test credentials for Debit/Credit Cards and NetBanking checkout.
                    </p>
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={razorpayEnabled}
                    onChange={(e) => setRazorpayEnabled(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--primary-600)" }}
                  />
                  Enable Razorpay
                </label>
              </div>

              {razorpayEnabled && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <Input
                    label="Razorpay Key ID"
                    value={razorpayKeyId}
                    onChange={(e) => setRazorpayKeyId(e.target.value)}
                    placeholder="rzp_live_... or rzp_test_..."
                  />
                  <Input
                    label="Razorpay Key Secret"
                    type="password"
                    value={razorpayKeySecret}
                    onChange={(e) => setRazorpayKeySecret(e.target.value)}
                    placeholder="Leave blank to keep existing"
                  />
                </div>
              )}
            </div>

            {/* Card 5: Preferences & Instructions */}
            <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.063rem", fontWeight: 700 }}>5. Fee Collection Display Preferences</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Default Payment Display</label>
                <select
                  value={preferredMode}
                  onChange={(e) => setPreferredMode(e.target.value)}
                  style={{
                    width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                    fontSize: "0.875rem", color: "var(--text-primary)"
                  }}
                >
                  <option value="DYNAMIC_UPI_QR">Dynamic Amount UPI QR (Recommended)</option>
                  <option value="UPLOADED_BANK_QR">Official Bank QR Code (If Uploaded)</option>
                  <option value="RAZORPAY_CHECKOUT">Razorpay Online Checkout (Cards / NetBanking)</option>
                  <option value="ALL">Show All Tabbed Options</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Custom Instructions for Parents / Receipts</label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Mention admission number in transfer remarks. Receipts are automatically emailed upon verification."
                  style={{
                    width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                    border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                    fontSize: "0.875rem", color: "var(--text-primary)", resize: "vertical"
                  }}
                />
              </div>
            </div>

            {/* Submit Button Bar */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.5rem" }}>
              <Button type="button" variant="secondary" onClick={() => router.push("/fees")}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving} style={{ minWidth: "160px" }}>
                <Save size={16} style={{ marginRight: "0.5rem" }} />
                Save Payment Settings
              </Button>
            </div>
          </div>

          {/* Right Column: Live Interactive Simulator Card */}
          <div style={{ position: "sticky", top: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="card" style={{ padding: "1.5rem", border: "2px solid var(--primary-200, #bfdbfe)", background: "var(--bg-surface)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary-600)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Live Modal Preview
                </span>
                <span style={{ fontSize: "0.688rem", padding: "0.15rem 0.5rem", background: "rgba(59, 130, 246, 0.1)", borderRadius: "12px", color: "var(--primary-600)", fontWeight: 600 }}>
                  What Parents See
                </span>
              </div>

              {/* Toggle Preview View */}
              <div style={{ display: "grid", gridTemplateColumns: qrCodeImageUrl ? "1fr 1fr 1fr" : "1fr 1fr", gap: "0.25rem", background: "var(--bg-surface-hover)", padding: "0.25rem", borderRadius: "var(--radius-md)", marginBottom: "1.25rem" }}>
                <button
                  type="button"
                  onClick={() => setPreviewTab("dynamic")}
                  style={{
                    padding: "0.4rem 0.25rem", border: "none", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                    background: previewTab === "dynamic" ? "var(--bg-surface)" : "transparent",
                    color: previewTab === "dynamic" ? "var(--primary-600)" : "var(--text-secondary)",
                    boxShadow: previewTab === "dynamic" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  Dynamic UPI
                </button>
                {qrCodeImageUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab("uploaded")}
                    style={{
                      padding: "0.4rem 0.25rem", border: "none", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                      background: previewTab === "uploaded" ? "var(--bg-surface)" : "transparent",
                      color: previewTab === "uploaded" ? "var(--primary-600)" : "var(--text-secondary)",
                      boxShadow: previewTab === "uploaded" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    Bank QR
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewTab("bank")}
                  style={{
                    padding: "0.4rem 0.25rem", border: "none", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                    background: previewTab === "bank" ? "var(--bg-surface)" : "transparent",
                    color: previewTab === "bank" ? "var(--primary-600)" : "var(--text-secondary)",
                    boxShadow: previewTab === "bank" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  Bank NEFT
                </button>
              </div>

              {/* Preview Content */}
              {previewTab === "dynamic" && (
                <div style={{ textAlign: "center", background: "#ffffff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem" }}>
                    Scan with any UPI App (GPay / PhonePe / Paytm)
                  </div>
                  <img
                    src={previewDynamicQrUrl}
                    alt="Preview Dynamic QR"
                    style={{ width: "170px", height: "170px", margin: "0 auto", display: "block" }}
                  />
                  <div style={{ marginTop: "0.75rem", padding: "0.35rem 0.6rem", background: "#f8fafc", borderRadius: "6px", fontSize: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{upiVpa || "school@upi"}</span>
                    <span style={{ color: "var(--primary-600)", fontWeight: 500 }}>Verified Payee</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.35rem" }}>
                    Payee: <strong>{payeeName || "School Name"}</strong>
                  </div>
                </div>
              )}

              {previewTab === "uploaded" && (
                <div style={{ textAlign: "center", background: "#ffffff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#059669", marginBottom: "0.5rem" }}>
                    Official Bank Merchant QR Code
                  </div>
                  <img
                    src={qrCodeImageUrl || previewDynamicQrUrl}
                    alt="School Official Bank QR"
                    style={{ width: "170px", height: "170px", objectFit: "contain", margin: "0 auto", display: "block" }}
                  />
                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#64748b" }}>
                    Scan directly at school accounts desk
                  </div>
                </div>
              )}

              {previewTab === "bank" && (
                <div style={{ background: "var(--bg-surface-hover)", padding: "1rem", borderRadius: "12px", fontSize: "0.813rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Bank:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{bankName || "Not configured"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>A/C Number:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{accountNumber || "Not configured"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>IFSC:</span>
                    <strong style={{ color: "var(--primary-600)" }}>{ifscCode || "Not configured"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Branch:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{branch || "Main"}</strong>
                  </div>
                </div>
              )}

              <div style={{ marginTop: "1.25rem", padding: "0.75rem", background: "rgba(59, 130, 246, 0.05)", borderRadius: "8px", border: "1px solid rgba(59, 130, 246, 0.15)", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                💡 <strong>Admin Notice:</strong> Changes take effect immediately across the Fee Collection screen and Parent Fee Portal.
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
