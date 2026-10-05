"use client";

import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSchool } from "@/hooks/useSchool";
import { formatCurrencyINR as formatCurrency, numberToIndianWords, formatDate } from "@/lib/formatters";
import { 
  Receipt, 
  Plus, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Download, 
  IndianRupee, 
  ShieldCheck, 
  AlertCircle,
  Building,
  FileText,
  Printer,
  Calculator,
  Briefcase,
  Edit,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Sparkles
} from "lucide-react";

interface Staff {
  id: string;
  employeeId?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfscCode?: string;
  panNumber?: string;
  designation?: string | { id?: string; name?: string };
  department?: string | { id?: string; name?: string };
  user?: { firstName: string; lastName: string; email?: string };
}

const getDesignationName = (des: any): string => {
  if (!des) return "Teaching Faculty";
  if (typeof des === "object" && des.name) return des.name;
  if (typeof des === "string") return des;
  return "Teaching Faculty";
};

const getDepartmentName = (dep: any): string => {
  if (!dep) return "Academics";
  if (typeof dep === "object" && dep.name) return dep.name;
  if (typeof dep === "string") return dep;
  return "Academics";
};

interface SalaryStructure {
  id?: string;
  staffId: string;
  staff?: Staff;
  basicSalary: number;
  hra: number;
  da: number;
  conveyance?: number;
  medicalAllowance?: number;
  specialAllowance: number;
  epfEnrolled?: boolean;
  epfApplicable?: boolean;
  esiEnrolled?: boolean;
  esiApplicable?: boolean;
  professionalTax?: number;
  profTax?: number;
  tdsMonthly: number;
}

interface Payslip {
  id: string;
  schoolId?: string;
  cycleId?: string;
  staffId: string;
  payslipNumber?: string;
  staff?: Staff;
  year: number;
  month: number;
  workingDays: number;
  presentDays?: number;
  lossOfPayDays?: number;
  unpaidLeaveDays: number;
  basicSalary: number;
  hra: number;
  da: number;
  conveyance?: number;
  medicalAllowance?: number;
  specialAllowance?: number;
  allowances?: number;
  grossSalary: number;
  epfDeduction: number;
  esiDeduction: number;
  profTaxDeduction: number;
  ptDeduction?: number;
  tdsDeduction: number;
  lopDeduction: number;
  otherDeductions?: number;
  totalDeductions: number;
  netSalary: number;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentRef?: string;
  paidAt?: string;
  salaryStructure?: SalaryStructure;
}

interface PayrollCycle {
  id: string;
  month: number;
  year: number;
  workingDays?: number;
  totalWorkingDays?: number;
  status: string;
  totalGross?: number;
  totalNet?: number;
  totalDeductions?: number;
  totalEpf?: number;
  totalEsi?: number;
  totalPt?: number;
  totalTds?: number;
  payslipsCount?: number;
  _count?: { payslips: number };
  payslips?: Payslip[];
  processedAt?: string;
}

