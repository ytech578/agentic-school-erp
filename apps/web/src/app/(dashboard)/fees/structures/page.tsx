"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FeeStructuresPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [feeHeads, setFeeHeads] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  
  const [structureName, setStructureName] = useState("");
  const [items, setItems] = useState<{ feeHeadId: string; amount: number }[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: "success" | "error" } | null>(null);

  const academicYearId = "AY2026-27"; // Hardcoded for MVP

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [classesRes, headsRes] = await Promise.all([
          apiClient.get("/attendance/classes"), // Re-using this endpoint for now
          apiClient.get("/fees/heads")
        ]);
        setClasses(classesRes.data.data || []);
        setFeeHeads(headsRes.data.data || []);
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    };
    fetchInitialData();
  }, []);

  const loadStructure = async (classId: string) => {
    setSelectedClassId(classId);
    if (!classId) {
      setItems([]);
      setStructureName("");
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await apiClient.get(`/fees/structures?academicYearId=${academicYearId}&classId=${classId}`);
      const structure = res.data.data;
      if (structure) {
        setStructureName(structure.name);
        setItems(structure.items.map((i: any) => ({
          feeHeadId: i.feeHeadId,
          amount: i.amount
        })));
      } else {
        setStructureName("");
        // Pre-fill with all available fee heads set to 0
        setItems(feeHeads.map(h => ({ feeHeadId: h.id, amount: 0 })));
      }
    } catch (err) {
      setMessage({ text: "Failed to load fee structure", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedClassId || !structureName) {
      setMessage({ text: "Please select a class and enter a structure name", type: "error" });
      return;
    }

    // Filter out items with 0 amount
    const validItems = items.filter(i => i.amount > 0);
    
    if (validItems.length === 0) {
      setMessage({ text: "Please add at least one fee amount greater than 0", type: "error" });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      await apiClient.post("/fees/structures", {
        academicYearId,
        classId: selectedClassId,
        name: structureName,
        items: validItems
      });
      setMessage({ text: "Fee structure saved successfully!", type: "success" });
    } catch (err) {
      setMessage({ text: "Failed to save fee structure", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleItemChange = (feeHeadId: string, value: string) => {
    const num = parseFloat(value);
    setItems(prev => prev.map(item => 
      item.feeHeadId === feeHeadId ? { ...item, amount: isNaN(num) ? 0 : num } : item
    ));
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Button variant="ghost" onClick={() => router.back()} style={{ padding: "0.5rem" }}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Fee Structures</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Define the fee breakdown for different classes
          </p>
        </div>
      </div>

      {message && (
        <div style={{ 
          padding: "1rem", 
          backgroundColor: message.type === "success" ? "var(--success-50)" : "var(--danger-50)", 
          color: message.type === "success" ? "var(--success-600)" : "var(--danger-600)", 
          borderRadius: "var(--radius-md)", 
          border: `1px solid ${message.type === "success" ? "var(--success-200)" : "var(--danger-200)"}` 
        }}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Class *</label>
              <select 
                value={selectedClassId}
                onChange={(e) => loadStructure(e.target.value)}
                style={{
                  width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                  fontSize: "0.875rem", color: "var(--text-primary)"
                }}
              >
                <option value="">-- Select Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Input
                label="Structure Name *"
                value={structureName}
                onChange={(e) => setStructureName(e.target.value)}
                placeholder="e.g. Regular Class 9 Fees"
                disabled={!selectedClassId}
              />
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>
          ) : selectedClassId ? (
            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "1.5rem", marginTop: "0.5rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>Fee Breakdown</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {feeHeads.map(head => {
                  const item = items.find(i => i.feeHeadId === head.id);
                  return (
                    <div key={head.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem", backgroundColor: "var(--bg-surface-hover)", borderRadius: "var(--radius-md)" }}>
                      <div>
                        <p style={{ fontWeight: 500 }}>{head.name}</p>
                      </div>
                      <div style={{ width: "200px" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span style={{ padding: "0.625rem 0.875rem", backgroundColor: "var(--secondary-100)", border: "1px solid var(--secondary-400)", borderRight: "none", borderRadius: "var(--radius-md) 0 0 var(--radius-md)" }}>₹</span>
                          <input
                            type="number"
                            min="0"
                            value={item?.amount || ""}
                            onChange={(e) => handleItemChange(head.id, e.target.value)}
                            style={{
                              width: "100%", padding: "0.625rem 0.875rem",
                              border: "1px solid var(--secondary-400)", borderRadius: "0 var(--radius-md) var(--radius-md) 0",
                              fontSize: "0.875rem"
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px dashed var(--border-light)" }}>
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Total Annual Fee</p>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>₹ {totalAmount.toLocaleString('en-IN')}</p>
                </div>
                <Button onClick={handleSave} isLoading={isSaving}>
                  <Save size={16} style={{ marginRight: "0.5rem" }} />
                  Save Structure
                </Button>
              </div>

            </div>
          ) : (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface-hover)", borderRadius: "var(--radius-md)" }}>
              Please select a class to view or configure its fee structure.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
