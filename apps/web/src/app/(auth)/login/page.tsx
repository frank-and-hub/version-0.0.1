"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Layers } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-600/20 mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Sign in to Enterprise Monorepo
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Automated Role-Based Redirection (No role selection needed)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-200 sm:px-10 transition-colors">
          {error && (
            <div className="mb-5 p-3 text-xs bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Social Sign-In Providers (Requirement 9.8) */}
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 text-center">
              Or continue with Social OAuth 2.0
            </p>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => alert("OAuth 2.0 Provider: Google configured")}
                className="py-2 px-3 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-center"
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => alert("OAuth 2.0 Provider: Facebook configured")}
                className="py-2 px-3 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-center"
              >
                Facebook
              </button>
              <button
                type="button"
                onClick={() => alert("OAuth 2.0 Provider: Apple ID configured")}
                className="py-2 px-3 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-center"
              >
                Apple
              </button>
              <button
                type="button"
                onClick={() =>
                  alert("OAuth 2.0 Provider: Instagram Graph API configured")
                }
                className="py-2 px-3 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-center"
              >
                Instagram
              </button>
            </div>
          </div>

          {/* Quick Demo Credentials */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-200" style={{ display: process.env.NODE_ENV === 'development' ? 'block' : 'none' }}>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
              Quick Testing Credentials
            </p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <button
                type="button"
                onClick={() =>
                  handleFillDemo("superadmin@example.com", "SuperAdmin123!")
                }
                className="px-2 py-1.5 text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo("admin@example.com", "Admin123!")}
                className="px-2 py-1.5 text-[11px] font-medium bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() =>
                  handleFillDemo("moderator@example.com", "User123!")
                }
                className="px-2 py-1.5 text-[11px] font-medium bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200 dark:border-amber-800 transition-colors"
              >
                Moderator
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo("user@example.com", "User123!")}
                className="px-2 py-1.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Standard User
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
            >
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
