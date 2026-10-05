"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/axios";

export interface SchoolProfile {
  id?: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string | null;
  principalName?: string;
  affiliationNo?: string;
  udiseCode?: string;
  boardType?: string;
}

const DEFAULT_SCHOOL: SchoolProfile = {
  name: "Sunrise Public School",
  code: "DEMO001",
  address: "123, Education Street, Knowledge Nagar",
  city: "Vjayawada",
  state: "Andhra Pradesh",
  pinCode: "411001",
  country: "India",
  phone: "+91-20-12345678",
  email: "info@sunriseschool.edu.in",
  website: "https://sunriseschool.edu.in",
  principalName: "Dr. Rajesh Sharma",
  affiliationNo: "CBSE/2025/12345",
  boardType: "CBSE",
};

export function useSchool() {
  const [school, setSchool] = useState<SchoolProfile>(DEFAULT_SCHOOL);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSchool = useCallback(async () => {
    try {
      const res = await apiClient.get("/schools/current");
      const data = res.data?.data || res.data;
      if (data && data.name) {
        setSchool({
          ...DEFAULT_SCHOOL,
          ...data,
        });
      }
    } catch {
      // Graceful fallback to default school profile
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchool();

    const handleContextChange = () => {
      fetchSchool();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("school_context_changed", handleContextChange);
      window.addEventListener("storage", handleContextChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("school_context_changed", handleContextChange);
        window.removeEventListener("storage", handleContextChange);
      }
    };
  }, [fetchSchool]);

  const fullAddress = [
    school.address,
    school.city,
    school.state ? `${school.state}${school.pinCode ? ` - ${school.pinCode}` : ""}` : school.pinCode,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    school,
    schoolName: school.name || "Sunrise Public School",
    code: school.code || "DEMO001",
    affiliationNo: school.affiliationNo || "CBSE/2025/12345",
    fullAddress: fullAddress || "123, Education Street, Knowledge Nagar, Vjayawada, Andhra Pradesh - 411001",
    phone: school.phone || "+91-20-12345678",
    email: school.email || "info@sunriseschool.edu.in",
    website: school.website || "https://sunriseschool.edu.in",
    principalName: school.principalName || "Dr. Rajesh Sharma",
    boardType: school.boardType || "CBSE",
    city: school.city || "Vjayawada",
    state: school.state || "Andhra Pradesh",
    isLoading,
    refetch: fetchSchool,
  };
}
