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
  name: "",
  country: "India",
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
      // Keep fields blank instead of presenting another institution's data.
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
    schoolName: school.name || "School name not configured",
    code: school.code || "Not configured",
    affiliationNo: school.affiliationNo || "Not configured",
    fullAddress: fullAddress || "Address not configured",
    phone: school.phone || "Contact not configured",
    email: school.email || "Email not configured",
    website: school.website || "Website not configured",
    principalName: school.principalName || "Principal not configured",
    boardType: school.boardType || "Board not configured",
    city: school.city || "",
    state: school.state || "",
    isLoading,
    refetch: fetchSchool,
  };
}
