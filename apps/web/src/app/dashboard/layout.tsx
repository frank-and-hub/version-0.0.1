"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Layers, User, Shield, LogOut, Home, History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const isAdministrativeRole =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "MODERATOR";

  const firstName = user?.firstName || user?.first_name || "Member";
  const lastName = user?.lastName || user?.last_name || "";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-200 btn hadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Brand */}
            <div className="flex items-center gap-8">
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white"
              >
                <div className="p-2 bg-indigo-600 text-white rounded-xl btn hadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <span>Member Portal</span>
              </Link>

              <nav className="hidden sm:flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pathname === "/dashboard"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/75"
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Overview
                </Link>

                <Link
                  href="/dashboard/profile"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pathname === "/dashboard/profile"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/75"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Profile & Security
                </Link>

                {isAdministrativeRole && (
                  <Link
                    href="/admin/dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-colors ml-2"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Switch to Admin Panel
                  </Link>
                )}
              </nav>
            </div>

            {/* Right: Theme Toggle, User Badge & Logout */}
            <div className="flex items-center gap-4">
              <ThemeToggle />

              <div className="flex items-center gap-2.5 text-right">
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {firstName} {lastName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {user?.email}
                  </div>
                </div>
                <Badge variant="indigo">{user?.role}</Badge>
              </div>

              <button
                onClick={logout}
                title="Sign out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
