"use client";
import React from "react";
import { BarChart3 } from "lucide-react";
import { Card, PageHeader } from "../_ui";

export default function ReportsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader title="Reports" subtitle="Term-wise progress reports" icon={<BarChart3 size={22} />} />
      <Card style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>
        Head to "Marks & Assessments" &gt; "Reports" to view available progress cards.
      </Card>
    </div>
  );
}
