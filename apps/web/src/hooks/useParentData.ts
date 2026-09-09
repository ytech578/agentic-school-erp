"use client";
import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/axios";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cache: any = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useParentData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(cache || null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cacheTime < CACHE_TTL) {
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get("/dashboard/parent-detail");
      const d = res.data?.data || res.data;
      cache = d;
      cacheTime = Date.now();
      setData(d);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const invalidate = () => { cache = null; cacheTime = 0; fetch(true); };

  // Convenience: first child (most parents have 1 linked child)
  const child = data?.children?.[0] ?? null;

  return { data, child, loading, error, refetch: invalidate };
}
