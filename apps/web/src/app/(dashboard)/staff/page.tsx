"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Search, Plus, Eye, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";

export default function StaffDirectoryPage() {
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const fetchStaff = async (search = "") => {
    setIsLoading(true);
    try {
      const response = await apiClient.get("/staff", {
        params: { search, limit: 50 }
      });
      setStaffList(response.data.data.items || []);
    } catch (error) {
      console.error("Failed to fetch staff", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleSearch = (e: React.SyntheticEvent) => {
    e.preventDefault();
    fetchStaff(searchTerm);
  };

  const columns: any[] = [
    {
      header: "Employee ID",
      accessorKey: "employeeId",
    },
    {
      header: "Name",
      accessorKey: "name",
      cell: (row: any) => `${row.user?.firstName || ''} ${row.user?.lastName || ''}`,
    },
    {
      header: "Role",
      accessorKey: "role",
      cell: (row: any) => row.user?.role || 'N/A',
    },
    {
      header: "Department",
      accessorKey: "department",
      cell: (row: any) => row.department?.name || 'N/A',
    },
    {
      header: "Designation",
      accessorKey: "designation",
      cell: (row: any) => row.designation?.name || 'N/A',
    },
    {
      header: "Actions",
      accessorKey: "actions",
      cell: (row: any) => (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push(`/staff/${row.id}`)}
          >
            <Eye size={16} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push(`/staff/${row.id}/edit`)}
          >
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
          <h1 style={{ marginBottom: "0.25rem" }}>Staff Directory</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Manage teaching and non-teaching staff
          </p>
        </div>
        <Button onClick={() => router.push("/staff/new")}>
          <Plus size={18} style={{ marginRight: "0.5rem" }} />
          Onboard Staff
        </Button>
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ flex: 1, maxWidth: "400px" }}>
            <Input 
              placeholder="Search by name or employee ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        <DataTable
          columns={columns}
          data={staffList}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
