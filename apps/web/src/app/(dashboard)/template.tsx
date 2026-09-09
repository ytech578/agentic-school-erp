"use client";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-transition" style={{ height: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}
