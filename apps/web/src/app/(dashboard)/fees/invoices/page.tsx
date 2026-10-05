"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSchool } from "@/hooks/useSchool";
import { formatCurrencyINR as formatCurrency, numberToIndianWords } from "@/lib/formatters";
import {
  FileText,
  Search,
  Filter,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  IndianRupee,
  Receipt as ReceiptIcon,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  CreditCard,
  AlertCircle,
  Eye,
} from "lucide-react";

interface FeeInvoiceItem {
  id: string;
  head: string;
  amount: number;
  period?: string;
}

interface FeeInvoice {
  id: string;
  invoiceNumber: string;
  receiptNumber: string;
  receiptId?: string;
  paymentDate: string;
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  fineAmount: number;
  outstandingAmount: number;
  paymentMode: string;
  paymentStatus: string;
  transactionRef?: string;
  chequeNumber?: string;
  chequeBankName?: string;
  remarks?: string;
  student?: {
    id?: string;
    admissionNumber?: string;
    rollNumber?: string;
    name?: string;
    class?: string;
    parentName?: string;
    parentPhone?: string;
  };
  breakdown?: FeeInvoiceItem[];
  school?: {
    name?: string;
    code?: string;
    address?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    phone?: string;
    email?: string;
    affiliationNo?: string;
  };
}

