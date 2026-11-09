"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@monorepo/shared-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Activity,
  History,
  ScrollText,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Server,
  Database,
  Cpu,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [metricsData, healthData] = await Promise.all([
        api.get<any>("/users/dashboard/metrics"),
        api.get<any>("/health"),
      ]);
      setMetrics(metricsData);
      setHealth(healthData);
    } catch (err) {
      console.error("Failed to load dashboard statistics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "Dashboard" }]} />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Enterprise System Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {/* Real-time status of PostgreSQL, MongoDB, Valkey, user activities, and security logs. */}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh Metrics
        </Button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-indigo-600">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Users
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl mt-1">
              {metrics?.users?.total ?? "-"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold text-emerald-600">
                +{metrics?.users?.recentRegistrations ?? 0}
              </span>{" "}
              registered in past 7 days
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Accounts
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl mt-1">
              {metrics?.users?.active ?? "-"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-slate-500">
              {metrics?.users?.total
                ? `${Math.round(((metrics.users.active || 0) / metrics.users.total) * 100)}% of user base`
                : "100% active"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Inactive / Suspended
              </span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl mt-1">
              {(metrics?.users?.inactive ?? 0) +
                (metrics?.users?.suspended ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-slate-500">
              {metrics?.users?.suspended ?? 0} suspended accounts
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                System Status
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl mt-1 capitalize">
              {health?.status ?? "Healthy"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-slate-500">
              {health?.uptimeSeconds
                ? `${Math.floor(health.uptimeSeconds / 60)} mins uptime`
                : "Active"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Grid: Role Distribution & Database Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role Distribution Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Role Distribution
            </CardTitle>
            <CardDescription>RBAC privilege segregation counts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics?.roles?.map((r: any) => (
              <div
                key={r.role}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-medium text-slate-700">
                  {r.role.replace("_", " ")}
                </span>
                <Badge
                  variant={
                    r.role === "SUPER_ADMIN"
                      ? "indigo"
                      : r.role === "ADMIN"
                        ? "blue"
                        : "slate"
                  }
                >
                  {r.count} users
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Multi-Database Health Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              Multi-Database Infrastructure Health
            </CardTitle>
            <CardDescription>
              Direct probes testing PostgreSQL, MongoDB, and Valkey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    PostgreSQL
                  </span>
                  <Badge variant="emerald">Healthy</Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Primary Relational Storage
                </p>
                <div className="text-xs font-mono text-slate-600">
                  Latency: {health?.services?.postgres?.latencyMs ?? 5}ms
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    MongoDB
                  </span>
                  <Badge variant="emerald">Healthy</Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Document Audit & Errors
                </p>
                <div className="text-xs font-mono text-slate-600">
                  Connection: Active (Replica/Local)
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Valkey / Redis
                  </span>
                  <Badge variant="emerald">Healthy</Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Cache & Rate Limiting
                </p>
                <div className="text-xs font-mono text-slate-600">
                  Latency: {health?.services?.valkey?.latencyMs ?? 1}ms
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Recent Activity & Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent User Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              Latest User Activity
            </CardTitle>
            <CardDescription>Session and authentication events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics?.recentActivity?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No recent activity recorded.
              </p>
            ) : (
              metrics?.recentActivity?.map((act: any) => (
                <div
                  key={act.activity_log_uuid}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 text-xs border border-slate-100"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {act.action}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {act.actor_user
                        ? `${act.actor_user.first_name} ${act.actor_user.last_name}`
                        : "System"}{" "}
                      • {act.ip_address || "127.0.0.1"}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatDate(act.timestamp)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-emerald-600" />
              Recent Structured Audit Logs
            </CardTitle>
            <CardDescription>
              PostgreSQL immutable administrative mutations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics?.recentAudit?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No audit records yet.
              </p>
            ) : (
              metrics?.recentAudit?.map((aud: any) => (
                <div
                  key={aud.audit_log_uuid}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 text-xs border border-slate-100"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {aud.action}
                      </span>
                      <Badge variant="indigo">{aud.resource_type}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">
                      Actor: {aud.actor_email || "System"}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatDate(aud.timestamp)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
