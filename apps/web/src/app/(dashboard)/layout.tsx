"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import AIChatWidget from "@/components/ai/AIChatWidget";
import { useAuthStore } from "@/store/auth.store";
import { isRouteAllowedForRole, getAuthorizedRedirect } from "@/lib/role-routes";

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

    // Universal Cross-Portal Role Guard: Ensure user role is permitted on current route
    if (user?.role && !isRouteAllowedForRole(pathname, user.role)) {
      const target = getAuthorizedRedirect(pathname, user.role);
      if (target !== pathname) {
        console.warn(
          `[RouteGuard] Role "${user.role}" is not authorized for "${pathname}". Redirecting to "${target}".`
        );
        router.replace(target);
      }
    }
  }, [isMounted, isAuthenticated, user, router, pathname]);

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
