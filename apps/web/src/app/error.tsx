"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AlertOctagon } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ 
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--bg-body)", color: "var(--text-primary)", padding: "2rem"
    }}>
      <div style={{
        background: "var(--bg-surface)", padding: "3rem", borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-default)", boxShadow: "var(--shadow-xl)",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        maxWidth: "480px", width: "100%"
      }}>
        <div style={{ 
          width: "80px", height: "80px", borderRadius: "50%", background: "var(--status-danger-bg)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem"
        }}>
          <AlertOctagon size={40} color="var(--status-danger)" />
        </div>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: 1.5 }}>
          An unexpected error occurred in the application. Our team has been notified.
        </p>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Button variant="secondary" onClick={() => window.location.href = "/dashboard"}>
            Go to Dashboard
          </Button>
          <Button onClick={() => reset()}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
