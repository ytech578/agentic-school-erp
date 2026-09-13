"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, IndianRupee, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AlertTriangle } from "lucide-react";
import { formatCurrencyINR as formatCurrency } from "@/lib/formatters";
import { useAuthStore } from "@/store/auth.store";

export default function FeesDashboardPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [cashFlow, setCashFlow] = useState<any[]>([]);
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user?.role === "PARENT") {
      router.replace("/parent-fees");
      return;
    } else if (user?.role && !["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(user.role)) {
      router.replace("/dashboard");
      return;
    }
  }, [user, router]);

  // Load academic years on mount
  useEffect(() => {
    const loadAcademicYears = async () => {
      try {
        const res = await apiClient.get("/schools/academic-years");
        const years = res.data?.data || res.data || [];
        setAcademicYears(years);
        const active = years.find((y: any) => y.isActive) || years[0];
        if (active) {
          setSelectedYearId(active.id);
        }
      } catch (err) {
        console.error("Failed to load academic years", err);
      }
    };
    loadAcademicYears();
  }, []);

  useEffect(() => {
    fetchStudents(selectedYearId);
  }, [selectedYearId]);

  const fetchStudents = async (yearId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParam = yearId ? `?academicYearId=${encodeURIComponent(yearId)}` : "";
      const [studentsRes, cashRes, defRes] = await Promise.all([
        apiClient.get(`/fees/students${queryParam}`),
        apiClient.get(`/fees/analytics${queryParam}`),
        apiClient.get(`/fees/defaulters${queryParam}`),
      ]);
      setStudents(studentsRes.data?.data || studentsRes.data || []);
      setCashFlow(cashRes.data?.data || cashRes.data || []);
      setDefaulters(defRes.data?.data || defRes.data || []);
    } catch (err: any) {
      console.error("Failed to fetch students fee summary", err);
      setError(err?.response?.data?.message || "Failed to fetch fee collection summary. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      (s.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.lastName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.admissionNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.class || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<any>[] = [
    {
      header: "Adm No",
      accessorKey: "admissionNumber",
    },
    {
      header: "Student Name",
      accessorKey: "name",
      cell: (row: any) => `${row.firstName} ${row.lastName}`,
    },
    {
      header: "Class",
      accessorKey: "class",
    },
    {
      header: "Total Fee",
      accessorKey: "totalFee",
      cell: (row: any) => formatCurrency(row.totalFee),
    },
    {
      header: "Paid",
      accessorKey: "totalPaid",
      cell: (row: any) => (
        <span style={{ color: row.totalPaid > 0 ? "var(--success)" : "inherit" }}>
          {formatCurrency(row.totalPaid)}
        </span>
      ),
    },
    {
      header: "Dues",
      accessorKey: "outstandingDue",
      cell: (row: any) => (
        <span style={{ color: row.outstandingDue > 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
          {formatCurrency(row.outstandingDue)}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "feeStatus",
      cell: (row: any) => {
        const due = row.outstandingDue;
        const paid = row.totalPaid;
        const total = row.totalFee;
        let status: { label: string; bg: string; color: string };
        if (due <= 0) {
          status = { label: "Paid", bg: "rgba(16, 185, 129, 0.12)", color: "#059669" };
        } else if (paid > 0) {
          status = { label: "Partial", bg: "rgba(245, 158, 11, 0.12)", color: "#D97706" };
        } else {
          status = { label: "Overdue", bg: "rgba(239, 68, 68, 0.12)", color: "#DC2626" };
        }
        return (
          <span style={{ padding: "0.2rem 0.625rem", borderRadius: "var(--radius-full)", fontSize: "11px", fontWeight: 700, background: status.bg, color: status.color }}>
            {status.label}
          </span>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "actions",
      cell: (row: any) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/fees/collect/${row.id}`)}
          disabled={row.outstandingDue <= 0}
        >
          <IndianRupee size={14} style={{ marginRight: "0.25rem" }} />
          {row.outstandingDue <= 0 ? "Paid" : "Collect"}
        </Button>
      ),
    },
  ];

  const totalDuesAll = students.reduce((sum, s) => sum + Number(s.outstandingDue || 0), 0);
  const totalCollectedAll = students.reduce((sum, s) => sum + Number(s.totalPaid || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Fee Collection</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Monitor outstanding dues and collect fee payments
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {academicYears.length > 0 && (
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="input"
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
              }}
            >
              {academicYears.map((ay: any) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isActive ? "(Active)" : ""}
                </option>
              ))}
            </select>
          )}
          <Button variant="secondary" onClick={() => router.push("/fees/structures")}>
            Manage Structures
          </Button>
          <Button variant="outline" onClick={() => router.push("/fees/settings")}>
            <QrCode size={16} style={{ marginRight: "0.35rem" }} />
            Payment Gateway & QR
          </Button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "var(--danger, #ef4444)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => fetchStudents(selectedYearId)}>
            Retry
          </Button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div className="card" style={{ padding: "1.5rem", borderLeft: "4px solid var(--success)" }}>
          <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Total Collected (Year)</h3>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(totalCollectedAll)}</p>
        </div>
        <div className="card" style={{ padding: "1.5rem", borderLeft: "4px solid var(--danger)" }}>
          <h3 style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Total Outstanding</h3>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{formatCurrency(totalDuesAll)}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Cash Flow Chart */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <h3 className="text-lg font-semibold mb-4">Cash Flow (Collections)</h3>
          <div style={{ height: "250px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="var(--text-secondary)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `₹${val/1000}k`}
                />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="collected" stroke="var(--primary)" fillOpacity={1} fill="url(#colorCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Defaulter Prediction */}
        <div className="card" style={{ padding: "1.5rem", border: "1px solid var(--warning-border)", background: "var(--warning-bg)" }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-warning" size={20} />
            <h3 className="text-lg font-semibold text-warning">AI Defaulter Risk</h3>
          </div>
          <p className="text-sm text-secondary mb-4">
            Families with highest predicted risk of missing next payment based on history and behaviors.
          </p>
          <div className="space-y-3">
            {defaulters.length === 0 ? (
              <p className="text-sm text-secondary">No high risk students detected.</p>
            ) : (
              defaulters.slice(0, 5).map((def) => (
                <div key={def.id} className="flex justify-between items-center p-3 bg-background rounded-md border border-border">
                  <div>
                    <div className="font-medium">{def.firstName} {def.lastName}</div>
                    <div className="text-xs text-secondary">{def.class} • Due: {formatCurrency(def.outstandingDue)}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${
                    def.riskLevel === 'High' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                  }`}>
                    {def.defaultProbability}% Risk
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div style={{ width: "300px" }}>
            <Input 
              placeholder="Search students..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
        </div>
        
        <DataTable data={filteredStudents} columns={columns} isLoading={isLoading} />
      </div>
    </div>
  );
}
