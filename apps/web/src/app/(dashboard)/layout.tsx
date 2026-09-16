"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import AIChatWidget from "@/components/ai/AIChatWidget";
import { useAuthStore } from "@/store/auth.store";
import { isRouteAllowedForRole, getAuthorizedRedirect } from "@/lib/role-routes";
import axios from "axios";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (user?.role && !isRouteAllowedForRole(pathname, user.role)) {
      const authorizedRoute = getAuthorizedRedirect(pathname, user.role);
      if (authorizedRoute !== pathname) {
        router.replace(authorizedRoute);
      }
    }
  }, [isAuthenticated, isMounted, user?.role, pathname, router]);

  // Proactive Session Heartbeat: keep active users logged in without disruptions
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastActivityTime = Date.now();
    const markActivity = () => {
      lastActivityTime = Date.now();
    };

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));

    // Heartbeat runs every 8 minutes. If user had activity in the last 15 minutes, silently refresh token.
    const interval = setInterval(async () => {
      const isUserActive = Date.now() - lastActivityTime < 15 * 60 * 1000;
      if (!isUserActive) return;

      try {
        const state = useAuthStore.getState();
        const currentRefreshToken = state.refreshToken;
        if (!currentRefreshToken) return;

        const apiUrl =
          typeof window !== "undefined"
            ? "/api"
            : (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api");
        const res = await axios.post(
          `${apiUrl}/auth/refresh`,
          { refreshToken: currentRefreshToken },
          {
            headers: { "x-refresh-token": currentRefreshToken },
            withCredentials: true,
            timeout: 15000,
          }
        );
        const newAccessToken = res.data?.data?.accessToken || res.data?.accessToken;
        const newRefreshToken = res.data?.data?.refreshToken || res.data?.refreshToken;
        if (newAccessToken) {
          state.setTokens(newAccessToken, newRefreshToken || currentRefreshToken || undefined);
        }
      } catch (err) {
        // Silent background refresh failed; will fallback to axios 401 interceptor
      }
    }, 8 * 60 * 1000);

    return () => {
      clearInterval(interval);
      activityEvents.forEach((event) => window.removeEventListener(event, markActivity));
    };
  }, [isAuthenticated]);

  if (!isMounted) {
    return null; // Avoid hydration mismatch on auth check
  }

  if (!isAuthenticated) {
    return null;
  }

  // Prevent flashing unauthorized portal content while redirect is in-flight
  if (user?.role && !isRouteAllowedForRole(pathname, user.role)) {
    return null;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="page-content">
          {children}
        </main>
      </div>
      
      {/* Global AI Chat Widget */}
      <AIChatWidget />
    </div>
  );
}
