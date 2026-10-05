import React from "react";

export interface Column<T> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({ data, columns, isLoading, emptyMessage }: DataTableProps<T>) {
  const safeData: T[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as any).items)
    ? (data as any).items
    : [];

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th key={index}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array(5)
              .fill(0)
              .map((_, rIdx) => (
                <tr key={`skeleton-row-${rIdx}`} className="skeleton-row">
                  {columns.map((_, cIdx) => (
                    <td key={`skeleton-cell-${cIdx}`}>
                      <div
                        className="skeleton"
                        style={{
                          height: "14px",
                          width: cIdx === 0 ? "45%" : cIdx === 1 ? "75%" : "55%",
                          borderRadius: "var(--radius-sm)",
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
          ) : safeData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: "center",
                  padding: "3rem 1.5rem",
                  color: "var(--text-tertiary)",
                  fontSize: "0.875rem",
                }}
              >
                {emptyMessage || "No records found matching criteria."}
              </td>
            </tr>
          ) : (
            safeData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="data-table-row"
                style={{
                  animationDelay: `${Math.min(rowIndex * 20, 250)}ms`,
                }}
              >
                {columns.map((col, colIndex) => (
                  <td key={colIndex}>
                    {col.cell ? col.cell(row) : (row as any)[col.accessorKey]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
