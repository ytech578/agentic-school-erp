import { Button } from "@/components/ui/Button";
import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ 
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--bg-body)", color: "var(--text-primary)", padding: "2rem"
    }}>
      <div style={{
        background: "var(--bg-surface)", padding: "4rem 2rem", borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-default)", boxShadow: "var(--shadow-xl)",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        maxWidth: "480px", width: "100%"
      }}>
        <div style={{ 
          width: "80px", height: "80px", borderRadius: "50%", background: "var(--brand-primary-light)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem"
        }}>
          <FileQuestion size={40} color="var(--brand-primary)" />
        </div>
        <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-bold)", marginBottom: "0.5rem" }}>
          404
        </h1>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)", marginBottom: "1rem" }}>
          Page not found
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: 1.5 }}>
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <Button>Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
