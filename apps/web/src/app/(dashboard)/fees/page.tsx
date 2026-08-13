"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, IndianRupee } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FeesDashboardPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      // Hardcoded academic year for MVP
      const res = await apiClient.get("/fees/students?academicYearId=AY2026-27");
      setStudents(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch students fee summary", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

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

  const totalDuesAll = students.reduce((sum, s) => sum + s.outstandingDue, 0);
  const totalCollectedAll = students.reduce((sum, s) => sum + s.totalPaid, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Fee Collection</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Monitor outstanding dues and collect fee payments
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Button variant="secondary" onClick={() => router.push("/fees/structures")}>
            Manage Structures
          </Button>
        </div>
      </div>

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