export default function FeeInvoicesPage() {
  const { schoolName, affiliationNo: defaultAffiliation, fullAddress: defaultAddress, phone: defaultPhone, email: defaultEmail } = useSchool();
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedInvoice, setSelectedInvoice] = useState<FeeInvoice | null>(null);
  const [receiptCopyType, setReceiptCopyType] = useState<"STUDENT" | "OFFICE">("STUDENT");

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== "ALL") params.paymentStatus = statusFilter;
      const res = await apiClient.get("/fees/invoices", { params });
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      setInvoices(list);
    } catch (err) {
      console.error("Failed to load fee invoices", err);
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (inv.invoiceNumber || "").toLowerCase().includes(q) ||
      (inv.receiptNumber || "").toLowerCase().includes(q) ||
      (inv.student?.name || "").toLowerCase().includes(q) ||
      (inv.student?.admissionNumber || "").toLowerCase().includes(q) ||
      (inv.student?.class || "").toLowerCase().includes(q) ||
      (inv.transactionRef || "").toLowerCase().includes(q)
    );
  });

  // KPI Calculations
  const totalInvoiced = invoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0);
  const totalCollected = invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
  const totalOutstanding = invoices.reduce((acc, i) => acc + (i.outstandingAmount || 0), 0);
  const totalReceiptsIssued = invoices.filter((i) => i.paidAmount > 0).length;

  const columns: Column<FeeInvoice>[] = [
    {
      header: "Invoice / Receipt #",
      accessorKey: "invoiceNumber",
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 700, color: "var(--primary-700)", display: "block" }}>
            {row.receiptNumber || row.invoiceNumber}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            {row.paymentDate ? new Date(row.paymentDate).toLocaleDateString("en-IN") : "—"}
          </span>
        </div>
      ),
    },
    {
      header: "Student",
      accessorKey: "student",
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 700, display: "block" }}>
            {row.student?.name || "Student"}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Adm: {row.student?.admissionNumber || "—"} | {row.student?.class || "Class"}
          </span>
        </div>
      ),
    },
    {
      header: "Amount Paid",
      accessorKey: "paidAmount",
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 800, color: "var(--success-dark)" }}>
            {formatCurrency(row.paidAmount)}
          </span>
          {row.outstandingAmount > 0 && (
            <div style={{ fontSize: "0.7rem", color: "var(--danger)" }}>
              Due: {formatCurrency(row.outstandingAmount)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Payment Mode",
      accessorKey: "paymentMode",
      cell: (row) => (
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
            background: "var(--bg-surface-hover)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <CreditCard size={11} />
          {row.paymentMode.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "paymentStatus",
      cell: (row) => {
        const isPaid = row.paymentStatus === "PAID" || row.paymentStatus === "COMPLETED";
        const isPartial = row.paymentStatus === "PARTIAL";
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.2rem 0.55rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              backgroundColor: isPaid
                ? "rgba(16, 185, 129, 0.12)"
                : isPartial
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(107, 114, 128, 0.12)",
              color: isPaid
                ? "var(--success-dark)"
                : isPartial
                  ? "var(--warning-dark)"
                  : "var(--text-secondary)",
            }}
          >
            {isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            {row.paymentStatus}
          </span>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedInvoice(row)}
            icon={<Eye size={13} />}
          >
            View Receipt
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ReceiptIcon className="text-brand" size={26} />
            Fee Invoices & Official Receipts
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Comprehensive school billing, fee heads reconciliation, official tax receipts, and payment verification
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            variant="outline"
            icon={<Filter size={15} />}
            onClick={() => fetchInvoices()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>TOTAL INVOICED</span>
            <div style={{ background: "var(--primary-50)", padding: "0.4rem", borderRadius: "8px", color: "var(--primary-600)" }}>
              <IndianRupee size={18} />
            </div>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--text-primary)" }}>
            {formatCurrency(totalInvoiced)}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Total billings raised</span>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>TOTAL COLLECTED</span>
            <div style={{ background: "var(--success-light)", padding: "0.4rem", borderRadius: "8px", color: "var(--success-dark)" }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--success-dark)" }}>
            {formatCurrency(totalCollected)}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Deposited & verified funds</span>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>OUTSTANDING DUES</span>
            <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: "0.4rem", borderRadius: "8px", color: "var(--danger)" }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--danger)" }}>
            {formatCurrency(totalOutstanding)}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Receivable balance</span>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>RECEIPTS ISSUED</span>
            <div style={{ background: "var(--teal-50)", padding: "0.4rem", borderRadius: "8px", color: "var(--teal-600)" }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--teal-700)" }}>
            {totalReceiptsIssued}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Official payment vouchers</span>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="card" style={{ padding: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
          <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Invoice #, Receipt #, Student Name, Admission No..."
            style={{ paddingLeft: "2.25rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Status:</span>
          {["ALL", "PAID", "PARTIAL", "PENDING"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.75rem",
                fontWeight: 700,
                border: "1px solid var(--border-default)",
                background: statusFilter === st ? "var(--primary-600)" : "transparent",
                color: statusFilter === st ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <DataTable
          columns={columns}
          data={filteredInvoices}
          isLoading={isLoading}
          emptyMessage="No fee invoices or receipts found matching the criteria."
        />
      </div>

      {/* Enterprise Fee Receipt & Invoice Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title={`Official Fee Receipt — ${selectedInvoice.receiptNumber || selectedInvoice.invoiceNumber}`}
          maxWidth="840px"
        >
          <div
            id="printable-invoice"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              fontFamily: "var(--font-sans)",
              color: "var(--text-primary)",
              padding: "0.5rem",
            }}
          >
            {/* Header / Letterhead */}
            <div
              style={{
                borderBottom: "2px solid var(--primary-600)",
                paddingBottom: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "var(--primary-900)" }}>
                  {selectedInvoice.school?.name || schoolName}
                </h2>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                  {selectedInvoice.school?.address ? `${selectedInvoice.school.address}, ${selectedInvoice.school.city || ""}, ${selectedInvoice.school.state || ""}` : defaultAddress}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.15rem" }}>
                  Affiliation No: <strong>{selectedInvoice.school?.affiliationNo || defaultAffiliation}</strong> | Phone: {selectedInvoice.school?.phone || defaultPhone} | Email: {selectedInvoice.school?.email || defaultEmail}
                </div>
              </div>

              <div style={{ textAlign: "right", minWidth: "160px" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "4px",
                    background: "var(--primary-50)",
                    color: "var(--primary-800)",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    border: "1px solid var(--primary-200)",
                  }}
                >
                  {receiptCopyType === "STUDENT" ? "Student Copy" : "Office Archive"}
                </span>
                <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.35rem" }}>
                  TAX INVOICE / RECEIPT
                </div>
              </div>
            </div>

            {/* Receipt Meta Strip */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "0.75rem",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface-hover)",
                fontSize: "0.85rem",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Receipt No:</span>
                <strong>{selectedInvoice.receiptNumber || selectedInvoice.invoiceNumber}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Payment Date:</span>
                <strong>{selectedInvoice.paymentDate ? new Date(selectedInvoice.paymentDate).toLocaleDateString("en-IN") : "—"}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Payment Mode:</span>
                <strong>{selectedInvoice.paymentMode.replace(/_/g, " ")}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Ref / Txn ID:</span>
                <strong>{selectedInvoice.transactionRef || selectedInvoice.chequeNumber || `TXN-${selectedInvoice.id.slice(-6).toUpperCase()}`}</strong>
              </div>
            </div>

            {/* Student Particulars */}
            <div
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "0.875rem",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                fontSize: "0.85rem",
              }}
            >
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Student Full Name:</span>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{selectedInvoice.student?.name || "Student"}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Admission Number:</span>
                <div style={{ fontWeight: 700 }}>{selectedInvoice.student?.admissionNumber || "—"}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Class & Section:</span>
                <div style={{ fontWeight: 600 }}>{selectedInvoice.student?.class || "Class Standard"}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Parent / Guardian:</span>
                <div style={{ fontWeight: 600 }}>
                  {selectedInvoice.student?.parentName || "Primary Guardian"} {selectedInvoice.student?.parentPhone ? `(${selectedInvoice.student.parentPhone})` : ""}
                </div>
              </div>
            </div>

            {/* Itemized Fee Breakdown Table */}
            <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface-hover)", borderBottom: "1px solid var(--border-default)" }}>
                    <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700, width: "40px" }}>#</th>
                    <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700 }}>Fee Particulars / Head</th>
                    <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700 }}>Billing Period</th>
                    <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 700 }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.breakdown || []).map((item, index) => (
                    <tr key={item.id || index} style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "0.55rem 0.75rem", color: "var(--text-secondary)" }}>{index + 1}</td>
                      <td style={{ padding: "0.55rem 0.75rem", fontWeight: 600 }}>{item.head}</td>
                      <td style={{ padding: "0.55rem 0.75rem", color: "var(--text-secondary)" }}>{item.period || "Annual Session"}</td>
                      <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontWeight: 600 }}>
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total & Dues Summary */}
              <div style={{ background: "var(--bg-surface-hover)", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Subtotal Fee Amount:</span>
                  <span>{formatCurrency(selectedInvoice.totalAmount)}</span>
                </div>
                {selectedInvoice.discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--success-dark)" }}>
                    <span>Concession / Scholarship:</span>
                    <span>- {formatCurrency(selectedInvoice.discountAmount)}</span>
                  </div>
                )}
                {selectedInvoice.fineAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--danger)" }}>
                    <span>Late Fine / Penalty:</span>
                    <span>+ {formatCurrency(selectedInvoice.fineAmount)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    borderTop: "2px solid var(--border-default)",
                    paddingTop: "0.5rem",
                    color: "var(--primary-900)",
                  }}
                >
                  <span>TOTAL AMOUNT PAID:</span>
                  <span style={{ color: "var(--success-dark)" }}>{formatCurrency(selectedInvoice.paidAmount)}</span>
                </div>
              </div>
            </div>

            {/* Amount in Words */}
            <div
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                fontSize: "0.85rem",
              }}
            >
              <strong style={{ color: "var(--success-dark)" }}>Amount in Words: </strong>
              <span style={{ fontStyle: "italic" }}>{numberToIndianWords(selectedInvoice.paidAmount)}</span>
            </div>

            {/* Remaining Dues Alert if Partial */}
            {selectedInvoice.outstandingAmount > 0 && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  fontSize: "0.8rem",
                  color: "var(--warning-dark)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <AlertCircle size={15} />
                <span>
                  Balance Outstanding: <strong>{formatCurrency(selectedInvoice.outstandingAmount)}</strong>. Please clear before next term exam hall-ticket release.
                </span>
              </div>
            )}

            {/* Terms and Signatures */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem", marginTop: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-default)", fontSize: "0.75rem" }}>
              <div style={{ color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text-secondary)" }}>Terms & Notes:</strong>
                <div>1. Fees once paid are non-refundable and non-transferable under any circumstances.</div>
                <div>2. Cheque/Demand Draft payments are strictly subject to final bank realization.</div>
                <div>3. Please retain this official computer-generated receipt for income tax exemption under Sec 80C.</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-end", textAlign: "center" }}>
                <div style={{ width: "160px", borderBottom: "1px solid var(--text-tertiary)", marginBottom: "0.25rem" }}></div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>Authorized Signatory / Cashier</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{selectedInvoice.school?.name || schoolName} Accounts</div>
              </div>
            </div>

            {/* Action Buttons (Hidden during Print) */}
            <div
              className="no-print"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.5rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border-default)",
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setReceiptCopyType(receiptCopyType === "STUDENT" ? "OFFICE" : "STUDENT")}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    cursor: "pointer",
                  }}
                >
                  Switch to {receiptCopyType === "STUDENT" ? "Office Copy" : "Student Copy"}
                </button>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Button
                  variant="outline"
                  icon={<Printer size={15} />}
                  onClick={() => window.print()}
                >
                  Print Official Receipt
                </Button>
                <Button variant="ghost" onClick={() => setSelectedInvoice(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
