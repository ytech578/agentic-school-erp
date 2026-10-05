"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import {
  Search,
  Plus,
  Eye,
  Edit,
  AlertCircle,
  RefreshCw,
  Users,
  Shield,
  Award,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Filter,
  Layers,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { useAuthStore } from "@/store/auth.store";

export interface StaffItem {
  id: string;
  employeeId: string;
  userId: string;
  departmentId?: string | null;
  designationId?: string | null;
  employmentType?: string;
  isActive: boolean;
  joinDate?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    avatarUrl?: string | null;
    phone?: string;
  };
  department?: {
    id?: string;
    name?: string;
  } | null;
  designation?: {
    id?: string;
    name?: string;
  } | null;
}

export interface DepartmentItem {
  id: string;
  name: string;
}

export default function StaffDirectoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  // Default to 100 so all staff members (currently 52) are loaded immediately without being cut off
  const [pageSize, setPageSize] = useState<number>(100);

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCount, setActiveCount] = useState<number>(0);

  const canManageStaff =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "SCHOOL_ADMIN" ||
    user?.role === "PRINCIPAL";

  // Load departments once for filter dropdown
  useEffect(() => {
    let isMounted = true;
    const loadDepartments = async () => {
      try {
        const res = await apiClient.get("/staff/departments");
        const raw = res.data;
        const list = raw?.data || raw || [];
        if (isMounted && Array.isArray(list)) {
          setDepartments(list);
        }
      } catch (err) {
        console.warn("Could not load departments list", err);
      }
    };
    loadDepartments();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchStaff = useCallback(
    async (
      page = currentPage,
      limit = pageSize,
      search = searchTerm,
      departmentId = selectedDepartment,
      status = selectedStatus,
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number | undefined> = {
          page,
          limit: limit >= 1000 ? "all" : limit,
          search: search.trim() || undefined,
        };

        if (departmentId && departmentId !== "ALL") {
          params.departmentId = departmentId;
        }

        if (status && status !== "ALL") {
          params.isActive = status === "ACTIVE" ? "true" : "false";
        }

        const response = await apiClient.get("/staff", { params });
        const raw = response.data;

        // Defensive unwrapping
        const items: StaffItem[] =
          raw?.data?.items ||
          raw?.items ||
          raw?.data ||
          (Array.isArray(raw) ? raw : []);

        const total =
          typeof raw?.data?.total === "number"
            ? raw.data.total
            : typeof raw?.total === "number"
            ? raw.total
            : items.length;

        const pages =
          typeof raw?.data?.totalPages === "number"
            ? raw.data.totalPages
            : Math.max(1, Math.ceil(total / limit));

        setStaffList(Array.isArray(items) ? items : []);
        setTotalCount(total);
        setTotalPages(pages);

        // Compute active members in the current view/set
        const active = items.filter((s) => s.isActive !== false).length;
        setActiveCount(active);
      } catch (err: unknown) {
        const errorObj = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const message =
          errorObj.response?.data?.message ||
          errorObj.message ||
          "Unable to load faculty and staff directory. Please try again.";
        setError(message);
        setStaffList([]);
      } finally {
        setIsLoading(false);
      }
    },
    [currentPage, pageSize, searchTerm, selectedDepartment, selectedStatus],
  );

  useEffect(() => {
    fetchStaff(currentPage, pageSize, searchTerm, selectedDepartment, selectedStatus);
  }, [currentPage, pageSize, selectedDepartment, selectedStatus]);

  const handleSearchSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchStaff(1, pageSize, searchTerm, selectedDepartment, selectedStatus);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedDepartment("ALL");
    setSelectedStatus("ALL");
    setCurrentPage(1);
    fetchStaff(1, pageSize, "", "ALL", "ALL");
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(searchTerm) || selectedDepartment !== "ALL" || selectedStatus !== "ALL";

  // Calculate visible range numbers
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  const columns = [
    {
      header: "Employee ID",
      accessorKey: "employeeId",
      cell: (row: StaffItem) => (
        <span style={{ fontWeight: 600, color: "var(--brand-blue)" }}>
          {row.employeeId || "N/A"}
        </span>
      ),
    },
    {
      header: "Faculty / Staff Name",
      accessorKey: "name",
      cell: (row: StaffItem) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {`${row.user?.firstName || ""} ${row.user?.lastName || ""}`.trim() ||
              "N/A"}
          </div>
          {row.user?.email && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {row.user.email}
            </div>
          )}
          {row.user?.phone && (
            <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
              {row.user.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "System Role",
      accessorKey: "role",
      cell: (row: StaffItem) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "0.2rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "rgba(37, 99, 235, 0.08)",
            color: "var(--brand-blue)",
          }}
        >
          <Shield size={12} />
          {row.user?.role || "N/A"}
        </span>
      ),
    },
    {
      header: "Department",
      accessorKey: "department",
      cell: (row: StaffItem) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <Building2 size={13} style={{ color: "var(--text-tertiary)" }} />
          {row.department?.name || "General"}
        </span>
      ),
    },
    {
      header: "Designation",
      accessorKey: "designation",
      cell: (row: StaffItem) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
          <Award size={13} style={{ color: "var(--text-tertiary)" }} />
          {row.designation?.name || "Faculty"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "isActive",
      cell: (row: StaffItem) => (
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "0.2rem 0.6rem",
            borderRadius: "9999px",
            backgroundColor:
              row.isActive !== false
                ? "rgba(16, 185, 129, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color: row.isActive !== false ? "var(--success)" : "var(--danger)",
          }}
        >
          {row.isActive !== false ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      header: "Actions",
      accessorKey: "actions",
      cell: (row: StaffItem) => (
        <div style={{ display: "flex", gap: "0.35rem" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/staff/${row.id}`)}
            title="View Profile"
          >
            <Eye size={16} />
          </Button>
          {canManageStaff && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/staff/${row.id}/edit`)}
              title="Edit Staff Member"
            >
              <Edit size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Users className="text-brand" size={26} />
            Staff & Faculty Directory
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
            }}
          >
            Campus instructors, administrators, designations, and department assignments
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Button
            variant="outline"
            onClick={() =>
              fetchStaff(currentPage, pageSize, searchTerm, selectedDepartment, selectedStatus)
            }
            title="Refresh directory"
          >
            <RefreshCw
              size={16}
              style={{
                marginRight: "0.35rem",
                animation: isLoading ? "spin 1s linear infinite" : "none",
              }}
            />
            Refresh
          </Button>

          {canManageStaff && (
            <Button onClick={() => router.push("/staff/new")}>
              <Plus size={18} style={{ marginRight: "0.5rem" }} />
              Onboard Staff
            </Button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <StatCard
          label="Total Faculty & Staff"
          value={totalCount}
          sub="Registered in campus database"
          icon={Users}
          color="var(--brand-blue)"
        />
        <StatCard
          label="Active In Service"
          value={activeCount}
          sub={`${totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 100}% operational staff`}
          icon={UserCheck}
          color="var(--success)"
        />
        <StatCard
          label="Academic Departments"
          value={departments.length || "Standard"}
          sub="Subject divisions & faculties"
          icon={Building2}
          color="var(--brand-purple)"
        />
        <StatCard
          label="Directory Scope"
          value={pageSize >= 1000 ? "Full Campus" : `${pageSize} per page`}
          sub={
            totalCount > 0
              ? `Displaying ${staffList.length} of ${totalCount} records`
              : "No records found"
          }
          icon={Layers}
          color="var(--brand-cyan)"
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.875rem 1.25rem",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "var(--danger)",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              fetchStaff(currentPage, pageSize, searchTerm, selectedDepartment, selectedStatus)
            }
          >
            <RefreshCw size={14} style={{ marginRight: "0.35rem" }} />
            Retry
          </Button>
        </div>
      )}

      {/* Main Content Card */}
      <div className="card" style={{ padding: "1.5rem" }}>
        {/* Filter & Search Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flex: 1,
              flexWrap: "wrap",
              minWidth: "280px",
            }}
          >
            {/* Search Input */}
            <form
              onSubmit={handleSearchSubmit}
              style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: "220px", maxWidth: "400px" }}
            >
              <Input
                placeholder="Search by name, ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search size={18} />}
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>

            {/* Department Filter */}
            {departments.length > 0 && (
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "0.55rem 0.85rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "0.55rem 0.85rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Faculty</option>
              <option value="INACTIVE">Inactive / Resigned</option>
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
                <Filter size={14} style={{ marginRight: "0.35rem" }} />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Quick metric pill & Page size selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
                padding: "0.35rem 0.75rem",
                borderRadius: "9999px",
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <UserCheck size={15} style={{ color: "var(--success)" }} />
              <span>
                <strong>{totalCount}</strong> Total Staff in Directory
              </span>
            </div>

            {/* Page Size Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                style={{
                  padding: "0.35rem 0.6rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100 (Recommended)</option>
                <option value={250}>250</option>
                <option value={1000}>All ({totalCount})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={staffList}
          isLoading={isLoading}
          emptyMessage={
            hasActiveFilters
              ? "No faculty or staff found matching your filter criteria."
              : "No faculty or staff members registered yet."
          }
        />

        {/* Pagination Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            marginTop: "1.5rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border-light)",
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
          }}
        >
          <div>
            {totalCount > 0 ? (
              <span>
                Showing <strong>{startIndex}</strong> to <strong>{endIndex}</strong> of{" "}
                <strong>{totalCount}</strong> staff members
              </span>
            ) : (
              <span>0 staff members</span>
            )}
          </div>

          {/* Navigation Controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1 || isLoading}
                title="First page"
              >
                <ChevronsLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoading}
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </Button>

              <span
                style={{
                  padding: "0.25rem 0.75rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-app)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                }}
              >
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isLoading}
                title="Next page"
              >
                <ChevronRight size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages || isLoading}
                title="Last page"
              >
                <ChevronsRight size={16} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
