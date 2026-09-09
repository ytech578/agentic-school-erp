"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Search, Plus, Eye, Edit, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/store/auth.store";

export default function StudentsDirectoryPage() {
  const { user } = useAuthStore();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const fetchStudents = async (search = "") => {
    setIsLoading(true);
    try {
      const response = await apiClient.get("/students", {
        params: { search, limit: 50 }
      });
      setStudents(response.data.data.items || []);
    } catch (error) {
      console.error("Failed to fetch students", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSearch = (e: React.SyntheticEvent) => {
    e.preventDefault();
    fetchStudents(searchTerm);
  };

  const handleRunRiskScoring = async () => {
    setIsLoading(true);
    try {
      await apiClient.post("/students/calculate-risk");
      await fetchStudents(searchTerm);
    } catch (error) {
      console.error("Failed to run risk scoring", error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: Column<any>[] = [
    {
      header: "Admission No",
      accessorKey: "admissionNumber",
    },
    {
      header: "Student Name",
      accessorKey: "name",
      cell: (row: any) => `${row.user?.firstName || ''} ${row.user?.lastName || ''}`,
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: (row: any) => row.user?.email || 'N/A',
    },
    {
      header: "Class",
      accessorKey: "class",
      cell: (row: any) => {
        const enrollment = row.enrollments?.[0];
        if (!enrollment) return "N/A";
        return `${enrollment.section?.class?.name} - ${enrollment.section?.name}`;
      },
    },
    {
      header: "Primary Guardian",
      accessorKey: "guardian",
      cell: (row: any) => {
        const guardian = row.guardians?.[0];
        return guardian ? `${guardian.firstName} ${guardian.lastName}` : "N/A";
      },
    },
    {
      header: "Risk Level",
      accessorKey: "riskLevel",
      cell: (row: any) => {
        const level = row.riskLevel || 'NONE';
        
        let colorClass = 'var(--text-tertiary)';
        let bgClass = 'var(--bg-elevated)';
        
        if (level === 'HIGH') {
          colorClass = 'var(--status-danger)';
          bgClass = 'var(--status-danger-muted)';
        } else if (level === 'MEDIUM') {
          colorClass = 'var(--status-warning)';
          bgClass = 'var(--status-warning-muted)';
        } else if (level === 'LOW') {
          colorClass = 'var(--status-success)';
          bgClass = 'var(--status-success-muted)';
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '0.25rem 0.5rem', 
              borderRadius: '9999px', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              color: colorClass,
              backgroundColor: bgClass,
              border: `1px solid ${colorClass}40`
            }}>
              {level}
            </span>
            {level === 'HIGH' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Score: {row.riskScore}</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "actions",
      cell: (row: any) => (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push(`/students/${row.id}`)}
          >
            <Eye size={16} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/students/${row.id}/edit`)}
          >
            <Edit size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const highRiskCount = students.filter((s: any) => s.riskLevel === 'HIGH').length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Students Directory</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Manage student records and admissions
          </p>
        </div>
        {['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(user?.role || '') && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="outline" onClick={handleRunRiskScoring}>
              <ShieldAlert size={18} style={{ marginRight: "0.5rem", color: 'var(--brand-teal)' }} />
              Run AI Risk Analysis
            </Button>
            <Button onClick={() => router.push("/students/new")}>
              <Plus size={18} style={{ marginRight: "0.5rem" }} />
              Admit Student
            </Button>
          </div>
        )}
      </div>

      {!isLoading && highRiskCount > 0 && (
        <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "var(--radius-lg)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
           <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={20} color="#ef4444" />
           </div>
           <div style={{ flex: 1 }}>
             <h4 style={{ color: "#ef4444", fontWeight: 700, margin: 0 }}>AI Risk Insights</h4>
             <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Detected <strong>{highRiskCount}</strong> student(s) at high risk of dropping out or failing. Review their profiles immediately.</p>
           </div>
           <Button variant="secondary" size="sm" onClick={() => fetchStudents('HIGH')} style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "#ef4444" }}>View At-Risk</Button>
        </div>
      )}

      <div className="card" style={{ padding: "1.5rem" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ flex: 1, maxWidth: "400px" }}>
            <Input 
              placeholder="Search by name or admission number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        <DataTable
          columns={columns}
          data={students}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
