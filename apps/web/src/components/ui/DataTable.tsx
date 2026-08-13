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
}

export function DataTable<T>({ data, columns, isLoading }: DataTableProps<T>) {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
          fontSize: "0.875rem",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
            {columns.map((col, index) => (
              <th
                key={index}
                style={{
                  padding: "0.75rem 1rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: "center", padding: "2rem", color: "var(--text-tertiary)" }}
              >
                Loading data...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: "center", padding: "2rem", color: "var(--text-tertiary)" }}
              >
                No results found.
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{
                  borderBottom: "1px solid var(--border-light)",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "")}
              >
                {columns.map((col, colIndex) => (
                  <td key={colIndex} style={{ padding: "0.75rem 1rem", color: "var(--text-primary)" }}>
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