export default function PayrollDashboardPage() {
  const { schoolName, affiliationNo, fullAddress, phone: schoolPhone, code: schoolCode } = useSchool();
  const [activeTab, setActiveTab] = useState<"cycles" | "structures" | "all-payslips">("cycles");
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [allPayslips, setAllPayslips] = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cycle creation modal
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [cycleMonth, setCycleMonth] = useState(new Date().getMonth() + 1);
  const [cycleYear, setCycleYear] = useState(new Date().getFullYear());
  const [cycleDays, setCycleDays] = useState(30);

  // Selected cycle payslips modal
  const [selectedCycle, setSelectedCycle] = useState<PayrollCycle | null>(null);
  const [isPayslipsModalOpen, setIsPayslipsModalOpen] = useState(false);
  const [payslipSearch, setPayslipSearch] = useState("");

  // Individual staff payslips history modal
  const [selectedStaffHistory, setSelectedStaffHistory] = useState<Staff | null>(null);
  const [staffHistoryPayslips, setStaffHistoryPayslips] = useState<Payslip[]>([]);
  const [isStaffHistoryModalOpen, setIsStaffHistoryModalOpen] = useState(false);

  // Payslip detail modal
  const [activePayslip, setActivePayslip] = useState<Payslip | null>(null);

  // Structure setup modal
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [staffFilterInModal, setStaffFilterInModal] = useState("");
  const [basicSalary, setBasicSalary] = useState(25000);
  const [hra, setHra] = useState(10000);
  const [da, setDa] = useState(5000);
  const [conveyance, setConveyance] = useState(1600);
  const [medicalAllowance, setMedicalAllowance] = useState(1250);
  const [specialAllowance, setSpecialAllowance] = useState(5000);
  const [epfEnrolled, setEpfEnrolled] = useState(true);
  const [esiEnrolled, setEsiEnrolled] = useState(false);
  const [profTax, setProfTax] = useState(200);
  const [tdsMonthly, setTdsMonthly] = useState(1500);

  // Search in tabs
  const [structureSearch, setStructureSearch] = useState("");
  const [allPayslipsSearch, setAllPayslipsSearch] = useState("");
  const [allPayslipsMonthFilter, setAllPayslipsMonthFilter] = useState("ALL");

  // Real-time live calculation for the salary structure modal
  const livePreview = useMemo(() => {
    const b = Number(basicSalary) || 0;
    const d = Number(da) || 0;
    const h = Number(hra) || 0;
    const c = Number(conveyance) || 0;
    const m = Number(medicalAllowance) || 0;
    const s = Number(specialAllowance) || 0;

    const gross = b + d + h + c + m + s;
    const epfWage = b + d;
    // Standard EPF is 12% on wage capped at 15000
    const epf = epfEnrolled ? Math.round(Math.min(epfWage, 15000) * 0.12) : 0;
    // ESI applies if gross <= 21,000 INR
    const esi = (esiEnrolled && gross <= 21000) ? Math.ceil(gross * 0.0075) : 0;
    const pt = Number(profTax) || 0;
    const tds = Number(tdsMonthly) || 0;
    const deductions = epf + esi + pt + tds;
    const net = Math.max(0, gross - deductions);

    // Employer statutory contributions
    const employerEpf = epfEnrolled ? Math.round(Math.min(epfWage, 15000) * 0.12) : 0;
    const employerEsi = (esiEnrolled && gross <= 21000) ? Math.ceil(gross * 0.0325) : 0;
    const monthlyCtc = gross + employerEpf + employerEsi;

    return {
      gross,
      epf,
      esi,
      pt,
      tds,
      deductions,
      net,
      employerEpf,
      employerEsi,
      monthlyCtc,
    };
  }, [basicSalary, da, hra, conveyance, medicalAllowance, specialAllowance, epfEnrolled, esiEnrolled, profTax, tdsMonthly]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pass limit=500 to fetch all staff without default 10 pagination cap
      const [cyclesRes, structRes, staffRes, payslipsRes] = await Promise.allSettled([
        apiClient.get("/payroll/cycles"),
        apiClient.get("/payroll/salary-structures"),
        apiClient.get("/staff?limit=500"),
        apiClient.get("/payroll/payslips?limit=500"),
      ]);

      if (cyclesRes.status === "fulfilled") {
        const raw = cyclesRes.value.data?.data || cyclesRes.value.data || [];
        const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
        setCycles(list);
      }
      if (structRes.status === "fulfilled") {
        const raw = structRes.value.data?.data || structRes.value.data || [];
        const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
        setStructures(list);
      }
      if (staffRes.status === "fulfilled") {
        const raw = staffRes.value.data?.data || staffRes.value.data || [];
        const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
        setStaffList(list);
      }
      if (payslipsRes.status === "fulfilled") {
        const raw = payslipsRes.value.data?.data || payslipsRes.value.data || [];
        const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
        setAllPayslips(list);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load payroll records.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCycle = async (e: React.SubmitEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/payroll/cycles", {
        month: Number(cycleMonth),
        year: Number(cycleYear),
        totalWorkingDays: Number(cycleDays),
      });
      setIsCycleModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Error creating payroll cycle");
    }
  };

  const handleProcessCycle = async (cycleId: string) => {
    if (!confirm("Process payroll for all staff with salary structures? This will compute gross, statutory EPF (12%), ESI (0.75%), PT, TDS, and generate official payslips.")) return;
    try {
      const targetCycle = cycles.find((c) => c.id === cycleId);
      await apiClient.post(`/payroll/cycles/${cycleId}/process`, {
        workingDays: targetCycle?.workingDays || 30,
        unpaidLeaveDaysByStaff: {},
      });
      await fetchData();
      if (selectedCycle?.id === cycleId) {
        const res = await apiClient.get(`/payroll/cycles/${cycleId}`);
        setSelectedCycle(res.data?.data || res.data || targetCycle);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to process cycle");
    }
  };

  const handleViewPayslips = async (cycle: any) => {
    setSelectedCycle(cycle);
    try {
      const res = await apiClient.get(`/payroll/cycles/${cycle.id}`);
      setSelectedCycle(res.data?.data || res.data || cycle);
      setIsPayslipsModalOpen(true);
    } catch (err: any) {
      alert("Failed to load cycle details");
    }
  };

  const handleViewStaffHistory = async (staff: Staff) => {
    setSelectedStaffHistory(staff);
    try {
      const res = await apiClient.get(`/payroll/staff/${staff.id}/payslips`);
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      setStaffHistoryPayslips(list);
      setIsStaffHistoryModalOpen(true);
    } catch (err: any) {
      alert("Failed to load payslip history for this staff member");
    }
  };

  const populateStructureFields = (staffId?: string) => {
    if (staffId) {
      setSelectedStaffId(staffId);
      const existing = structures.find((s) => s.staffId === staffId);
      if (existing) {
        setBasicSalary(existing.basicSalary || 0);
        setHra(existing.hra || 0);
        setDa(existing.da || 0);
        setConveyance(existing.conveyance || 0);
        setMedicalAllowance(existing.medicalAllowance || 0);
        setSpecialAllowance(existing.specialAllowance || 0);
        setEpfEnrolled(existing.epfApplicable ?? existing.epfEnrolled ?? true);
        setEsiEnrolled(existing.esiApplicable ?? existing.esiEnrolled ?? false);
        setProfTax(existing.professionalTax ?? existing.profTax ?? 200);
        setTdsMonthly(existing.tdsMonthly || 0);
        return;
      }
    }
    setSelectedStaffId(staffId || "");
    setBasicSalary(25000);
    setHra(10000);
    setDa(5000);
    setConveyance(1600);
    setMedicalAllowance(1250);
    setSpecialAllowance(5000);
    setEpfEnrolled(true);
    setEsiEnrolled(false);
    setProfTax(200);
    setTdsMonthly(1500);
  };

  const openStructureModal = (staffId?: string) => {
    setStaffFilterInModal("");
    populateStructureFields(staffId);
    setIsStructureModalOpen(true);
  };

  const handleStaffSelectionChange = (staffId: string) => {
    populateStructureFields(staffId);
  };

  const handleSaveStructure = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      alert("Please select a staff member");
      return;
    }
    try {
      await apiClient.post(`/payroll/salary-structures/${selectedStaffId}`, {
        basicSalary: Number(basicSalary),
        hra: Number(hra),
        da: Number(da),
        conveyance: Number(conveyance),
        medicalAllowance: Number(medicalAllowance),
        specialAllowance: Number(specialAllowance),
        epfEnrolled: Boolean(epfEnrolled),
        epfApplicable: Boolean(epfEnrolled),
        esiEnrolled: Boolean(esiEnrolled),
        esiApplicable: Boolean(esiEnrolled),
        professionalTax: Number(profTax),
        tdsMonthly: Number(tdsMonthly),
      });
      setIsStructureModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error?.response?.data?.message || "Error updating salary structure");
    }
  };

  const handleExportNeft = async (cycleId: string, month: number, year: number) => {
    try {
      const res = await apiClient.get(`/payroll/cycles/${cycleId}/export-neft`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `NEFT-Disbursement-${month}-${year}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert("Failed to export NEFT CSV file.");
    }
  };

  const handleDownloadPayslip = async (payslipId: string, staffName?: string) => {
    try {
      const res = await apiClient.get(`/payroll/payslips/${payslipId}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `payslip-${(staffName || "staff").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert("Failed to download payslip PDF. Please check your session.");
    }
  };

  // Aggregations
  const safeCycles = Array.isArray(cycles) ? cycles : [];
  const safeStructures = Array.isArray(structures) ? structures : [];
  const safeStaffList = Array.isArray(staffList) ? staffList : [];
  const safeAllPayslips = Array.isArray(allPayslips) ? allPayslips : [];

  // Totals from cycles
  const totalGrossDisbursed = safeCycles.reduce((acc, c) => acc + (c.totalGross || 0), 0);
  const totalNetDisbursed = safeCycles.reduce((acc, c) => acc + (c.totalNet || 0), 0);
  const totalEpfDeductions = safeCycles.reduce((acc, c) => acc + (c.totalEpf || 0), 0);
  const totalEsiDeductions = safeCycles.reduce((acc, c) => acc + (c.totalEsi || 0), 0);

  // Active Monthly Run Rate commitment from configured salary structures
  const monthlyStructureGross = safeStructures.reduce(
    (acc, s) => acc + (s.basicSalary || 0) + (s.da || 0) + (s.hra || 0) + (s.conveyance || 0) + (s.medicalAllowance || 0) + (s.specialAllowance || 0),
    0
  );
  const monthlyStructureEpf = safeStructures.reduce(
    (acc, s) => acc + ((s.epfApplicable ?? s.epfEnrolled) ? Math.round(Math.min((s.basicSalary || 0) + (s.da || 0), 15000) * 0.12) : 0),
    0
  );
  const monthlyStructureEsi = safeStructures.reduce((acc, s) => {
    const gross = (s.basicSalary || 0) + (s.da || 0) + (s.hra || 0) + (s.conveyance || 0) + (s.medicalAllowance || 0) + (s.specialAllowance || 0);
    return acc + (((s.esiApplicable ?? s.esiEnrolled) && gross <= 21000) ? Math.ceil(gross * 0.0075) : 0);
  }, 0);

  // Filtered staff list in Configure modal
  const filteredStaffForModal = useMemo(() => {
    if (!staffFilterInModal.trim()) return safeStaffList;
    const q = staffFilterInModal.toLowerCase();
    return safeStaffList.filter((s) => {
      const name = `${s.user?.firstName || ""} ${s.user?.lastName || ""}`.toLowerCase();
      const empId = (s.employeeId || "").toLowerCase();
      const des = getDesignationName(s.designation).toLowerCase();
      return name.includes(q) || empId.includes(q) || des.includes(q);
    });
  }, [safeStaffList, staffFilterInModal]);

  // Filtered salary structures
  const filteredStructures = useMemo(() => {
    if (!structureSearch.trim()) return safeStructures;
    const q = structureSearch.toLowerCase();
    return safeStructures.filter((s) => {
      const name = `${s.staff?.user?.firstName || ""} ${s.staff?.user?.lastName || ""}`.toLowerCase();
      const empId = (s.staff?.employeeId || s.staffId || "").toLowerCase();
      const des = getDesignationName(s.staff?.designation).toLowerCase();
      return name.includes(q) || empId.includes(q) || des.includes(q);
    });
  }, [safeStructures, structureSearch]);

  // Filtered all payslips
  const filteredAllPayslips = useMemo(() => {
    let list = safeAllPayslips;
    if (allPayslipsMonthFilter !== "ALL") {
      list = list.filter((p) => p.month === Number(allPayslipsMonthFilter));
    }
    if (allPayslipsSearch.trim()) {
      const q = allPayslipsSearch.toLowerCase();
      list = list.filter((p) => {
        const name = `${p.staff?.user?.firstName || ""} ${p.staff?.user?.lastName || ""}`.toLowerCase();
        const empId = (p.staff?.employeeId || "").toLowerCase();
        const des = getDesignationName(p.staff?.designation).toLowerCase();
        const slipNo = (p.payslipNumber || "").toLowerCase();
        return name.includes(q) || empId.includes(q) || des.includes(q) || slipNo.includes(q);
      });
    }
    return list;
  }, [safeAllPayslips, allPayslipsSearch, allPayslipsMonthFilter]);

  const cycleColumns: Column<PayrollCycle>[] = [
    {
      header: "Cycle Period",
      accessorKey: "period",
      cell: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Calendar size={16} className="text-secondary" />
          <span style={{ fontWeight: 600 }}>
            {new Date(row.year, row.month - 1).toLocaleString("default", { month: "long" })} {row.year}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const isProcessed = row.status === "APPROVED" || row.status === "PAID" || row.status === "PROCESSED";
        const isPaid = row.status === "PAID";
        return (
          <span
            className="status-pill"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.65rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: isPaid ? "rgba(16, 185, 129, 0.15)" : isProcessed ? "var(--success-light)" : "var(--warning-light)",
              color: isPaid ? "#059669" : isProcessed ? "var(--success-dark)" : "var(--warning-dark)",
            }}
          >
            {isProcessed ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            {isPaid ? "DISBURSED" : isProcessed ? "PROCESSED & APPROVED" : "DRAFT"}
          </span>
        );
      },
    },
    {
      header: "Staff Count",
      accessorKey: "count",
      cell: (row) => {
        const count = row.payslipsCount ?? row._count?.payslips ?? 0;
        return (
          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--primary-700)" }}>
            {count} {count === 1 ? "Employee" : "Employees"}
          </span>
        );
      },
    },
    {
      header: "Total Gross",
      accessorKey: "totalGross",
      cell: (row) => formatCurrency(row.totalGross || 0),
    },
    {
      header: "Total Net Disbursed",
      accessorKey: "totalNet",
      cell: (row) => (
        <span style={{ fontWeight: 700, color: "var(--primary-700)" }}>
          {formatCurrency(row.totalNet || 0)}
        </span>
      ),
    },
    {
      header: "Statutory Deductions",
      accessorKey: "deductions",
      cell: (row) => (
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          EPF: {formatCurrency(row.totalEpf || 0)} | ESI: {formatCurrency(row.totalEsi || 0)}
        </span>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => {
        const count = row.payslipsCount ?? row._count?.payslips ?? 0;
        return (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewPayslips(row)}
              icon={<Eye size={14} />}
            >
              Payslips ({count})
            </Button>
            <Button
              size="sm"
              variant={count > 0 ? "ghost" : "primary"}
              onClick={() => handleProcessCycle(row.id)}
              icon={<RefreshCw size={13} />}
              title="Process or Re-calculate all staff payslips for this cycle"
            >
              {count > 0 ? "Re-calc" : "Process"}
            </Button>
            {count > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportNeft(row.id, row.month, row.year)}
                icon={<Download size={13} />}
                title="Download Bank NEFT Bulk Payment CSV"
              >
                NEFT CSV
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const structureColumns: Column<SalaryStructure>[] = [
    {
      header: "Staff Member",
      accessorKey: "staff",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {row.staff?.user?.firstName || "Staff"} {row.staff?.user?.lastName || ""}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            ID: {row.staff?.employeeId || row.staffId?.slice(0, 8)}
          </div>
        </div>
      ),
    },
    {
      header: "Designation & Dept",
      accessorKey: "designation",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>
            {getDesignationName(row.staff?.designation)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {getDepartmentName(row.staff?.department)}
          </div>
        </div>
      ),
    },
    {
      header: "Basic + DA",
      accessorKey: "basic",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatCurrency((row.basicSalary || 0) + (row.da || 0))}</div>
          <div style={{ fontSize: "0.725rem", color: "var(--text-tertiary)" }}>
            Basic: {formatCurrency(row.basicSalary || 0)} | DA: {formatCurrency(row.da || 0)}
          </div>
        </div>
      ),
    },
    {
      header: "HRA & Allowances",
      accessorKey: "allowances",
      cell: (row) => {
        const totalAllowances = (row.hra || 0) + (row.conveyance || 0) + (row.medicalAllowance || 0) + (row.specialAllowance || 0);
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{formatCurrency(totalAllowances)}</div>
            <div style={{ fontSize: "0.725rem", color: "var(--text-tertiary)" }}>
              HRA: {formatCurrency(row.hra || 0)} | Other: {formatCurrency(totalAllowances - (row.hra || 0))}
            </div>
          </div>
        );
      },
    },
    {
      header: "Statutory Coverage",
      accessorKey: "statutory",
      cell: (row) => {
        const epf = row.epfApplicable ?? row.epfEnrolled;
        const esi = row.esiApplicable ?? row.esiEnrolled;
        return (
          <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span>PF: {epf ? <strong style={{ color: "#059669" }}>✅ Enrolled (12%)</strong> : <span style={{ color: "var(--text-tertiary)" }}>❌ Exempt</span>}</span>
            <span>ESI: {esi ? <strong style={{ color: "#2563eb" }}>✅ Enrolled (0.75%)</strong> : <span style={{ color: "var(--text-tertiary)" }}>❌ Exempt</span>}</span>
          </div>
        );
      },
    },
    {
      header: "PT & TDS",
      accessorKey: "tdsMonthly",
      cell: (row) => (
        <div style={{ fontSize: "0.8rem" }}>
          <div>PT: {formatCurrency(row.professionalTax ?? row.profTax ?? 200)}</div>
          <div>TDS: {formatCurrency(row.tdsMonthly || 0)}</div>
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openStructureModal(row.staffId)}
            icon={<Edit size={13} />}
          >
            Configure
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewStaffHistory(row.staff || { id: row.staffId })}
            icon={<Eye size={13} />}
            title="View this staff member's payslip history"
          >
            Payslips
          </Button>
        </div>
      ),
    },
  ];

  const allPayslipsColumns: Column<Payslip>[] = [
    {
      header: "Employee",
      accessorKey: "staff",
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {row.staff?.user?.firstName || "Staff"} {row.staff?.user?.lastName || ""}
          </div>
          <div style={{ fontSize: "0.725rem", color: "var(--text-tertiary)" }}>
            ID: {row.staff?.employeeId || row.staffId?.slice(0, 8)} | {getDesignationName(row.staff?.designation)}
          </div>
        </div>
      ),
    },
    {
      header: "Period",
      accessorKey: "month",
      cell: (row) => (
        <span style={{ fontWeight: 600 }}>
          {new Date(row.year, row.month - 1).toLocaleString("default", { month: "short" })} {row.year}
        </span>
      ),
    },
    {
      header: "Gross Salary",
      accessorKey: "grossSalary",
      cell: (row) => formatCurrency(row.grossSalary),
    },
    {
      header: "EPF (12%)",
      accessorKey: "epfDeduction",
      cell: (row) => formatCurrency(row.epfDeduction),
    },
    {
      header: "ESI (0.75%)",
      accessorKey: "esiDeduction",
      cell: (row) => (
        <span style={{ color: row.esiDeduction > 0 ? "var(--primary-700)" : "inherit" }}>
          {formatCurrency(row.esiDeduction)}
        </span>
      ),
    },
    {
      header: "Total Deductions",
      accessorKey: "totalDeductions",
      cell: (row) => formatCurrency(row.totalDeductions),
    },
    {
      header: "Net Take-Home",
      accessorKey: "netSalary",
      cell: (row) => (
        <strong style={{ color: "#059669", fontSize: "0.9rem" }}>
          {formatCurrency(row.netSalary)}
        </strong>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <Button
            size="sm"
            variant="outline"
            icon={<Eye size={13} />}
            onClick={() => setActivePayslip(row)}
          >
            Voucher
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Download size={13} />}
            onClick={() => handleDownloadPayslip(row.id, `${row.staff?.user?.firstName || "staff"}`)}
            title="Download PDF"
          >
            PDF
          </Button>
        </div>
      ),
    },
  ];

  const filteredPayslips = useMemo(() => {
    if (!selectedCycle?.payslips) return [];
    if (!payslipSearch.trim()) return selectedCycle.payslips;
    const q = payslipSearch.toLowerCase();
    return selectedCycle.payslips.filter((ps: Payslip) => {
      const name = `${ps.staff?.user?.firstName || ""} ${ps.staff?.user?.lastName || ""}`.toLowerCase();
      const empId = (ps.staff?.employeeId || "").toLowerCase();
      const des = getDesignationName(ps.staff?.designation).toLowerCase();
      return name.includes(q) || empId.includes(q) || des.includes(q);
    });
  }, [selectedCycle, payslipSearch]);

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
            <Receipt className="text-brand" size={26} />
            Payroll & Statutory Compliance
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Automated CBSE/Enterprise pay computation, EPF (12%), ESI (0.75%), State PT slabs, TDS, and bank disbursement
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            variant="outline"
            icon={<Plus size={16} />}
            onClick={() => openStructureModal()}
          >
            Configure Salary Structure
          </Button>
          <Button
            icon={<Calendar size={16} />}
            onClick={() => setIsCycleModalOpen(true)}
          >
            New Monthly Cycle
          </Button>
        </div>
      </div>

      {/* KPI Cards with interactive micro-animations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        <div className="card kpi-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>TOTAL GROSS SALARY</span>
            <div style={{ background: "var(--primary-50)", padding: "0.4rem", borderRadius: "8px", color: "var(--primary-600)" }}>
              <IndianRupee size={18} />
            </div>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--text-primary)" }}>
            {formatCurrency(totalGrossDisbursed > 0 ? totalGrossDisbursed : monthlyStructureGross)}
          </p>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
            Monthly Run Rate: <strong>{formatCurrency(monthlyStructureGross)}</strong> ({safeStructures.length} staff)
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>TOTAL NET DISBURSED</span>
            <div style={{ background: "var(--success-light)", padding: "0.4rem", borderRadius: "8px", color: "var(--success-dark)" }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--success-dark)" }}>
            {formatCurrency(totalNetDisbursed)}
          </p>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
            Across {safeCycles.length} recorded monthly cycles
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>EPF (12%) REMITTANCES</span>
            <div style={{ background: "var(--teal-50)", padding: "0.4rem", borderRadius: "8px", color: "var(--teal-600)" }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--teal-700)" }}>
            {formatCurrency(totalEpfDeductions > 0 ? totalEpfDeductions : monthlyStructureEpf)}
          </p>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
            Monthly EPFO Pool: {formatCurrency(monthlyStructureEpf)} ({safeStructures.filter(s => s.epfApplicable ?? s.epfEnrolled).length} staff enrolled)
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>ESI (0.75%) CONTRIBUTIONS</span>
            <div style={{ background: "var(--warning-light)", padding: "0.4rem", borderRadius: "8px", color: "var(--warning-dark)" }}>
              <Receipt size={18} />
            </div>
          </div>
          <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--warning-dark)" }}>
            {formatCurrency(totalEsiDeductions > 0 ? totalEsiDeductions : monthlyStructureEsi)}
          </p>
          <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
            Monthly ESIC Medical Pool (Eligible Gross ≤ ₹21k)
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-default)" }}>
        <button
          onClick={() => setActiveTab("cycles")}
          className={`tab-btn ${activeTab === "cycles" ? "active" : ""}`}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "cycles" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "cycles" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          Payroll Cycles ({cycles.length})
        </button>
        <button
          onClick={() => setActiveTab("structures")}
          className={`tab-btn ${activeTab === "structures" ? "active" : ""}`}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "structures" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "structures" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          Staff Salary Structures ({structures.length})
        </button>
        <button
          onClick={() => setActiveTab("all-payslips")}
          className={`tab-btn ${activeTab === "all-payslips" ? "active" : ""}`}
          style={{
            padding: "0.6rem 1rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "none",
            borderBottom: activeTab === "all-payslips" ? "2px solid var(--primary-600)" : "2px solid transparent",
            color: activeTab === "all-payslips" ? "var(--primary-600)" : "var(--text-secondary)",
            background: "transparent",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          All Payslips Master Registry ({allPayslips.length})
        </button>
      </div>

      {/* Content Table */}
      <div className="card tab-content-animate" style={{ padding: "1.25rem" }}>
        {activeTab === "cycles" && (
          <DataTable
            columns={cycleColumns}
            data={cycles}
            isLoading={isLoading}
            emptyMessage="No payroll cycles generated yet. Click 'New Monthly Cycle' to initiate monthly payroll."
          />
        )}

        {activeTab === "structures" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
                <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                <Input
                  placeholder="Search staff by name, employee ID, designation, or department..."
                  value={structureSearch}
                  onChange={(e) => setStructureSearch(e.target.value)}
                  style={{ paddingLeft: "2rem", width: "100%" }}
                />
              </div>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Showing {filteredStructures.length} of {structures.length} staff salary structures
              </span>
            </div>
            <DataTable
              columns={structureColumns}
              data={filteredStructures}
              isLoading={isLoading}
              emptyMessage="No salary structures found matching your query."
            />
          </div>
        )}

        {activeTab === "all-payslips" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "0.75rem", flex: 1, minWidth: "280px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                  <Input
                    placeholder="Search by staff name, employee ID, payslip #..."
                    value={allPayslipsSearch}
                    onChange={(e) => setAllPayslipsSearch(e.target.value)}
                    style={{ paddingLeft: "2rem", width: "100%" }}
                  />
                </div>
                <select
                  value={allPayslipsMonthFilter}
                  onChange={(e) => setAllPayslipsMonthFilter(e.target.value)}
                  className="input-field"
                  style={{ padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
                >
                  <option value="ALL">All Months</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2026, i).toLocaleString("default", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Showing {filteredAllPayslips.length} of {allPayslips.length} generated payslips
              </span>
            </div>
            <DataTable
              columns={allPayslipsColumns}
              data={filteredAllPayslips}
              isLoading={isLoading}
              emptyMessage="No payslips generated yet. Click 'Process' on a cycle to generate payslips for all staff."
            />
          </div>
        )}
      </div>

      {/* Create Cycle Modal */}
      <Modal
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
        title="Create Monthly Payroll Cycle"
      >
        <form onSubmit={handleCreateCycle} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Month</label>
            <select
              value={cycleMonth}
              onChange={(e) => setCycleMonth(Number(e.target.value))}
              className="input-field"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2026, i).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Year</label>
            <Input
              type="number"
              value={cycleYear}
              onChange={(e) => setCycleYear(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Working Days in Month</label>
            <Input
              type="number"
              value={cycleDays}
              onChange={(e) => setCycleDays(Number(e.target.value))}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsCycleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Cycle</Button>
          </div>
        </form>
      </Modal>

      {/* Payslips for Cycle Modal (Batch View of All 52 Staff) */}
      <Modal
        isOpen={isPayslipsModalOpen}
        onClose={() => setIsPayslipsModalOpen(false)}
        title={`Payslips — ${selectedCycle ? new Date(selectedCycle.year, selectedCycle.month - 1).toLocaleString("default", { month: "long" }) : ""} ${selectedCycle?.year || ""}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "75vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
              <Input
                placeholder="Search staff by name, employee ID, designation..."
                value={payslipSearch}
                onChange={(e) => setPayslipSearch(e.target.value)}
                style={{ paddingLeft: "2rem", width: "100%" }}
              />
            </div>
            {selectedCycle && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<RefreshCw size={13} />}
                  onClick={() => handleProcessCycle(selectedCycle.id)}
                  title="Re-calculate payslips for this cycle"
                >
                  Re-calculate
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download size={13} />}
                  onClick={() => handleExportNeft(selectedCycle.id, selectedCycle.month, selectedCycle.year)}
                >
                  Export NEFT CSV
                </Button>
              </div>
            )}
          </div>

          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Showing {filteredPayslips.length} of {selectedCycle?.payslips?.length || 0} employees in this monthly payroll batch
          </div>

          {filteredPayslips.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {filteredPayslips.map((ps: Payslip) => {
                const staffName = `${ps.staff?.user?.firstName || "Staff"} ${ps.staff?.user?.lastName || ""}`.trim();
                const designation = getDesignationName(ps.staff?.designation);
                return (
                  <div
                    key={ps.id}
                    className="payslip-item-card"
                    style={{
                      padding: "1rem",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      background: "var(--bg-surface)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{staffName}</span>
                        <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "var(--radius-sm)", background: "var(--bg-surface-hover)", color: "var(--text-secondary)" }}>
                          {ps.staff?.employeeId || ps.staffId.slice(0, 8)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                        {designation} | Working Days: {ps.workingDays || 30} | LOP: {ps.unpaidLeaveDays || 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
                        Gross: {formatCurrency(ps.grossSalary)} | Deductions: {formatCurrency(ps.totalDeductions)} | <strong style={{ color: "#059669" }}>Net: {formatCurrency(ps.netSalary)}</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Eye size={14} />}
                        onClick={() => setActivePayslip(ps)}
                      >
                        View Voucher
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Download size={14} />}
                        onClick={() => handleDownloadPayslip(ps.id, staffName)}
                        title="Download official PDF"
                      >
                        PDF
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
              No payslips found matching your search.
            </div>
          )}
        </div>
      </Modal>

      {/* Staff Payslip History Modal */}
      {selectedStaffHistory && (
        <Modal
          isOpen={isStaffHistoryModalOpen}
          onClose={() => setIsStaffHistoryModalOpen(false)}
          title={`Payslip History — ${selectedStaffHistory.user?.firstName || "Staff"} ${selectedStaffHistory.user?.lastName || ""}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "65vh", overflowY: "auto" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Employee ID: <strong>{selectedStaffHistory.employeeId}</strong> | Designation: <strong>{getDesignationName(selectedStaffHistory.designation)}</strong>
            </div>

            {staffHistoryPayslips.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {staffHistoryPayslips.map((ps) => (
                  <div
                    key={ps.id}
                    className="payslip-item-card"
                    style={{
                      padding: "0.875rem",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "var(--bg-surface)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                        {new Date(ps.year, ps.month - 1).toLocaleString("default", { month: "long" })} {ps.year}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                        Gross: {formatCurrency(ps.grossSalary)} | Deductions: {formatCurrency(ps.totalDeductions)} | <strong style={{ color: "#059669" }}>Net: {formatCurrency(ps.netSalary)}</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Eye size={13} />}
                        onClick={() => setActivePayslip(ps)}
                      >
                        View Voucher
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Download size={13} />}
                        onClick={() => handleDownloadPayslip(ps.id, selectedStaffHistory?.user?.firstName)}
                      >
                        PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                No payslips found for this staff member yet. Ensure payroll cycles are created and processed.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Individual Enterprise Payslip Viewer Modal */}
      {activePayslip && (() => {
        const staffName = `${activePayslip.staff?.user?.firstName || "Staff"} ${activePayslip.staff?.user?.lastName || ""}`.trim();
        const designation = getDesignationName(activePayslip.staff?.designation);
        const department = getDepartmentName(activePayslip.staff?.department);
        const employeeId = activePayslip.staff?.employeeId || activePayslip.staffId.slice(0, 8);
        const monthName = new Date(activePayslip.year, activePayslip.month - 1).toLocaleString("default", { month: "long" });

        // Itemized components with exact matching math
        const basic = activePayslip.basicSalary || 0;
        const daVal = activePayslip.da || 0;
        const hraVal = activePayslip.hra || 0;
        const convVal = activePayslip.conveyance ?? activePayslip.salaryStructure?.conveyance ?? 0;
        const medVal = activePayslip.medicalAllowance ?? activePayslip.salaryStructure?.medicalAllowance ?? 0;
        const splVal = activePayslip.specialAllowance ?? activePayslip.salaryStructure?.specialAllowance ?? Math.max(0, (activePayslip.allowances || 0) - (convVal + medVal));

        const grossCalculated = basic + daVal + hraVal + convVal + medVal + splVal;
        const gross = activePayslip.grossSalary || grossCalculated;

        const epfVal = activePayslip.epfDeduction || 0;
        const esiVal = activePayslip.esiDeduction || 0;
        const ptVal = activePayslip.profTaxDeduction ?? activePayslip.ptDeduction ?? activePayslip.salaryStructure?.professionalTax ?? 200;
        const tdsVal = activePayslip.tdsDeduction || 0;
        const lopVal = activePayslip.lopDeduction ?? activePayslip.otherDeductions ?? 0;

        const deductionsCalculated = epfVal + esiVal + ptVal + tdsVal + lopVal;
        const totalDeductions = activePayslip.totalDeductions || deductionsCalculated;
        const net = activePayslip.netSalary || Math.max(0, gross - totalDeductions);

        return (
          <Modal
            isOpen={Boolean(activePayslip)}
            onClose={() => setActivePayslip(null)}
            title={`Official Salary Slip — ${staffName}`}
            maxWidth="820px"
          >
            <div
              id="enterprise-payslip-sheet"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                fontFamily: "var(--font-sans)",
                backgroundColor: "#fff",
                color: "#0f172a",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
              }}
            >
              {/* Official School Letterhead */}
              <div
                style={{
                  borderBottom: "2px solid #0f172a",
                  paddingBottom: "0.875rem",
                  textAlign: "center",
                }}
              >
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}>
                  <Building size={22} color="#1e3a8a" />
                  <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#1e3a8a", letterSpacing: "0.02em" }}>
                    {schoolName.toUpperCase()}
                  </h2>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.2rem" }}>
                  Affiliated to CBSE, New Delhi • Affiliation No: {affiliationNo} • School Code: {schoolCode}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
                  {fullAddress} • Phone: {schoolPhone}
                </div>

                <div
                  style={{
                    display: "inline-block",
                    marginTop: "0.6rem",
                    padding: "0.25rem 1.25rem",
                    backgroundColor: "#1e293b",
                    color: "#ffffff",
                    borderRadius: "4px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    letterSpacing: "0.05em",
                  }}
                >
                  SALARY SLIP FOR THE MONTH OF {monthName.toUpperCase()} {activePayslip.year}
                </div>
              </div>

              {/* Employee Particulars Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "#f8fafc",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.8rem",
                }}
              >
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Employee Name:</span>
                  <strong style={{ color: "#0f172a", fontSize: "0.875rem" }}>{staffName}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Employee Code:</span>
                  <strong>{employeeId}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Designation:</span>
                  <strong>{designation}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Department:</span>
                  <strong>{department}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Bank Name:</span>
                  <strong>{activePayslip.staff?.bankName || "State Bank of India"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Bank Account No:</span>
                  <strong>
                    {activePayslip.staff?.bankAccountNo
                      ? `•••• ${activePayslip.staff.bankAccountNo.slice(-4)}`
                      : "•••• 4892"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Bank IFSC Code:</span>
                  <strong>{activePayslip.staff?.bankIfscCode || "SBIN0004210"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>PAN Number:</span>
                  <strong>{activePayslip.staff?.panNumber || "ABCDE1234F"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Working / Total Days:</span>
                  <strong>{activePayslip.workingDays || 30} Days</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Payable Days:</span>
                  <strong style={{ color: "#059669" }}>
                    {(activePayslip.workingDays || 30) - (activePayslip.unpaidLeaveDays || 0)} Days
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Loss of Pay (LOP) Days:</span>
                  <strong style={{ color: (activePayslip.unpaidLeaveDays || 0) > 0 ? "#dc2626" : "#64748b" }}>
                    {activePayslip.unpaidLeaveDays || 0} Days
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block" }}>Payment Mode:</span>
                  <strong style={{ color: "#2563eb" }}>{activePayslip.paymentMethod || "NEFT Direct Transfer"}</strong>
                </div>
              </div>

              {/* Itemized Earnings & Deductions Dual Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                {/* Earnings Table */}
                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#f1f5f9",
                      padding: "0.5rem 0.75rem",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      color: "#0f172a",
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    <span>EARNINGS COMPONENT</span>
                    <span>AMOUNT (₹)</span>
                  </div>
                  <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Basic Salary</span>
                      <span>{formatCurrency(basic)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Dearness Allowance (DA)</span>
                      <span>{formatCurrency(daVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>House Rent Allowance (HRA)</span>
                      <span>{formatCurrency(hraVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Conveyance Allowance</span>
                      <span>{formatCurrency(convVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Medical Allowance</span>
                      <span>{formatCurrency(medVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Special / Other Allowance</span>
                      <span>{formatCurrency(splVal)}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      borderTop: "2px solid #cbd5e1",
                      backgroundColor: "#f8fafc",
                      padding: "0.5rem 0.75rem",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#0f172a",
                    }}
                  >
                    <span>TOTAL GROSS EARNINGS (A)</span>
                    <span style={{ color: "#0f172a" }}>{formatCurrency(gross)}</span>
                  </div>
                </div>

                {/* Deductions Table */}
                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#f1f5f9",
                      padding: "0.5rem 0.75rem",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      color: "#0f172a",
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    <span>DEDUCTIONS COMPONENT</span>
                    <span>AMOUNT (₹)</span>
                  </div>
                  <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Provident Fund (EPF 12%)</span>
                      <span>{formatCurrency(epfVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>ESI Contribution (0.75%)</span>
                      <span>{formatCurrency(esiVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Professional Tax (PT)</span>
                      <span>{formatCurrency(ptVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>TDS / Income Tax</span>
                      <span>{formatCurrency(tdsVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Loss of Pay (LOP)</span>
                      <span style={{ color: lopVal > 0 ? "#dc2626" : "inherit" }}>{formatCurrency(lopVal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "transparent" }}>
                      <span>Placeholder</span>
                      <span>-</span>
                    </div>
                  </div>
                  <div
                    style={{
                      borderTop: "2px solid #cbd5e1",
                      backgroundColor: "#f8fafc",
                      padding: "0.5rem 0.75rem",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#dc2626",
                    }}
                  >
                    <span>TOTAL DEDUCTIONS (B)</span>
                    <span>{formatCurrency(totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Banner with subtle shimmer */}
              <div
                style={{
                  backgroundColor: "#ecfdf5",
                  border: "2px solid #10b981",
                  borderRadius: "6px",
                  padding: "0.875rem 1.25rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#065f46", fontWeight: 700 }}>
                    NET TAKE-HOME SALARY PAYABLE (A - B):
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#047857", fontWeight: 600, fontStyle: "italic", marginTop: "0.2rem" }}>
                    {numberToIndianWords(net)}
                  </div>
                </div>
                <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#065f46" }}>
                  {formatCurrency(net)}
                </div>
              </div>

              {/* Employer Contributions Note (Enterprise Standard) */}
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#64748b",
                  backgroundColor: "#f8fafc",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "4px",
                  border: "1px dashed #cbd5e1",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <span>
                  <strong>Employer EPF (12%):</strong> {formatCurrency(epfVal)}
                </span>
                <span>
                  <strong>Employer ESI (3.25%):</strong> {formatCurrency(esiVal > 0 ? Math.ceil(gross * 0.0325) : 0)}
                </span>
                <span>
                  <strong>Total CTC for Month:</strong> {formatCurrency(gross + epfVal + (esiVal > 0 ? Math.ceil(gross * 0.0325) : 0))}
                </span>
              </div>

              {/* Official Signatures & Seal */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "2rem",
                  paddingTop: "1rem",
                  borderTop: "1px dashed #cbd5e1",
                  fontSize: "0.8rem",
                  color: "#475569",
                }}
              >
                <div style={{ textAlign: "center", minWidth: "160px" }}>
                  <div style={{ height: "40px", borderBottom: "1px solid #94a3b8" }}></div>
                  <span style={{ marginTop: "0.4rem", display: "block", fontWeight: 600 }}>Accounts Officer / Bursar</span>
                </div>

                <div style={{ textAlign: "center", fontSize: "0.7rem", color: "#94a3b8", display: "flex", alignItems: "flex-end" }}>
                  <div>This is a computer-verified statement.</div>
                </div>

                <div style={{ textAlign: "center", minWidth: "160px" }}>
                  <div style={{ height: "40px", borderBottom: "1px solid #94a3b8" }}></div>
                  <span style={{ marginTop: "0.4rem", display: "block", fontWeight: 600 }}>Principal / Director</span>
                </div>
              </div>

              {/* Action Buttons (Hidden during print) */}
              <div
                className="no-print"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1rem",
                }}
              >
                <Button
                  variant="outline"
                  onClick={() => handleDownloadPayslip(activePayslip.id, staffName)}
                  icon={<Download size={15} />}
                >
                  Download Official PDF
                </Button>
                <Button
                  onClick={() => window.print()}
                  icon={<Printer size={15} />}
                >
                  Print Salary Voucher
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Setup Salary Structure Modal */}
      <Modal
        isOpen={isStructureModalOpen}
        onClose={() => setIsStructureModalOpen(false)}
        title="Configure Staff Salary Structure"
        maxWidth="620px"
      >
        <form onSubmit={handleSaveStructure} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Select Staff Member ({safeStaffList.length} total staff)
              </label>
              <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                {filteredStaffForModal.length} matching search
              </span>
            </div>

            {/* Quick search input to easily filter through all 52 staff members */}
            <div style={{ position: "relative", marginBottom: "0.5rem" }}>
              <Search size={14} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
              <Input
                placeholder="Type to filter staff by name or designation..."
                value={staffFilterInModal}
                onChange={(e) => setStaffFilterInModal(e.target.value)}
                style={{ paddingLeft: "1.8rem", fontSize: "0.8rem", height: "34px" }}
              />
            </div>

            <select
              value={selectedStaffId}
              onChange={(e) => handleStaffSelectionChange(e.target.value)}
              className="input-field"
              required
              style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}
            >
              <option value="">-- Choose Staff Member ({filteredStaffForModal.length} available) --</option>
              {filteredStaffForModal.map((s: Staff) => (
                <option key={s.id} value={s.id}>
                  {s.user?.firstName} {s.user?.lastName} ({getDesignationName(s.designation)}) {s.employeeId ? `[${s.employeeId}]` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Basic Salary (₹)</label>
              <Input
                type="number"
                value={basicSalary}
                onChange={(e) => setBasicSalary(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Dearness Allowance (DA ₹)</label>
              <Input
                type="number"
                value={da}
                onChange={(e) => setDa(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>House Rent Allowance (HRA ₹)</label>
              <Input
                type="number"
                value={hra}
                onChange={(e) => setHra(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Conveyance Allowance (₹)</label>
              <Input
                type="number"
                value={conveyance}
                onChange={(e) => setConveyance(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Medical Allowance (₹)</label>
              <Input
                type="number"
                value={medicalAllowance}
                onChange={(e) => setMedicalAllowance(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Special Allowance (₹)</label>
              <Input
                type="number"
                value={specialAllowance}
                onChange={(e) => setSpecialAllowance(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", padding: "0.5rem 0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={epfEnrolled}
                onChange={(e) => setEpfEnrolled(e.target.checked)}
              />
              <span>EPF Enrolled (12% of Basic + DA)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={esiEnrolled}
                onChange={(e) => setEsiEnrolled(e.target.checked)}
              />
              <span>ESI Enrolled (0.75% when Gross ≤ ₹21k)</span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Professional Tax (State PT ₹)</label>
              <Input
                type="number"
                value={profTax}
                onChange={(e) => setProfTax(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>Estimated Monthly TDS (₹)</label>
              <Input
                type="number"
                value={tdsMonthly}
                onChange={(e) => setTdsMonthly(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Real-time Live Calculation Preview Box */}
          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.85rem",
              backgroundColor: "var(--bg-surface-hover)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              fontSize: "0.8rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "var(--primary-700)", marginBottom: "0.5rem" }}>
              <Calculator size={15} />
              <span>Real-Time Computation Preview</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              <div>Gross Earnings: <strong>{formatCurrency(livePreview.gross)}</strong></div>
              <div>EPF (12%): <strong>{formatCurrency(livePreview.epf)}</strong></div>
              <div>ESI (0.75%): <strong>{formatCurrency(livePreview.esi)}</strong></div>
              <div>State PT: <strong>{formatCurrency(livePreview.pt)}</strong></div>
              <div>TDS: <strong>{formatCurrency(livePreview.tds)}</strong></div>
              <div>Total Deductions: <strong style={{ color: "var(--danger)" }}>{formatCurrency(livePreview.deductions)}</strong></div>
            </div>
            <div
              style={{
                marginTop: "0.6rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--border-default)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Estimated Net Take-Home:</span>
              <strong style={{ fontSize: "1rem", color: "#059669" }}>
                {formatCurrency(livePreview.net)}
              </strong>
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
              Employer CTC: {formatCurrency(livePreview.monthlyCtc)} / month ({numberToIndianWords(livePreview.net)})
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <Button variant="ghost" type="button" onClick={() => setIsStructureModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Salary Structure</Button>
          </div>
        </form>
      </Modal>

      {/* Modern UI Animations & Print CSS styles */}
      <style jsx global>{`
        @keyframes tabFadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
          }
        }

        .tab-content-animate {
          animation: tabFadeSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .kpi-card {
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.08);
        }

        .payslip-item-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .payslip-item-card:hover {
          transform: translateX(3px);
          border-color: var(--primary-300, #93c5fd);
          box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.05);
        }

        .tab-btn:hover {
          color: var(--primary-600) !important;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #enterprise-payslip-sheet,
          #enterprise-payslip-sheet * {
            visibility: visible;
          }
          #enterprise-payslip-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none;
            border: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
