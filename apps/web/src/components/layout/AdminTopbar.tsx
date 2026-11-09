"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  Menu,
  LogOut,
  User as UserIcon,
  Shield,
  Activity,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { ThemeToggle } from "../ui/ThemeToggle";

interface AdminTopbarProps {
  onMobileOpen: () => void;
}

export function AdminTopbar({ onMobileOpen }: AdminTopbarProps) {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const roleVariant =
    user?.role === "SUPER_ADMIN"
      ? "indigo"
      : user?.role === "ADMIN"
        ? "blue"
        : user?.role === "MODERATOR"
          ? "amber"
          : "slate";

  const firstName = user?.firstName || user?.first_name || "Admin";
  const lastName = user?.lastName || user?.last_name || "User";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-200 btn hadow-sm transition-colors">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileOpen}
          className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/75"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md btn">
            Admin Console
          </span>
          <span className="text-xs text-slate-400">•</span>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Switch to User View
          </Link>
        </div>
      </div>

      {/* Right: Health shortcut, Swagger docs, Theme Toggle, Profile Dropdown */}
      <div className="flex items-center gap-3 sm:gap-4">
        <ThemeToggle />

        <a
          href="http://localhost:4000/docs"
          target="_blank"
          rel="noreferrer"
          className="btn hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/75 border border-slate-200 dark:border-slate-700"
        >
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          Swagger Docs
        </a>

        <Link
          href="/admin/health"
          className="btn hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
        >
          <Activity className="w-3.5 h-3.5" />
          Services Healthy
        </Link>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 p-1 hover:bg-slate-50 dark:hover:bg-slate-800/75 transition-colors text-left focus:outline-none rounded-full"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              {firstName[0] || "U"}
              {lastName[0] || ""}
            </div>
            {/* <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {firstName} {lastName}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {user?.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> */}
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-200 py-1.5 z-40">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-200">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {firstName} {lastName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user?.email}
                  </p>
                  <div className="mt-2">
                    <Badge variant={roleVariant}>{user?.role}</Badge>
                  </div>
                </div>

                <Link
                  href="/admin/profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/75 transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  Profile Settings
                </Link>

                <Link
                  href="/dashboard"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/75 transition-colors"
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  User Portal View
                </Link>

                <div className="border-t border-slate-100 dark:border-slate-200 my-1" />

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 rounded-lg dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
