"use client";
import React from "react";
import { Bell } from "lucide-react";
import { Card, PageHeader } from "../_ui";

export default function AnnouncementsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader title="Announcements" subtitle="School notices and circulars" icon={<Bell size={22} />} />
      <Card style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>
        No new announcements today.
      </Card>
    </div>
  );
}
