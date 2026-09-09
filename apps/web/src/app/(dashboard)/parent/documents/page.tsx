"use client";
import React from "react";
import { FileText } from "lucide-react";
import { Card, PageHeader } from "../_ui";

export default function DocumentsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader title="Documents" subtitle="Manage your child's submitted documents" icon={<FileText size={22} />} />
      <Card style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>
        Go to the "My Child" module to view uploaded documents.
      </Card>
    </div>
  );
}
