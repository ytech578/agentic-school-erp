"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";

export default function StudentsDirectoryPage() {
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents(searchTerm);
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
      header: "Primary Guardian",
      accessorKey: "guardian",
      cell: (row: any) => {
        const guardian = row.guardians?.[0];
        return guardian ? `${guardian.firstName} ${guardian.lastName}` : "N/A";
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
          <Button variant="ghost" size="sm">
            <Edit size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Students Directory</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Manage student records and admissions
          </p>
        </div>
        <Button onClick={() => router.push("/students/new")}>
          <Plus size={18} style={{ marginRight: "0.5rem" }} />
          Admit Student
        </Button>
      </div>

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
